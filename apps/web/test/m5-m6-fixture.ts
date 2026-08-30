import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import {
  GamificationRepository,
  initializeSchema,
  LearningRepository,
  RasaRepository,
  TenantRepository,
} from '@lessonquest/db';
import { LocalRasaProvider } from '../../../packages/rasa/src/index.js';

import { createApp } from '../../../services/api/src/app.js';

export const m56Origin = 'https://play.lessonquest.test';
export const m56TeacherToken = `dev_${'t'.repeat(32)}`;
export const m56StudentToken = `dev_${'s'.repeat(32)}`;
export const m56Teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fd01',
  platformRole: 'TEACHER',
  memberships: [],
};
export const m56Student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fd02',
  platformRole: 'STUDENT',
  memberships: [],
};

export async function createM56Fixture() {
  const database = new PGlite();
  await initializeSchema(database);
  const tenants = new TenantRepository(database);
  const learning = new LearningRepository(database, {
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });
  await tenants.upsertUser(m56Teacher);
  await tenants.upsertUser(m56Student);
  const organization = await tenants.createOrganization(m56Teacher, 'M5M6 통합학교');
  const lessonClass = await tenants.createClass(m56Teacher, organization.id, '통합반');
  await tenants.addStudentToClass(m56Teacher, organization.id, lessonClass.id, m56Student.userId);
  const spec = await readFile(
    join(process.cwd(), 'packages/science-studio/test/fixtures/force-motion.json'),
    'utf8',
  );
  const experience = await learning.createScienceExperience(
    m56Teacher,
    organization.id,
    'M5M6 실제 경계',
    spec,
  );
  await learning.validateExperienceVersion(m56Teacher, organization.id, experience.versionId);
  await learning.reviewExperienceVersion(m56Teacher, organization.id, experience.versionId, {
    decision: 'APPROVE',
  });
  const assignment = await learning.createAssignment(m56Teacher, organization.id, lessonClass.id, {
    experienceVersionId: experience.versionId,
    rasaPolicy: { enabled: true, maxHintLevel: 2 },
  });
  const gamification = new GamificationRepository(database);
  const app = createApp({
    auth: new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [m56TeacherToken, m56Teacher],
        [m56StudentToken, m56Student],
      ]),
    }),
    repository: tenants,
    learningRepository: learning,
    rasaRepository: new RasaRepository(database),
    gamificationRepository: gamification,
    rasaProvider: new LocalRasaProvider(),
    trustedOrigin: m56Origin,
    diagnostics: { record() {} },
  });
  return { database, app, organization, lessonClass, assignment, gamification };
}
