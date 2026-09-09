import { createApp } from '@lessonquest/api';
import { createServerHandler } from '../../../services/api/src/server-runtime.js';
import { FirebaseAuthProvider } from '../../auth/dist/firebase.js';
import { TenantRepository, LearningRepository, TeacherSessionRepository } from '@lessonquest/db';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresDatabase, postgresPoolConfig } from '../src/postgres.js';
import { migrateLessonQuest, bootstrapTeacher } from '../src/provisioning.js';
import { FirebaseIdentityRepository } from '../src/firebase-identity-repository.js';
import type { SqlDatabase } from '../src/sql.js';
import { LessonInputRepository } from '../src/lesson-input-repository.js';

import { requireRuntimeReadiness } from '../src/runtime-readiness.js';
import { initialSchemaSql, initialSchemaChecksum } from '../src/migrations/0001.js';

const projectId = 'lessonquest-test';
const uid = 'explicit-teacher-uid';
const organizationName = '교사의 수업 공간';
let admin: PostgresDatabase;
let role: string;
let password: string;
const pools: PostgresDatabase[] = [];
const extraRoles: string[] = [];
async function extraRole() {
  const name = `lq_extra_${randomBytes(6).toString('hex')}`;
  await admin.exec(`CREATE ROLE ${name} LOGIN`);
  extraRoles.push(name);
  return name;
}
function testUrl() {
  const value = process.env.LESSONQUEST_POSTGRES_TEST_URL;
  if (process.env.LESSONQUEST_POSTGRES_TEST !== 'owned-disposable' || !value)
    throw new Error('Owned disposable PostgreSQL required');
  const parsed = new URL(value);
  if (parsed.hostname !== '127.0.0.1' || !/^\/lessonquest_test_[a-f0-9]{24}$/.test(parsed.pathname))
    throw new Error('Refusing non-test target');
  return value;
}
function appPool() {
  const url = new URL(testUrl());
  url.username = role;
  url.password = password;
  const pool = new PostgresDatabase({
    connectionString: url.href,
    mode: 'test',
    schema: 'lessonquest',
  });
  pools.push(pool);
  return pool;
}
beforeEach(async () => {
  admin = new PostgresDatabase({ connectionString: testUrl(), mode: 'test' });
  role = `lq_app_${randomBytes(6).toString('hex')}`;
  password = randomBytes(24).toString('hex');
  // Only the harness-owned disposable schema/role can be cleaned up here.
  await admin.exec('DROP SCHEMA IF EXISTS lessonquest CASCADE');
  await admin.exec(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
});
afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.close()));
  await admin.exec('DROP SCHEMA IF EXISTS lessonquest CASCADE');
  await admin.exec(`DROP ROLE ${role}`);
  for (const name of extraRoles.splice(0)) {
    await admin.exec(
      `ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM ${name}; DROP ROLE ${name}`,
    );
  }
  await admin.close();
});

