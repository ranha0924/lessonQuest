import { isIP } from 'node:net';

import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

import type { SqlDatabase, SqlTransaction } from './sql.js';

export interface PostgresOptions {
  connectionString: string;
  mode?: 'production' | 'test';
  max?: number;
  schema?: 'lessonquest';
}

export class DatabaseError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super('Database operation failed');
    this.name = 'DatabaseError';
    this.code = code !== undefined && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
  }
}

function safeError(error: unknown): DatabaseError {
  return new DatabaseError(
    error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined,
  );
}

/** Validate once, without connecting. No driver URL parsing can replace our TLS settings. */
export function postgresPoolConfig(options: PostgresOptions): PoolConfig {
  try {
    if (typeof options.connectionString !== 'string' || options.connectionString.length > 8192)
      throw new Error();
    const url = new URL(options.connectionString);
    const mode = options.mode ?? 'production';
    const max = options.max ?? 5;
    const database = decodeURIComponent(url.pathname.slice(1));
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !user ||
      !password ||
      [...user, ...password].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      !/^[A-Za-z0-9_-]{1,63}$/.test(database) ||
      url.hash ||
      !Number.isInteger(max) ||
      max < 1 ||
      max > 10 ||
      !['production', 'test'].includes(mode) ||
      (options.schema !== undefined && options.schema !== 'lessonquest')
    )
      throw new Error();
    if (mode === 'test') {
      if (
        url.hostname !== '127.0.0.1' ||
        !/^lessonquest_test_[a-f0-9]{24}$/.test(database) ||
        url.search
      )
        throw new Error();
    } else {
      if (
        isIP(url.hostname) !== 0 ||
        !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/i.test(url.hostname) ||
        url.hostname.toLowerCase().endsWith('.localhost')
      )
        throw new Error();
      const seen = new Set<string>();
      for (const [key, value] of url.searchParams) {
        if (seen.has(key)) throw new Error();
        seen.add(key);
        if (key === 'sslmode' && ['require', 'verify-full'].includes(value)) continue;
        // pg supports preference only. Never silently downgrade a required binding.
        if (key === 'channel_binding' && value === 'prefer') continue;
        throw new Error();
      }
    }
    const port = url.port ? Number(url.port) : 5432;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    return {
      host: url.hostname,
      port,
      user,
      password,
      database,
      ssl: mode === 'production' ? { rejectUnauthorized: true } : false,
      enableChannelBinding: mode === 'production',
      max,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 15000,
      application_name: 'LessonQuest',
      // A nonempty value also prevents ambient PGOPTIONS from replacing session settings.
      options:
        '-c client_encoding=UTF8' +
        (options.schema === undefined ? '' : ' -c search_path=lessonquest,pg_catalog'),
    };
  } catch {
    throw new Error('Invalid PostgreSQL configuration');
  }
}

async function queryRows<T>(
  client: Pool | PoolClient,
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[] }> {
  try {
    const result = await client.query<T & QueryResultRow>(sql, params);
    return { rows: result.rows };
  } catch (error) {
    throw safeError(error);
  }
}

class PostgresTransaction implements SqlTransaction {
  private active = true;
  private readonly pending = new Set<Promise<unknown>>();
  failed = false;
  constructor(private readonly client: PoolClient) {}
  finish(): void {
    this.active = false;
  }
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    if (!this.active) return Promise.reject(new DatabaseError());
    const result = queryRows<T>(this.client, sql, params);
    this.pending.add(result);
    void result.then(
      () => {
        this.pending.delete(result);
      },
      () => {
        this.failed = true;
        this.pending.delete(result);
      },
    );
    return result;
  }
  async drain(): Promise<void> {
    await Promise.allSettled(this.pending);
  }
  async exec(sql: string): Promise<unknown> {
    return this.query(sql);
  }
}

export class PostgresDatabase implements SqlDatabase {
  private readonly pool: Pool;
  private closing: Promise<void> | undefined;
  constructor(options: PostgresOptions) {
    this.pool = new Pool(postgresPoolConfig(options));
    this.pool.on('error', () => {
      // pg removes failed idle clients. Never log the driver's SQL/credentials.
    });
  }
  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    if (this.closing !== undefined) throw new DatabaseError();
    return queryRows<T>(this.pool, sql, params);
  }
  async exec(sql: string): Promise<unknown> {
    return this.query(sql);
  }
  async transaction<T>(operation: (transaction: SqlTransaction) => Promise<T>): Promise<T> {
    if (this.closing !== undefined) throw new DatabaseError();
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw safeError(error);
    }
    const tx = new PostgresTransaction(client);
    let destroy = false;
    const onError = () => {
      destroy = true;
      tx.failed = true;
    };
    client.on('error', onError);
    try {
      await queryRows(client, 'BEGIN');
      const result = await operation(tx);
      tx.finish();
      await tx.drain();
      // A caught SQL error must not turn PostgreSQL's implicit rollback into success.
      if (tx.failed) throw new DatabaseError();
      await queryRows(client, 'COMMIT');
      return result;
    } catch (error) {
      tx.finish();
      try {
        await queryRows(client, 'ROLLBACK');
      } catch {
        destroy = true;
      }
      throw error;
    } finally {
      tx.finish();
      client.release(destroy);
      client.off('error', onError);
    }
  }
  close(): Promise<void> {
    this.closing ??= this.pool.end().catch((error: unknown) => {
      throw safeError(error);
    });
    return this.closing;
  }
}
