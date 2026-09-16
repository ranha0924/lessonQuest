// Structural boundary shared by PGlite previews and the server PostgreSQL adapter.
export interface SqlQueryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SqlTransaction extends SqlQueryable {
  exec(sql: string): Promise<unknown>;
}

export interface SqlDatabase extends SqlQueryable {
  transaction<T>(operation: (transaction: SqlTransaction) => Promise<T>): Promise<T>;
}
