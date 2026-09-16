import { randomUUID } from 'node:crypto';
import { initialSchemaSql, initialSchemaChecksum } from './migrations/0001.js';
import type { SqlDatabase } from './sql.js';
import {
  ProvisioningError,
  hash,
  readTables,
  insertTables,
  inventory,
  requireVersion,
  requireOwner,
  requireSafeRuntimeRole,
  requireRuntimeGrants,
} from './provisioning-validation.js';

export async function migrateLessonQuest(
  database: SqlDatabase,
  runtimeRole: string,
): Promise<{ status: 'applied' | 'unchanged'; version: 1 }> {
  try {
    return await database.transaction(async (tx) => {
      await tx.query(
        "SELECT pg_catalog.pg_advisory_xact_lock(hashtextextended('lessonquest:migrations',0))",
      );
      const owner = (await tx.query<{ owner: string }>('SELECT current_user AS owner')).rows[0]!
        .owner;
      await requireSafeRuntimeRole(tx, runtimeRole, owner);
      if (hash(initialSchemaSql) !== initialSchemaChecksum) throw new ProvisioningError();
      const exists = await tx.query(
        "SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='lessonquest'",
      );
      if (exists.rows.length) {
        await requireOwner(tx);
        if ((await requireVersion(tx)) !== runtimeRole) throw new ProvisioningError();
        await requireRuntimeGrants(tx, runtimeRole, owner);
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
      await requireRuntimeGrants(tx, runtimeRole, owner);
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
      const owner = await requireOwner(tx);
      const runtimeRole = await requireVersion(tx);
      await requireSafeRuntimeRole(tx, runtimeRole, owner);
      await requireRuntimeGrants(tx, runtimeRole, owner);
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
