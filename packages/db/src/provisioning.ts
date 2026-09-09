import { createHash, randomUUID } from 'node:crypto';
import { initialSchemaSql, initialSchemaChecksum } from './migrations/0001.js';
import type { SqlDatabase, SqlTransaction } from './sql.js';

class ProvisioningError extends Error {
  constructor() {
    super('Provisioning failed');
    this.name = 'ProvisioningError';
  }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const readTables = [
  'users',
  'firebase_identities',
  'organizations',
  'organization_members',
  'schema_migrations',
];
const insertTables = ['lesson_input_mutations', 'audit_logs'];
const writeTables = ['lesson_inputs'];

async function inventory(tx: SqlTransaction): Promise<string> {
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
async function requireVersion(tx: SqlTransaction): Promise<string> {
  if (hash(initialSchemaSql) !== initialSchemaChecksum) throw new ProvisioningError();
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
async function requireOwner(tx: SqlTransaction): Promise<void> {
  const result = await tx.query<{ owned: boolean }>(
    "SELECT nspowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) AS owned FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'",
  );
  if (result.rows[0]?.owned !== true) throw new ProvisioningError();
}
async function requireSafeRuntimeRole(tx: SqlTransaction, role: string): Promise<void> {
  if (typeof role !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(role))
    throw new ProvisioningError();
  const result = await tx.query<{ safe: boolean }>(
    `SELECT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND NOT rolreplication
    AND rolname<>current_user AND NOT pg_catalog.pg_has_role(oid,current_user,'MEMBER')
    AND oid<>(SELECT datdba FROM pg_catalog.pg_database WHERE datname=current_database())
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid)
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=r.oid
      AND member<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user)) AS safe
    FROM pg_catalog.pg_roles r WHERE rolname=$1`,
    [role],
  );
  if (result.rows[0]?.safe !== true) throw new ProvisioningError();
}
async function requireExactAcl(tx: SqlTransaction, role: string): Promise<void> {
  const unexpected = await tx.query(
    `
    WITH expected AS (
      SELECT (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user) AS owner,
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
    [role, readTables, insertTables, writeTables],
  );
  if (unexpected.rows.length !== 0) throw new ProvisioningError();
}

async function requireRuntimeGrants(tx: SqlTransaction, role: string): Promise<void> {
  await requireSafeRuntimeRole(tx, role);
  await requireExactAcl(tx, role);
  const schema = await tx.query<{ usage: boolean; create: boolean }>(
    "SELECT has_schema_privilege($1,'lessonquest','USAGE') AS usage,has_schema_privilege($1,'lessonquest','CREATE') AS create",
    [role],
  );
  if (schema.rows[0]?.usage !== true || schema.rows[0].create !== false)
    throw new ProvisioningError();
  const tables = await tx.query<{ name: string; oid: number }>(
    "SELECT relname AS name,oid FROM pg_catalog.pg_class WHERE relnamespace='lessonquest'::regnamespace AND relkind IN ('r','p')",
  );
  for (const table of tables.rows) {
    const expected = new Set(
      writeTables.includes(table.name)
        ? ['SELECT', 'INSERT', 'UPDATE']
        : insertTables.includes(table.name)
          ? ['SELECT', 'INSERT']
          : readTables.includes(table.name)
            ? ['SELECT']
            : [],
    );
    for (const privilege of [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
    ]) {
      const result = await tx.query<{ allowed: boolean }>(
        'SELECT has_table_privilege($1,$2::oid,$3) AS allowed',
        [role, table.oid, privilege],
      );
      if (result.rows[0]?.allowed !== expected.has(privilege)) throw new ProvisioningError();
      if (['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'].includes(privilege)) {
        const columns = await tx.query<{ allowed: boolean }>(
          'SELECT has_any_column_privilege($1,$2::oid,$3) AS allowed',
          [role, table.oid, privilege],
        );
        if (columns.rows[0]?.allowed !== expected.has(privilege)) throw new ProvisioningError();
      }
    }
  }
  const functions = await tx.query(
    "SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='lessonquest'::regnamespace AND has_function_privilege($1,oid,'EXECUTE')",
    [role],
  );
  if (functions.rows.length !== 0) throw new ProvisioningError();
}

export async function migrateLessonQuest(
  database: SqlDatabase,
  runtimeRole: string,
): Promise<{ status: 'applied' | 'unchanged'; version: 1 }> {
  try {
    return await database.transaction(async (tx) => {
      await tx.query(
        "SELECT pg_catalog.pg_advisory_xact_lock(hashtextextended('lessonquest:migrations',0))",
      );
      await requireSafeRuntimeRole(tx, runtimeRole);
      if (hash(initialSchemaSql) !== initialSchemaChecksum) throw new ProvisioningError();
      const exists = await tx.query(
        "SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'",
      );
      if (exists.rows.length) {
        await requireOwner(tx);
        if ((await requireVersion(tx)) !== runtimeRole) throw new ProvisioningError();
        await requireRuntimeGrants(tx, runtimeRole);
        return { status: 'unchanged', version: 1 };
      }
      await tx.exec(
        'CREATE SCHEMA lessonquest; REVOKE ALL ON SCHEMA lessonquest FROM PUBLIC; SET LOCAL search_path=lessonquest,pg_catalog',
      );
      await tx.exec(initialSchemaSql);
      await tx.exec(`CREATE TABLE schema_migrations (version integer PRIMARY KEY,checksum text NOT NULL,inventory_hash text NOT NULL,runtime_role text NOT NULL,applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TRIGGER protect_schema_migrations BEFORE UPDATE OR DELETE ON schema_migrations FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
        REVOKE ALL ON ALL TABLES IN SCHEMA lessonquest FROM PUBLIC;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lessonquest FROM PUBLIC;`);
      // Role is validated ASCII and quoted. All content/identity values use parameters.
      await tx.exec(`GRANT USAGE ON SCHEMA lessonquest TO "${runtimeRole}";
        GRANT SELECT ON ${readTables.map((t) => `lessonquest.${t}`).join(',')} TO "${runtimeRole}";
        GRANT SELECT,INSERT ON ${insertTables.map((t) => `lessonquest.${t}`).join(',')} TO "${runtimeRole}";
        GRANT SELECT,INSERT,UPDATE ON lessonquest.lesson_inputs TO "${runtimeRole}";`);
      await tx.query(
        'INSERT INTO lessonquest.schema_migrations (version,checksum,inventory_hash,runtime_role) VALUES (1,$1,$2,$3)',
        [initialSchemaChecksum, await inventory(tx), runtimeRole],
      );
      await requireVersion(tx);
      await requireRuntimeGrants(tx, runtimeRole);
      return { status: 'applied', version: 1 };
    });
  } catch {
    throw new ProvisioningError();
  }
}

export async function bootstrapTeacher(
  database: SqlDatabase,
  input: { projectId: string; uid: string; organizationName: string },
): Promise<{ status: 'created' | 'unchanged'; userId: string; organizationId: string }> {
  try {
    if (
      typeof input.projectId !== 'string' ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(input.projectId) ||
      typeof input.uid !== 'string' ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.uid) ||
      typeof input.organizationName !== 'string' ||
      input.organizationName.trim() !== input.organizationName ||
      input.organizationName.length < 1 ||
      input.organizationName.length > 80 ||
      [...input.organizationName].some(
        (character) =>
          character.charCodeAt(0) < 32 ||
          (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159),
      )
    )
      throw new ProvisioningError();
    return await database.transaction(async (tx) => {
      await requireOwner(tx);
      const runtimeRole = await requireVersion(tx);
      await requireSafeRuntimeRole(tx, runtimeRole);
      await requireRuntimeGrants(tx, runtimeRole);
      await tx.exec('SET LOCAL search_path=lessonquest,pg_catalog');
      await tx.query('SELECT pg_catalog.pg_advisory_xact_lock(hashtextextended($1,0))', [
        `lessonquest:bootstrap:${input.projectId}:${input.uid}`,
      ]);
      const existing = await tx.query<{
        user_id: string;
        status: string;
        platform_role: string;
        user_status: string;
      }>(
        `SELECT f.user_id,f.status,u.platform_role,u.status AS user_status FROM firebase_identities f JOIN users u ON u.id=f.user_id WHERE f.project_id=$1 AND f.uid=$2`,
        [input.projectId, input.uid],
      );
      if (existing.rows.length) {
        const user = existing.rows[0]!;
        const owned = await tx.query<{
          id: string;
          name: string;
          status: string;
          role: string;
          member_status: string;
        }>(
          `SELECT o.id,o.name,o.status,m.role,m.status AS member_status FROM organizations o LEFT JOIN organization_members m ON m.organization_id=o.id AND m.user_id=$1 WHERE o.created_by=$1`,
          [user.user_id],
        );
        const org = owned.rows[0];
        const identities = await tx.query('SELECT 1 FROM firebase_identities WHERE user_id=$1', [
          user.user_id,
        ]);
        const members = await tx.query(
          'SELECT 1 FROM organization_members WHERE organization_id=$1',
          [org?.id ?? null],
        );
        const memberships = await tx.query('SELECT 1 FROM organization_members WHERE user_id=$1', [
          user.user_id,
        ]);
        if (
          user.status !== 'ACTIVE' ||
          user.user_status !== 'ACTIVE' ||
          user.platform_role !== 'TEACHER' ||
          owned.rows.length !== 1 ||
          memberships.rows.length !== 1 ||
          identities.rows.length !== 1 ||
          members.rows.length !== 1 ||
          org?.status !== 'ACTIVE' ||
          org.role !== 'TEACHER' ||
          org.member_status !== 'ACTIVE' ||
          org.name !== input.organizationName
        )
          throw new ProvisioningError();
        return { status: 'unchanged', userId: user.user_id, organizationId: org.id };
      }
      const userId = randomUUID(),
        organizationId = randomUUID();
      await tx.query("INSERT INTO users (id,platform_role) VALUES ($1,'TEACHER')", [userId]);
      await tx.query('INSERT INTO firebase_identities (project_id,uid,user_id) VALUES ($1,$2,$3)', [
        input.projectId,
        input.uid,
        userId,
      ]);
      await tx.query('INSERT INTO organizations (id,name,created_by) VALUES ($1,$2,$3)', [
        organizationId,
        input.organizationName,
        userId,
      ]);
      await tx.query(
        "INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'TEACHER')",
        [organizationId, userId],
      );
      return { status: 'created', userId, organizationId };
    });
  } catch {
    throw new ProvisioningError();
  }
}
