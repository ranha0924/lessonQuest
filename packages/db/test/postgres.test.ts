import { randomUUID } from 'node:crypto';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Actor } from '@lessonquest/contracts';

import { FirebaseIdentityRepository } from '../src/firebase-identity-repository.js';
import {
  LessonInputRepository,
  LessonInputPersistenceError,
} from '../src/lesson-input-repository.js';
import { initializeSchema } from '../src/schema.js';
import {
  ConflictError,
  ResourceNotFoundError,
  TenantRepository,
} from '../src/tenant-repository.js';
import { DatabaseError, PostgresDatabase, postgresPoolConfig } from '../src/postgres.js';

function testUrl(): string {
  const value = process.env.LESSONQUEST_POSTGRES_TEST_URL;
  if (process.env.LESSONQUEST_POSTGRES_TEST !== 'owned-disposable' || value === undefined) {
    throw new Error('Run pnpm test:postgres with its disposable cluster');
  }
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1' || !/^\/lessonquest_test_[a-f0-9]{24}$/.test(url.pathname)) {
    throw new Error('Refusing non-disposable PostgreSQL target');
  }
  return value;
}

const pools: PostgresDatabase[] = [];
function pool(max = 5): PostgresDatabase {
  const database = new PostgresDatabase({ connectionString: testUrl(), mode: 'test', max });
  pools.push(database);
  return database;
}
afterEach(async () => {
  await Promise.all(pools.splice(0).map((database) => database.close()));
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('PostgreSQL persistence and transaction boundaries', () => {
  it('persists typed rows across independent pools and restart', async () => {
    const first = pool();
    const table = `roundtrip_${randomUUID().replaceAll('-', '')}`;
    await first.exec(
      `CREATE TABLE ${table} (id uuid PRIMARY KEY, payload jsonb, created_at timestamptz)`,
    );
    const id = randomUUID();
    const date = new Date('2026-09-09T01:00:00.000Z');
    await first.query(`INSERT INTO ${table} VALUES ($1, $2::jsonb, $3)`, [
      id,
      JSON.stringify({ title: '힘과 운동' }),
      date,
    ]);
    const expected = [{ id, payload: { title: '힘과 운동' }, created_at: date }];
    expect((await pool().query(`SELECT * FROM ${table}`)).rows).toEqual(expected);
    await first.close();
    expect((await pool().query(`SELECT * FROM ${table}`)).rows).toEqual(expected);
  });

  it('holds one backend across awaits and rolls back with the original domain error', async () => {
    const database = pool(1);
    const domain = new RangeError('Synthetic domain failure');
    const table = `rollback_${randomUUID().replaceAll('-', '')}`;
    await database.exec(`CREATE TABLE ${table} (id int)`);
    let pid: unknown;
    await expect(
      database.transaction(async (tx) => {
        pid = (await tx.query('SELECT pg_backend_pid() AS pid')).rows;
        await tx.query(`INSERT INTO ${table} VALUES (1)`);
        expect((await tx.query('SELECT pg_backend_pid() AS pid')).rows).toEqual(pid);
        throw domain;
      }),
    ).rejects.toBe(domain);
    expect((await database.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    expect((await database.query('SELECT pg_backend_pid() AS pid')).rows).toEqual(pid);
  });

  it('runs overlapping transactions on different backends without leaking state', async () => {
    const database = pool(2);
    const ready = deferred();
    const finish = deferred();
    const one = database.transaction(async (tx) => {
      await tx.query("SELECT set_config('application_name', 'synthetic_one', true)");
      const pid = (await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      ready.resolve();
      await finish.promise;
      expect(
        (await tx.query<{ name: string }>("SELECT current_setting('application_name') AS name"))
          .rows[0]?.name,
      ).toBe('synthetic_one');
      return pid;
    });
    await Promise.race([ready.promise, one]);
    const two = await database.transaction(async (tx) => {
      expect(
        (await tx.query<{ name: string }>("SELECT current_setting('application_name') AS name"))
          .rows[0]?.name,
      ).toBe('LessonQuest');
      return (await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
    });
    finish.resolve();
    expect(await one).not.toBe(two);
  });

  it('sanitizes SQL errors, rejects an escaped transaction and permits pool reuse', async () => {
    const database = pool(1);
    let escaped: Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0] | undefined;
    await expect(
      database.transaction(async (tx) => {
        escaped = tx;
        await tx.query("SELECT 'private_fixture_value'::integer");
      }),
    ).rejects.toMatchObject({ name: 'DatabaseError', message: 'Database operation failed' });
    await expect(escaped?.query('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    expect((await database.query('SELECT 42 AS value')).rows).toEqual([{ value: 42 }]);
  });

  it('rejects success after a caught SQL failure instead of claiming a rolled-back commit', async () => {
    const database = pool(1);
    await expect(
      database.transaction(async (tx) => {
        await expect(tx.query("SELECT 'synthetic_private'::int")).rejects.toMatchObject({
          code: '22P02',
          message: 'Database operation failed',
        });
        return 'must not report committed';
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
    expect((await database.query('SELECT 1 AS value')).rows).toEqual([{ value: 1 }]);
  });

  it('does not claim commit when a detached query fails after the callback resolves', async () => {
    const database = pool(1);
    await expect(
      database.transaction((tx) => {
        void tx.query("SELECT 'synthetic_private'::int").catch(() => {});
        return Promise.resolve('must not report committed');
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('contains a terminated checked-out backend and replaces its unusable connection', async () => {
    const database = pool(1);
    const control = pool();
    let oldPid: number | undefined;
    await expect(
      database.transaction(async (tx) => {
        oldPid = (await tx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
        await control.query('SELECT pg_terminate_backend($1)', [oldPid]);
        // Give the socket's error event a turn while this transaction still owns the client.
        await new Promise((resolve) => setTimeout(resolve, 25));
        await tx.query('SELECT 1');
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
    expect(
      (await database.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid,
    ).not.toBe(oldPid);
  });

  it('closes idempotently and rejects all subsequent operations', async () => {
    const database = pool();
    await database.query('SELECT 1');
    await Promise.all([database.close(), database.close()]);
    await expect(database.query('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    await expect(database.exec('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    await expect(database.transaction(() => Promise.resolve(1))).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });
});

describe('PostgreSQL configuration', () => {
  const remote = 'postgresql://synthetic:synthetic@db.example.invalid/lessonquest';
  it('enforces certificates and bounded connections without connecting', () => {
    const config = postgresPoolConfig({
      connectionString: `${remote}?sslmode=require&channel_binding=prefer`,
    });
    expect(config).toMatchObject({
      host: 'db.example.invalid',
      database: 'lessonquest',
      ssl: { rejectUnauthorized: true },
      max: 5,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 15000,
      application_name: 'LessonQuest',
      enableChannelBinding: true,
    });
    expect(config).not.toHaveProperty('connectionString');
  });
  it.each([
    '',
    'not a URL',
    'postgresql://db.example.invalid/lessonquest',
    'postgresql://synthetic@db.example.invalid/lessonquest',
    'postgresql://synthetic:synthetic@localhost/lessonquest',
    'postgresql://synthetic:synthetic@127.0.0.1/lessonquest',
    'postgresql://synthetic:synthetic@[::1]/lessonquest',
    'postgresql://synthetic:synthetic@db.example.invalid/',
    `${remote}?sslmode=disable`,
    `${remote}?sslmode=no-verify`,
    `${remote}?sslmode=require&sslmode=disable`,
    `${remote}?sslcert=/tmp/cert`,
    `${remote}?host=/tmp`,
    `${remote}?options=-c%20search_path=other`,
    `${remote}?channel_binding=require`,
    `${remote}#fragment`,
  ])('rejects unsafe production configuration %#', (connectionString) => {
    expect(() => new PostgresDatabase({ connectionString })).toThrow(
      'Invalid PostgreSQL configuration',
    );
  });
  it.each([0, 11, 1.5, Number.NaN])('rejects pool size %s', (max) => {
    expect(() => new PostgresDatabase({ connectionString: remote, max })).toThrow(
      'Invalid PostgreSQL configuration',
    );
  });
  it('restricts test mode to its local synthetic database naming boundary', () => {
    expect(() => new PostgresDatabase({ connectionString: remote, mode: 'test' })).toThrow(
      'Invalid PostgreSQL configuration',
    );
    expect(
      () =>
        new PostgresDatabase({
          connectionString: 'postgresql://test:test@127.0.0.1/real_database',
          mode: 'test',
        }),
    ).toThrow('Invalid PostgreSQL configuration');
  });
});

const input = () => ({
  mutationId: randomUUID(),
  title: '힘과 운동 수업',
  gradeBand: 'middle1' as const,
  learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
  learningObjectives: ['힘과 질량의 관계를 설명한다.'],
});

async function teacherFixture() {
  const database = pool();
  const tenants = new TenantRepository(database);
  const teacher: Actor = { userId: randomUUID(), platformRole: 'TEACHER', memberships: [] };
  await tenants.upsertUser(teacher);
  const organization = await tenants.createOrganization(teacher, '합성 학교');
  teacher.memberships.push({ organizationId: organization.id, role: 'ORG_ADMIN' });
  return { database, teacher, organization, inputs: new LessonInputRepository(database) };
}

describe('real PostgreSQL teacher repositories', () => {
  beforeAll(async () => {
    const database = pool();
    await initializeSchema(database);
  });
  it('stores lesson inputs across pool recreation with tenant isolation', async () => {
    const f = await teacherFixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, input());
    await f.database.close();
    const reader = new LessonInputRepository(pool());
    expect(await reader.get(f.teacher, f.organization.id, created.lessonInput.id)).toEqual(
      created.lessonInput,
    );
    const other = await teacherFixture();
    await expect(
      reader.get(other.teacher, f.organization.id, created.lessonInput.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      reader.get(f.teacher, other.organization.id, created.lessonInput.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('returns one result and one duplicate for overlapping identical creates', async () => {
    const f = await teacherFixture();
    const value = input();
    const other = pool();
    await other.query('SELECT 1');
    // Keep inserts overlapping after both requests read the mutation ledger.
    // This delay belongs only to the invocation-owned test database.
    await f.database.exec(
      `CREATE FUNCTION test_delay_lesson_insert() RETURNS trigger AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER test_delay_lesson_insert BEFORE INSERT ON lesson_inputs FOR EACH ROW EXECUTE FUNCTION test_delay_lesson_insert();`,
    );
    try {
      const results = await Promise.all([
        f.inputs.create(f.teacher, f.organization.id, value),
        new LessonInputRepository(other).create(f.teacher, f.organization.id, value),
      ]);
      expect(results[0]?.lessonInput.id).toBe(results[1]?.lessonInput.id);
      expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
      expect(await f.inputs.list(f.teacher, f.organization.id)).toHaveLength(1);
    } finally {
      await f.database.exec(
        'DROP TRIGGER test_delay_lesson_insert ON lesson_inputs; DROP FUNCTION test_delay_lesson_insert()',
      );
    }
  });

  it('replays identical concurrent updates once, including their ledger result', async () => {
    const f = await teacherFixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, input());
    const other = pool();
    await other.query('SELECT 1');
    const change = { ...input(), expectedRevision: 1, title: '한 번만 수정' };
    const results = await Promise.all([
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, change),
      new LessonInputRepository(other).update(
        f.teacher,
        f.organization.id,
        created.lessonInput.id,
        change,
      ),
    ]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
    expect(results[0]?.lessonInput).toEqual(results[1]?.lessonInput);
    expect(
      (await f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id)).revision,
    ).toBe(2);
  });

  it('accepts one of two competing revisions and preserves a conflict domain error', async () => {
    const f = await teacherFixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, input());
    const results = await Promise.allSettled([
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, {
        ...input(),
        title: '수정 하나',
        expectedRevision: 1,
      }),
      new LessonInputRepository(pool()).update(
        f.teacher,
        f.organization.id,
        created.lessonInput.id,
        { ...input(), title: '수정 둘', expectedRevision: 1 },
      ),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictError);
    expect(
      (await f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id)).revision,
    ).toBe(2);
  });

  it('rechecks approved identity status, platform role and current organization membership', async () => {
    const f = await teacherFixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, input());
    const uid = `synthetic_${randomUUID()}`;
    await f.database.query(
      'INSERT INTO firebase_identities (project_id, uid, user_id) VALUES ($1, $2, $3)',
      ['lessonquest-df4b0', uid, f.teacher.userId],
    );
    const identities = new FirebaseIdentityRepository(pool());
    expect(await identities.findActor('lessonquest-df4b0', uid)).toEqual(f.teacher);
    expect(await identities.findActor('other-project', uid)).toBeNull();
    await f.database.query("UPDATE users SET platform_role = 'STUDENT' WHERE id = $1", [
      f.teacher.userId,
    ]);
    expect(await identities.findActor('lessonquest-df4b0', uid)).toMatchObject({
      platformRole: 'STUDENT',
      memberships: [],
    });
    await expect(
      f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await f.database.query(
      "UPDATE users SET platform_role = 'TEACHER', status = 'DISABLED' WHERE id = $1",
      [f.teacher.userId],
    );
    expect(await identities.findActor('lessonquest-df4b0', uid)).toBeNull();
    await expect(
      f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('rolls back the lesson and mutation when its success audit cannot be written', async () => {
    const f = await teacherFixture();
    const mutation = input();
    await f.database.exec(
      `CREATE FUNCTION test_reject_lesson_audit() RETURNS trigger AS $$ BEGIN IF NEW.action = 'LESSON_INPUT_CREATED' THEN RAISE EXCEPTION 'synthetic audit unavailable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER test_reject_lesson_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_lesson_audit();`,
    );
    try {
      await expect(f.inputs.create(f.teacher, f.organization.id, mutation)).rejects.toBeInstanceOf(
        LessonInputPersistenceError,
      );
      expect(
        (
          await f.database.query('SELECT id FROM lesson_inputs WHERE organization_id = $1', [
            f.organization.id,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await f.database.query(
            'SELECT mutation_id FROM lesson_input_mutations WHERE mutation_id = $1',
            [mutation.mutationId],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await f.database.exec(
        'DROP TRIGGER test_reject_lesson_audit ON audit_logs; DROP FUNCTION test_reject_lesson_audit()',
      );
    }
  });
});
