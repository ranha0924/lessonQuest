import process from 'node:process';
import { URL } from 'node:url';
import { PostgresDatabase } from '../packages/db/dist/postgres.js';
import { bootstrapTeacher, migrateLessonQuest } from '../packages/db/dist/provisioning.js';

let database;
try {
  const command = process.argv[2];
  if (process.argv.length !== 3 || !['migrate', 'bootstrap-teacher'].includes(command))
    throw new Error();
  const value = process.env.LESSONQUEST_MIGRATION_DATABASE_URL;
  const expectedHost = process.env.LESSONQUEST_EXPECTED_DATABASE_HOST;
  const expectedDatabase = process.env.LESSONQUEST_EXPECTED_DATABASE_NAME;
  if (!value || !expectedHost || !expectedDatabase) throw new Error();
  const url = new URL(value);
  if (
    url.hostname !== expectedHost ||
    decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase
  )
    throw new Error();
  const runtimeRole = process.env.LESSONQUEST_RUNTIME_ROLE;
  const projectId = process.env.LESSONQUEST_FIREBASE_PROJECT_ID;
  const uid = process.env.LESSONQUEST_BOOTSTRAP_FIREBASE_UID;
  const organizationName = process.env.LESSONQUEST_BOOTSTRAP_ORGANIZATION_NAME;
  if (command === 'migrate' && (!runtimeRole || !/^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole)))
    throw new Error();
  if (
    command === 'bootstrap-teacher' &&
    (projectId !== 'lessonquest-df4b0' || !uid || !organizationName)
  )
    throw new Error();
  // Never fall back to app DATABASE_URL or run DDL at API/build startup.
  database = new PostgresDatabase({ connectionString: value, schema: 'lessonquest', max: 1 });
  const result =
    command === 'migrate'
      ? await migrateLessonQuest(database, runtimeRole)
      : await bootstrapTeacher(database, { projectId, uid, organizationName });
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  process.stderr.write('LessonQuest provisioning failed.\n');
  process.exitCode = 1;
} finally {
  try {
    await database?.close();
  } catch {
    process.exitCode = 1;
  }
}
