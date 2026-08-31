import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { Actor } from '@lessonquest/contracts';
import {
  initializeSchema,
  TenantRepository,
  ClassroomRepository,
  LearningRepository,
} from '@lessonquest/db';

export async function createClassroomFixture() {
  const database = new PGlite();
  await initializeSchema(database);
  const tenants = new TenantRepository(database);
  const actor = (platformRole: Actor['platformRole']): Actor => ({
    userId: randomUUID(),
    platformRole,
    memberships: [],
  });
  const teacher = actor('TEACHER'),
    colleague = actor('TEACHER'),
    student = actor('STUDENT'),
    secondStudent = actor('STUDENT');
  for (const user of [teacher, colleague, student, secondStudent]) await tenants.upsertUser(user);
  const organization = await tenants.createOrganization(teacher, '합성 학교');
  const foreignOrganization = await tenants.createOrganization(colleague, '다른 학교');
  const lessonClass = await tenants.createClass(teacher, organization.id, '탐험 1반');
  await database.query(
    "UPDATE organization_members SET role='TEACHER' WHERE organization_id=$1 AND user_id=$2",
    [organization.id, teacher.userId],
  );
  await database.query(
    "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'TEACHER')",
    [organization.id, colleague.userId],
  );
  let instant = new Date('2026-08-31T00:00:00Z');
  const now = () => instant;
  return {
    database,
    tenants,
    teacher,
    colleague,
    student,
    secondStudent,
    organization,
    foreignOrganization,
    lessonClass,
    classrooms: new ClassroomRepository(database, { now }),
    learning: new LearningRepository(database, { now }),
    setNow(value: string) {
      instant = new Date(value);
    },
    trace: randomUUID,
  };
}