describe('dedicated versioned schema and explicit teacher provisioning', () => {
  it('selects only the dedicated schema and rejects injected/unknown schema options', () => {
    expect(
      postgresPoolConfig({ connectionString: testUrl(), mode: 'test', schema: 'lessonquest' })
        .options,
    ).toContain('search_path=lessonquest,pg_catalog');
    expect(() =>
      postgresPoolConfig({
        connectionString: testUrl(),
        mode: 'test',
        schema: 'public' as 'lessonquest',
      }),
    ).toThrow();
  });

  it('migrates once, repeats safely and leaves public objects unchanged', async () => {
    const before = (
      await admin.query(
        "SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname",
      )
    ).rows;
    expect(await migrateLessonQuest(admin, role)).toEqual({ status: 'applied', version: 1 });
    expect(await migrateLessonQuest(admin, role)).toEqual({ status: 'unchanged', version: 1 });
    expect(
      (
        await admin.query(
          "SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace ORDER BY relname",
        )
      ).rows,
    ).toEqual(before);
  });

  it('refuses an existing unversioned schema without changing it', async () => {
    await admin.exec(
      'CREATE SCHEMA lessonquest; CREATE TABLE lessonquest.keep_me (value int); INSERT INTO lessonquest.keep_me VALUES (7)',
    );
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    expect((await admin.query('SELECT * FROM lessonquest.keep_me')).rows).toEqual([{ value: 7 }]);
  });

  it('rejects unsafe roles before creating a schema', async () => {
    const current = (await admin.query<{ name: string }>('SELECT current_user AS name')).rows[0]!
      .name;
    for (const invalid of [current, 'missing_role', 'evil;DROP SCHEMA public'])
      await expect(migrateLessonQuest(admin, invalid)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='lessonquest'")).rows,
    ).toEqual([]);
  });

  it('detects missing objects and rejects repeated migration without repairing them', async () => {
    await migrateLessonQuest(admin, role);
    await admin.exec('DROP TABLE lessonquest.lesson_input_mutations');
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query("SELECT to_regclass('lessonquest.lesson_input_mutations') AS name")).rows,
    ).toEqual([{ name: null }]);
  });

  it('detects altered ledger and keeps it unchanged on failure', async () => {
    await migrateLessonQuest(admin, role);
    await admin.exec(
      "ALTER TABLE lessonquest.schema_migrations DISABLE TRIGGER USER; UPDATE lessonquest.schema_migrations SET checksum='tampered'; ALTER TABLE lessonquest.schema_migrations ENABLE TRIGGER USER",
    );
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    expect((await admin.query('SELECT checksum FROM lessonquest.schema_migrations')).rows).toEqual([
      { checksum: 'tampered' },
    ]);
  });

  it('boots exactly the explicit teacher into a private organization, idempotently under concurrency', async () => {
    await migrateLessonQuest(admin, role);
    const second = new PostgresDatabase({ connectionString: testUrl(), mode: 'test' });
    pools.push(second);
    const results = await Promise.all(
      [admin, second].map((db) => bootstrapTeacher(db, { projectId, uid, organizationName })),
    );
    expect(results.map((r) => r.status).sort()).toEqual(['created', 'unchanged']);
    expect(results[0]!.userId).toBe(results[1]!.userId);
    expect(results[0]!.organizationId).toBe(results[1]!.organizationId);
    const actor = await new FirebaseIdentityRepository(appPool()).findActor(projectId, uid);
    expect(actor).toEqual({
      userId: results[0]!.userId,
      platformRole: 'TEACHER',
      memberships: [{ organizationId: results[0]!.organizationId, role: 'TEACHER' }],
    });
    expect(
      await new FirebaseIdentityRepository(appPool()).findActor(projectId, 'unapproved'),
    ).toBeNull();
  });

  it('does not repair disabled or inconsistent teacher registration', async () => {
    await migrateLessonQuest(admin, role);
    const created = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    await admin.query("UPDATE lessonquest.users SET status='DISABLED' WHERE id=$1", [
      created.userId,
    ]);
    await expect(bootstrapTeacher(admin, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
    await admin.query(
      "UPDATE lessonquest.users SET status='ACTIVE',platform_role='SUPER_ADMIN' WHERE id=$1",
      [created.userId],
    );
    await expect(bootstrapTeacher(admin, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
  });

  it('persists F01 across restricted app pools without allowing authority, audit or schema writes', async () => {
    await migrateLessonQuest(admin, role);
    const registered = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const db = appPool();
    const actor = (await new FirebaseIdentityRepository(db).findActor(projectId, uid))!;
    const input = {
      mutationId: randomUUID(),
      title: '힘과 운동',
      gradeBand: 'middle1' as const,
      learningContent: '힘은 물체의 운동을 바꿉니다.',
      learningObjectives: ['힘의 효과를 설명한다.'],
    };
    const created = await new LessonInputRepository(db).create(
      actor,
      registered.organizationId,
      input,
      randomUUID(),
    );
    await db.close();
    const fresh = appPool();
    expect(
      (
        await new LessonInputRepository(fresh).get(
          actor,
          registered.organizationId,
          created.lessonInput.id,
          randomUUID(),
        )
      ).revision,
    ).toBe(1);
    await new LessonInputRepository(fresh).update(
      actor,
      registered.organizationId,
      created.lessonInput.id,
      { ...input, mutationId: randomUUID(), expectedRevision: 1, title: '수정한 제목' },
      randomUUID(),
    );
    for (const sql of [
      "UPDATE users SET platform_role='SUPER_ADMIN'",
      "UPDATE organization_members SET role='ORG_ADMIN'",
      'DELETE FROM firebase_identities',
      'DELETE FROM audit_logs',
      'UPDATE schema_migrations SET version=2',
      'CREATE TABLE forbidden (id int)',
      'ALTER TABLE lesson_inputs DISABLE TRIGGER ALL',
      'DELETE FROM lesson_inputs',
    ])
      await expect(fresh.exec(sql)).rejects.toThrow();
    expect(
      (
        await new LessonInputRepository(fresh).get(
          actor,
          registered.organizationId,
          created.lessonInput.id,
          randomUUID(),
        )
      ).revision,
    ).toBe(2);
  });

  it('rechecks authority after waiting for a lesson row lock', async () => {
    await migrateLessonQuest(admin, role);
    const registered = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const db = appPool();
    const actor = (await new FirebaseIdentityRepository(db).findActor(projectId, uid))!;
    const input = {
      mutationId: randomUUID(),
      title: 'Original',
      gradeBand: 'middle1' as const,
      learningContent: 'Synthetic lesson',
      learningObjectives: ['Describe force'],
    };
    const repo = new LessonInputRepository(db);
    const created = await repo.create(actor, registered.organizationId, input, randomUUID());
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => {
      locked = r;
    });
    const unblock = new Promise<void>((r) => {
      release = r;
    });
    const holding = admin.transaction(async (tx) => {
      await tx.query('SELECT id FROM lessonquest.lesson_inputs WHERE id=$1 FOR UPDATE', [
        created.lessonInput.id,
      ]);
      locked();
      await unblock;
    });
    await ready;
    const updating = repo
      .update(
        actor,
        registered.organizationId,
        created.lessonInput.id,
        { ...input, mutationId: randomUUID(), expectedRevision: 1, title: 'Forbidden update' },
        randomUUID(),
      )
      .then(
        (value) => ({ ok: true, value }),
        () => ({ ok: false }),
      );
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        waiting =
          (
            await admin.query(
              "SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",
              [role],
            )
          ).rows.length > 0;
        if (waiting) break;
        await new Promise((r) => setTimeout(r, 5));
      }
      expect(waiting).toBe(true);
      await admin.query(
        "UPDATE lessonquest.organization_members SET status='DISABLED' WHERE user_id=$1",
        [actor.userId],
      );
    } finally {
      release();
      await holding;
    }
    expect(await updating).toEqual({ ok: false });
    expect(
      (
        await admin.query('SELECT title,revision FROM lessonquest.lesson_inputs WHERE id=$1', [
          created.lessonInput.id,
        ])
      ).rows,
    ).toEqual([{ title: 'Original', revision: 1 }]);
  });

  it('rechecks current membership after waiting for teacher mutation serialization', async () => {
    await migrateLessonQuest(admin, role);
    const registered = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const db = appPool();
    const actor = (await new FirebaseIdentityRepository(db).findActor(projectId, uid))!;
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holding = admin.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `lessonquest:lesson-input:${registered.organizationId}:${actor.userId}`,
      ]);
      locked();
      await unblock;
    });
    await ready;
    const creating = new LessonInputRepository(db)
      .create(
        actor,
        registered.organizationId,
        {
          mutationId: randomUUID(),
          title: 'Blocked create',
          gradeBand: 'middle1',
          learningContent: 'Synthetic',
          learningObjectives: ['Describe force'],
        },
        randomUUID(),
      )
      .then(
        () => true,
        () => false,
      );
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        waiting =
          (
            await admin.query(
              "SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",
              [role],
            )
          ).rows.length > 0;
        if (waiting) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(waiting).toBe(true);
      await admin.query(
        "UPDATE lessonquest.organization_members SET role='STUDENT' WHERE user_id=$1",
        [actor.userId],
      );
    } finally {
      release();
      await holding;
    }
    expect(await creating).toBe(false);
    expect((await admin.query('SELECT 1 FROM lessonquest.lesson_inputs')).rows).toEqual([]);
  });

  it('pins the initial schema snapshot', () => {
    expect(initialSchemaChecksum).toBe(
      'fe33dd42c4e38abafe3cb92acd09f56a9b7e9d336105eac1effa8e8bbddb1125',
    );
    expect(createHash('sha256').update(initialSchemaSql).digest('hex')).toBe(initialSchemaChecksum);
  });

  it('rolls back schema creation and grants together on initialization failure', async () => {
    const failing: SqlDatabase = {
      query: admin.query.bind(admin),
      transaction: (operation) =>
        admin.transaction((tx) =>
          operation({
            query: tx.query.bind(tx),
            exec: (sql) => {
              if (sql.includes('GRANT USAGE'))
                return Promise.reject(new Error('Synthetic grant failure'));
              return tx.exec(sql);
            },
          }),
        ),
    };
    await expect(migrateLessonQuest(failing, role)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='lessonquest'")).rows,
    ).toEqual([]);
    expect(await migrateLessonQuest(admin, role)).toMatchObject({ status: 'applied' });
  });

  it('rolls back an incomplete teacher bootstrap and forbids runtime bootstrap', async () => {
    await migrateLessonQuest(admin, role);
    const failing: SqlDatabase = {
      query: admin.query.bind(admin),
      transaction: (operation) =>
        admin.transaction((tx) =>
          operation({
            exec: tx.exec.bind(tx),
            query: (sql, params) => {
              if (sql.includes('INSERT INTO organizations'))
                return Promise.reject(new Error('Synthetic bootstrap failure'));
              return tx.query(sql, params);
            },
          }),
        ),
    };
    await expect(bootstrapTeacher(failing, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
    expect((await admin.query('SELECT 1 FROM lessonquest.users')).rows).toEqual([]);
    expect((await admin.query('SELECT 1 FROM lessonquest.firebase_identities')).rows).toEqual([]);
    await expect(bootstrapTeacher(appPool(), { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
  });

  it('rejects role escalation and inherited membership before granting access', async () => {
    await admin.exec(`ALTER ROLE ${role} CREATEROLE`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    await admin.exec(`ALTER ROLE ${role} NOCREATEROLE; GRANT pg_read_all_data TO ${role}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    await admin.exec(`REVOKE pg_read_all_data FROM ${role}`);
    expect(
      (await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='lessonquest'")).rows,
    ).toEqual([]);
  });

  it('serializes duplicate creates across restricted app pools', async () => {
    await migrateLessonQuest(admin, role);
    const registered = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const first = appPool(),
      second = appPool();
    const actor = (await new FirebaseIdentityRepository(first).findActor(projectId, uid))!;
    await admin.exec(
      'CREATE FUNCTION lessonquest.delay_insert() RETURNS trigger AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END $$ LANGUAGE plpgsql; CREATE TRIGGER delay_input BEFORE INSERT ON lessonquest.lesson_inputs FOR EACH ROW EXECUTE FUNCTION lessonquest.delay_insert()',
    );
    const input = {
      mutationId: randomUUID(),
      title: 'Duplicate',
      gradeBand: 'middle1' as const,
      learningContent: 'Synthetic lesson',
      learningObjectives: ['Describe force'],
    };
    const results = await Promise.all(
      [first, second].map((db) =>
        new LessonInputRepository(db).create(actor, registered.organizationId, input, randomUUID()),
      ),
    );
    expect(results.map((r) => r.duplicate).sort()).toEqual([false, true]);
    expect(results[0]!.lessonInput.id).toBe(results[1]!.lessonInput.id);
    expect((await admin.query('SELECT 1 FROM lessonquest.lesson_inputs')).rows).toHaveLength(1);
  });

  it('rejects invalid explicit identity inputs without provisioning rows', async () => {
    await migrateLessonQuest(admin, role);
    for (const input of [
      { projectId: 'wrong/project', uid, organizationName },
      { projectId, uid: 'uid;sql', organizationName },
      { projectId, uid, organizationName: ' ' },
      { projectId, uid, organizationName: 'x'.repeat(81) },
    ])
      await expect(bootstrapTeacher(admin, input)).rejects.toThrow('Provisioning failed');
    expect((await admin.query('SELECT 1 FROM lessonquest.users')).rows).toEqual([]);
  });

  it('rejects PUBLIC exposure even when runtime effective privileges are unchanged', async () => {
    await migrateLessonQuest(admin, role);
    await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const outsider = await extraRole();
    await admin.exec(
      'GRANT USAGE ON SCHEMA lessonquest TO PUBLIC; GRANT SELECT ON lessonquest.lesson_inputs TO PUBLIC',
    );
    expect(
      (
        await admin.query<{ readable: boolean }>(
          "SELECT has_schema_privilege($1,'lessonquest','USAGE') AND has_table_privilege($1,'lessonquest.lesson_inputs','SELECT') AS readable",
          [outsider],
        )
      ).rows[0]?.readable,
    ).toBe(true);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    await expect(
      bootstrapTeacher(admin, { projectId, uid: 'next-explicit-teacher', organizationName }),
    ).rejects.toThrow('Provisioning failed');
    expect((await admin.query('SELECT 1 FROM lessonquest.users')).rows).toHaveLength(1);
  });

  it.each(['UPDATE', 'UPDATE (title)'])(
    'rejects runtime delegation through %s grant options',
    async (privilege) => {
      await migrateLessonQuest(admin, role);
      await admin.exec(
        `GRANT ${privilege} ON lessonquest.lesson_inputs TO ${role} WITH GRANT OPTION`,
      );
      await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    },
  );

  it('rejects other-principal ACLs and rolls back inherited owner defaults', async () => {
    const outsider = await extraRole();
    await admin.exec(`ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO ${outsider}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='lessonquest'")).rows,
    ).toEqual([]);
  });

  it('rejects ownership drift', async () => {
    await migrateLessonQuest(admin, role);
    const outsider = await extraRole();
    await admin.exec(`ALTER TABLE lessonquest.lesson_inputs OWNER TO ${outsider}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
  });

  it('refuses bootstrap repetition after an additional private-space member appears', async () => {
    await migrateLessonQuest(admin, role);
    const created = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    const other = randomUUID();
    await admin.query("INSERT INTO lessonquest.users (id,platform_role) VALUES ($1,'TEACHER')", [
      other,
    ]);
    await admin.query(
      "INSERT INTO lessonquest.organization_members (organization_id,user_id,role) VALUES ($1,$2,'TEACHER')",
      [created.organizationId, other],
    );
    await expect(bootstrapTeacher(admin, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
    expect((await admin.query('SELECT 1 FROM lessonquest.organization_members')).rows).toHaveLength(
      2,
    );
  });

  it('refuses bootstrap repetition after another project identity is linked', async () => {
    await migrateLessonQuest(admin, role);
    const created = await bootstrapTeacher(admin, { projectId, uid, organizationName });
    await admin.query(
      'INSERT INTO lessonquest.firebase_identities (project_id,uid,user_id) VALUES ($1,$2,$3)',
      ['second-project', 'another-uid', created.userId],
    );
    await expect(bootstrapTeacher(admin, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
    expect((await admin.query('SELECT 1 FROM lessonquest.firebase_identities')).rows).toHaveLength(
      2,
    );
  });

  it('rejects extra MAINTAIN privilege and a mismatched ledger runtime role', async () => {
    await migrateLessonQuest(admin, role);
    await admin.exec(`GRANT MAINTAIN ON lessonquest.lesson_inputs TO ${role}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    await admin.exec(`REVOKE MAINTAIN ON lessonquest.lesson_inputs FROM ${role}`);
    const outsider = await extraRole();
    await expect(migrateLessonQuest(admin, outsider)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query('SELECT runtime_role FROM lessonquest.schema_migrations')).rows,
    ).toEqual([{ runtime_role: role }]);
  });

  it('rejects delegated runtime membership before fresh migration', async () => {
    const outsider = await extraRole();
    await admin.exec(`GRANT ${role} TO ${outsider}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    expect(
      (await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='lessonquest'")).rows,
    ).toEqual([]);
  });

  it('rejects delegation to another principal on repeat and bootstrap', async () => {
    await migrateLessonQuest(admin, role);
    const outsider = await extraRole();
    await admin.exec(`GRANT ${role} TO ${outsider}`);
    expect(
      (
        await admin.query<{ readable: boolean }>(
          "SELECT has_schema_privilege($1,'lessonquest','USAGE') AND has_table_privilege($1,'lessonquest.lesson_inputs','SELECT') AS readable",
          [outsider],
        )
      ).rows[0]?.readable,
    ).toBe(true);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    await expect(bootstrapTeacher(admin, { projectId, uid, organizationName })).rejects.toThrow(
      'Provisioning failed',
    );
    expect((await admin.query('SELECT 1 FROM lessonquest.users')).rows).toEqual([]);
  });

  it.each(['INHERIT FALSE, SET TRUE', 'INHERIT FALSE, SET FALSE, ADMIN TRUE'])(
    'rejects runtime delegation with %s',
    async (options) => {
      await migrateLessonQuest(admin, role);
      const outsider = await extraRole();
      await admin.exec(`GRANT ${role} TO ${outsider} WITH ${options}`);
      await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
    },
  );

  it('rejects a replication role', async () => {
    await admin.exec(`ALTER ROLE ${role} REPLICATION`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
  });

  it('permits membership held only by the already trusted schema owner', async () => {
    const owner = (await admin.query<{ name: string }>('SELECT current_user AS name')).rows[0]!
      .name;
    await admin.exec(`GRANT ${role} TO ${owner} WITH ADMIN TRUE`);
    expect(await migrateLessonQuest(admin, role)).toMatchObject({ status: 'applied' });
    expect(await migrateLessonQuest(admin, role)).toMatchObject({ status: 'unchanged' });
    expect(await bootstrapTeacher(admin, { projectId, uid, organizationName })).toMatchObject({
      status: 'created',
    });
  });

  it('rejects effective privilege drift on a repeat migration', async () => {
    await migrateLessonQuest(admin, role);
    await admin.exec(`GRANT UPDATE ON lessonquest.users TO ${role}`);
    await expect(migrateLessonQuest(admin, role)).rejects.toThrow('Provisioning failed');
  });
});

it('runtime readiness accepts only the restricted login, performs no writes, and rejects owner credentials', async () => {
  await migrateLessonQuest(admin, role);
  const db = appPool();
  const sql: string[] = [];
  await requireRuntimeReadiness({
    query: async (statement, params) => {
      sql.push(statement);
      return db.query(statement, params);
    },
  });
  expect(sql.every((statement) => /^\s*(SELECT|WITH)\b/i.test(statement))).toBe(true);
  expect(sql.length).toBeLessThan(15);
  await expect(requireRuntimeReadiness(admin)).rejects.toThrow('Runtime storage is unavailable');
  await admin.exec(`GRANT SELECT ON lessonquest.lesson_inputs TO PUBLIC`);
  await expect(requireRuntimeReadiness(db)).rejects.toThrow('Runtime storage is unavailable');
});
it('runtime readiness refuses missing schema and incoming role delegation', async () => {
  const db = appPool();
  await expect(requireRuntimeReadiness(db)).rejects.toThrow('Runtime storage is unavailable');
  await migrateLessonQuest(admin, role);
  const outsider = await extraRole();
  await admin.exec(`GRANT ${role} TO ${outsider}`);
  await expect(requireRuntimeReadiness(db)).rejects.toThrow('Runtime storage is unavailable');
});

it('routes verified synthetic teacher sessions through the live gateway into persistent restricted PostgreSQL', async () => {
  await migrateLessonQuest(admin, role);
  const registered = await bootstrapTeacher(admin, { projectId, uid, organizationName });
  const db = appPool();
  const origin = 'https://lessonquest.test';
  const now = Math.floor(Date.now() / 1000);
  const auth = new FirebaseAuthProvider({
    projectId,
    identities: new FirebaseIdentityRepository(db),
    verifier: {
      verifyIdToken: () =>
        Promise.resolve({
          uid,
          sub: uid,
          aud: projectId,
          iss: `https://securetoken.google.com/${projectId}`,
          email_verified: true,
          firebase: { sign_in_provider: 'google.com' },
          exp: now + 600,
          iat: now,
          auth_time: now,
        }),
    },
  });
  const app = createApp({
    auth,
    repository: new TenantRepository(db),
    learningRepository: new LearningRepository(db),
    teacherSessionRepository: new TeacherSessionRepository(db),
    lessonInputRepository: new (await import('@lessonquest/db')).LessonInputRepository(db),
    trustedOrigin: origin,
    diagnostics: { record() {} },
  });
  const gateway = createServerHandler(() =>
    Promise.resolve({
      origin,
      fetch: (request) => Promise.resolve(app.fetch(request)),
      close: () => Promise.resolve(),
    }),
  );
  const headers = {
    origin,
    authorization: 'Bearer synthetic.uid.signature',
    'content-type': 'application/json',
  };
  const session = await gateway(new Request(origin + '/api/session', { headers }));
  expect(session.status).toBe(200);
  expect(await session.json()).toMatchObject({
    userId: registered.userId,
    organizations: [{ id: registered.organizationId }],
  });
  const path = `/api/organizations/${registered.organizationId}/lesson-inputs`;
  expect((await gateway(new Request(origin + path))).status).toBe(401);
  const saved = await gateway(
    new Request(origin + path, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mutationId: randomUUID(),
        title: 'Persistent gateway lesson',
        gradeBand: 'middle1',
        learningContent: 'Synthetic only',
        learningObjectives: ['Explain force'],
      }),
    }),
  );
  expect(saved.status).toBe(201);
  const body = (await saved.json()) as { lessonInput: { id: string } };
  const generated = await gateway(
    new Request(origin + path + '/' + body.lessonInput.id + '/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mutationId: randomUUID(), expectedRevision: 1 }),
    }),
  );
  expect(generated.status).toBe(403);
  expect(await generated.json()).toMatchObject({ error: { code: 'AI_BILLING_NOT_CONFIGURED' } });
  await db.close();
  const fresh = appPool();
  const actor = (await new FirebaseIdentityRepository(fresh).findActor(projectId, uid))!;
  expect(
    (
      await new LessonInputRepository(fresh).get(
        actor,
        registered.organizationId,
        body.lessonInput.id,
        randomUUID(),
      )
    ).title,
  ).toBe('Persistent gateway lesson');
  auth.dispose();
});
