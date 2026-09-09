import { createHash } from 'node:crypto';
import { initialSchemaChecksum } from './migrations/0001.js';
import type { SqlQueryable } from './sql.js';
export class ProvisioningError extends Error {
  constructor() {
    super('Provisioning failed');
    this.name = 'ProvisioningError';
  }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const readTables = [
  'users',
  'firebase_identities',
  'organizations',
  'organization_members',
  'schema_migrations',
];
export const insertTables = ['lesson_input_mutations', 'audit_logs'];
export const writeTables = ['lesson_inputs'];

export async function inventory(tx: SqlQueryable): Promise<string> {
  const result = await tx.query<{ item: string }>(`
    SELECT 'relation:'||relkind::text||':'||relname AS item FROM pg_catalog.pg_class
      WHERE relnamespace='lessonquest'::regnamespace
    UNION ALL SELECT 'function:'||proname||':'||pg_catalog.pg_get_function_identity_arguments(oid)
      FROM pg_catalog.pg_proc WHERE pronamespace='lessonquest'::regnamespace
    UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='lessonquest'::regnamespace AND NOT t.tgisinternal
    ORDER BY item`);
  return hash(JSON.stringify(result.rows));
}
export async function requireVersion(tx: SqlQueryable): Promise<string> {
  const result = await tx.query<{
    version: number;
    checksum: string;
    inventory_hash: string;
    runtime_role: string;
  }>(
    'SELECT version,checksum,inventory_hash,runtime_role FROM lessonquest.schema_migrations ORDER BY version',
  );
  if (
    result.rows.length !== 1 ||
    result.rows[0]?.version !== 1 ||
    result.rows[0].checksum !== initialSchemaChecksum ||
    result.rows[0].inventory_hash !== (await inventory(tx)) ||
    typeof result.rows[0].runtime_role !== 'string'
  )
    throw new ProvisioningError();
  return result.rows[0].runtime_role;
}
export async function requireOwner(tx: SqlQueryable): Promise<string> {
  const result = await tx.query<{ owned: boolean; owner: string }>(
    "SELECT nspowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) AS owned, pg_catalog.pg_get_userbyid(nspowner) AS owner FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'",
  );
  if (result.rows[0]?.owned !== true) throw new ProvisioningError();
  return result.rows[0].owner;
}
export async function requireSafeRuntimeRole(
  tx: SqlQueryable,
  role: string,
  owner: string,
): Promise<void> {
  if (typeof role !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(role))
    throw new ProvisioningError();
  const result = await tx.query<{ safe: boolean }>(
    `SELECT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND NOT rolreplication
    AND rolname<>$2 AND NOT pg_catalog.pg_has_role(oid,$2::name,'MEMBER')
    AND oid<>(SELECT datdba FROM pg_catalog.pg_database WHERE datname=current_database())
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid)
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=r.oid
      AND member<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$2)) AS safe
    FROM pg_catalog.pg_roles r WHERE rolname=$1`,
    [role, owner],
  );
  if (result.rows[0]?.safe !== true) throw new ProvisioningError();
}
async function requireExactAcl(tx: SqlQueryable, role: string, owner: string): Promise<void> {
  const unexpected = await tx.query(
    `
    WITH expected AS (
      SELECT (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$5) AS owner,
             (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1) AS runtime
    ), table_objects AS (
      SELECT c.oid,c.relowner AS owner,c.relacl AS acl,c.relkind,
        CASE WHEN c.relname=ANY($4::text[]) THEN ARRAY['SELECT','INSERT','UPDATE']
          WHEN c.relname=ANY($3::text[]) THEN ARRAY['SELECT','INSERT']
          WHEN c.relname=ANY($2::text[]) THEN ARRAY['SELECT'] ELSE ARRAY[]::text[] END AS allowed
      FROM pg_catalog.pg_class c WHERE c.relnamespace='lessonquest'::regnamespace AND c.relkind IN ('r','p','S')
    ), objects AS (
      SELECT nspowner AS owner,COALESCE(nspacl,acldefault('n',nspowner)) AS acl,ARRAY['USAGE'] AS allowed
        FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'
      UNION ALL SELECT owner,COALESCE(acl,acldefault(CASE WHEN relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,owner)),
        CASE WHEN relkind='S' THEN ARRAY[]::text[] ELSE allowed END FROM table_objects
      UNION ALL SELECT t.owner,COALESCE(a.attacl,ARRAY[]::aclitem[]),t.allowed FROM pg_catalog.pg_attribute a
        JOIN table_objects t ON t.oid=a.attrelid WHERE a.attnum>0 AND NOT a.attisdropped
      UNION ALL SELECT proowner,COALESCE(proacl,acldefault('f',proowner)),ARRAY[]::text[]
        FROM pg_catalog.pg_proc WHERE pronamespace='lessonquest'::regnamespace
    )
    SELECT 1 FROM objects o CROSS JOIN expected e LEFT JOIN LATERAL aclexplode(CASE WHEN cardinality(o.acl)>0 THEN o.acl ELSE NULL END) a ON true
    WHERE o.owner<>e.owner OR (a.grantee IS NOT NULL AND (
      a.grantor<>e.owner OR (a.grantee<>e.owner AND (
        a.grantee<>e.runtime OR a.is_grantable OR NOT a.privilege_type=ANY(o.allowed)
      ))
    )) LIMIT 1`,
    [role, readTables, insertTables, writeTables, owner],
  );
  if (unexpected.rows.length !== 0) throw new ProvisioningError();
}

export async function requireRuntimeGrants(
  tx: SqlQueryable,
  role: string,
  owner: string,
): Promise<void> {
  await requireSafeRuntimeRole(tx, role, owner);
  await requireExactAcl(tx, role, owner);
  const schema = await tx.query<{ usage: boolean; create: boolean }>(
    "SELECT has_schema_privilege($1,'lessonquest','USAGE') AS usage,has_schema_privilege($1,'lessonquest','CREATE') AS create",
    [role],
  );
  if (schema.rows[0]?.usage !== true || schema.rows[0].create !== false)
    throw new ProvisioningError();
  const mismatch = await tx.query(
    `
    WITH tables AS (
      SELECT oid, CASE WHEN relname=ANY($4::text[]) THEN ARRAY['SELECT','INSERT','UPDATE']
        WHEN relname=ANY($3::text[]) THEN ARRAY['SELECT','INSERT']
        WHEN relname=ANY($2::text[]) THEN ARRAY['SELECT'] ELSE ARRAY[]::text[] END AS expected
      FROM pg_catalog.pg_class WHERE relnamespace='lessonquest'::regnamespace AND relkind IN ('r','p')
    )
    SELECT 1 FROM tables t CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(privilege)
    WHERE has_table_privilege($1,t.oid,p.privilege) IS DISTINCT FROM (p.privilege=ANY(t.expected))
       OR CASE WHEN p.privilege IN ('SELECT','INSERT','UPDATE','REFERENCES')
          THEN has_any_column_privilege($1,t.oid,p.privilege) IS DISTINCT FROM (p.privilege=ANY(t.expected)) ELSE false END
    LIMIT 1`,
    [role, readTables, insertTables, writeTables],
  );
  if (mismatch.rows.length !== 0) throw new ProvisioningError();
  const functions = await tx.query(
    "SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='lessonquest'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",
    [role],
  );
  if (functions.rows.length !== 0) throw new ProvisioningError();
}
