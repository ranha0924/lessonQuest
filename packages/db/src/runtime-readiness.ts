import type { SqlQueryable } from './sql.js';
import { requireRuntimeGrants, requireVersion } from './provisioning-validation.js';
export async function requireRuntimeReadiness(database: SqlQueryable): Promise<void> {
  try {
    const identity = await database.query<{ login: string; owner: string }>(
      "SELECT current_user AS login,pg_catalog.pg_get_userbyid(nspowner) AS owner FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'",
    );
    const row = identity.rows[0];
    if (!row || row.login === row.owner) throw new Error();
    const role = await requireVersion(database);
    if (row.login !== role) throw new Error();
    await requireRuntimeGrants(database, role, row.owner);
  } catch {
    throw new Error('Runtime storage is unavailable');
  }
}
