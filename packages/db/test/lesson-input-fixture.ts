import { PGlite } from '@electric-sql/pglite';
import type { Actor } from '@lessonquest/contracts';

import { LessonInputRepository } from '../src/lesson-input-repository.js';
import { initializeSchema } from '../src/schema.js';
import { TenantRepository } from '../src/tenant-repository.js';

const initialNow = new Date('2026-09-07T09:00:00.000Z');

export async function createLessonInputFixture() {
  let currentNow = initialNow;
  const database = new PGlite();
  await initializeSchema(database);
  const tenants = new TenantRepository(database);
  const teacher: Actor = {
    userId: '018f72a4-cc52-7c5a-a6f9-8b21aa270101',
    platformRole: 'TEACHER',
    memberships: [],
  };
  const otherTeacher: Actor = {
    userId: '018f72a4-cc52-7c5a-a6f9-8b21aa270102',
    platformRole: 'TEACHER',
    memberships: [],
  };
  const admin: Actor = {
    userId: '018f72a4-cc52-7c5a-a6f9-8b21aa270103',
    platformRole: 'SUPER_ADMIN',
    memberships: [],
  };
  const student: Actor = {
    userId: '018f72a4-cc52-7c5a-a6f9-8b21aa270104',
    platformRole: 'STUDENT',
    memberships: [],
  };

  for (const actor of [teacher, otherTeacher, admin, student]) {
    await tenants.upsertUser(actor);
  }
  const organization = await tenants.createOrganization(teacher, '별빛중학교');
  const otherOrganization = await tenants.createOrganization(otherTeacher, '다른학교');
  await database.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'TEACHER'), ($1, $3, 'ORG_ADMIN'), ($1, $4, 'STUDENT')`,
    [organization.id, otherTeacher.userId, admin.userId, student.userId],
  );

  return {
    database,
    tenants,
    inputs: new LessonInputRepository(database, { now: () => currentNow }),
    teacher,
    otherTeacher,
    admin,
    student,
    organization,
    otherOrganization,
    advance(milliseconds = 1_000) {
      currentNow = new Date(currentNow.getTime() + milliseconds);
    },
    async close() {
      await database.close();
    },
  };
}
