import { readFile } from 'node:fs/promises';

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
import { LocalRasaProvider } from '@lessonquest/rasa';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import './m5-m6-audit-cases.js';

const origin = 'https://play.lessonquest.test';
const teacherToken = `dev_${'t'.repeat(32)}`;
const studentToken = `dev_${'s'.repeat(32)}`;
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e101',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e102',
  platformRole: 'STUDENT',
  memberships: [],
};
const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  origin,
  'content-type': 'application/json',
});

describe('M5/M6 HTTP boundary', () => {
  let database: PGlite | undefined;
  afterEach(async () => database?.close());
  it('runs answer-safe hint events into authoritative aggregate boss progress', async () => {
    database = new PGlite();
    await initializeSchema(database);
    const tenants = new TenantRepository(database);
    const learning = new LearningRepository(database, {
      now: () => new Date('2026-08-29T12:00:00Z'),
    });
    await tenants.upsertUser(teacher);
    await tenants.upsertUser(student);
    const org = await tenants.createOrganization(teacher, '별빛중');
    const cls = await tenants.createClass(teacher, org.id, '1반');
    await tenants.addStudentToClass(teacher, org.id, cls.id, student.userId);
    const spec = await readFile(
      new URL('../../../packages/science-studio/test/fixtures/force-motion.json', import.meta.url),
      'utf8',
    );
    const exp = await learning.createScienceExperience(teacher, org.id, '힘과 운동', spec);
    await learning.validateExperienceVersion(teacher, org.id, exp.versionId);
    await learning.reviewExperienceVersion(teacher, org.id, exp.versionId, { decision: 'APPROVE' });
    const assignment = await learning.createAssignment(teacher, org.id, cls.id, {
      experienceVersionId: exp.versionId,
      rasaPolicy: { enabled: true, maxHintLevel: 2 },
    });
    const attempt = await learning.startOrResumeAttempt(student, org.id, assignment.id);
    const player = await learning.getPlayerSession(student, org.id, assignment.id);
    const gamification = new GamificationRepository(database);
    const app = createApp({
      auth: new LocalAuthProvider({
        environment: 'test',
        sessions: new Map([
          [teacherToken, teacher],
          [studentToken, student],
        ]),
      }),
      repository: tenants,
      learningRepository: learning,
      rasaRepository: new RasaRepository(database),
      gamificationRepository: gamification,
      rasaProvider: new LocalRasaProvider(),
      trustedOrigin: origin,
      diagnostics: { record() {} },
    });
    const campaign = await app.request(
      `/organizations/${org.id}/classes/${cls.id}/boss/campaigns`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({
          title: '관성 보스',
          period: { kind: 'WEEKLY', weekStart: '2026-08-24' },
          targetHp: 100,
          policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
        }),
      },
    );
    expect(campaign.status).toBe(201);
    const base = {
      schemaVersion: 1,
      organizationId: org.id,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: 1,
      occurredAt: '2026-08-29T12:00:00.000Z',
    };
    const send = (event: unknown) =>
      app.request(`/organizations/${org.id}/learning-events`, {
        method: 'POST',
        headers: headers(studentToken),
        body: JSON.stringify(event),
      });
    expect(
      (
        await send({
          ...base,
          eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e201',
          type: 'EXPERIENCE_STARTED',
          stepId: 'start',
          sequence: 0,
          payload: {},
        })
      ).status,
    ).toBe(202);
    expect(
      (
        await send({
          ...base,
          eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e202',
          type: 'QUESTION_ANSWERED',
          stepId: 'quiz_force',
          sequence: 1,
          payload: { optionId: 'heavy', attempt: 1, elapsedMs: 10 },
        })
      ).status,
    ).toBe(202);
    const hint = await app.request(`/organizations/${org.id}/classes/${cls.id}/rasa/hints`, {
      method: 'POST',
      headers: headers(studentToken),
      body: JSON.stringify({
        requestId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e203',
        attemptId: attempt.id,
        stepId: 'quiz_force',
      }),
    });
    expect(hint.status).toBe(200);
    expect(await hint.json()).toMatchObject({
      nextSequence: 4,
      action: { action: 'SHOW_HINT', level: 1 },
    });
    expect(
      (
        await send({
          ...base,
          eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e204',
          type: 'ANSWER_RETRIED',
          stepId: 'quiz_force',
          sequence: 4,
          payload: { optionId: 'light', attempt: 2, elapsedMs: 10 },
        })
      ).status,
    ).toBe(202);
    expect(
      (
        await send({
          ...base,
          eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e205',
          type: 'EXPERIENCE_COMPLETED',
          stepId: 'complete',
          sequence: 5,
          payload: { elapsedMs: 100 },
        })
      ).status,
    ).toBe(202);
    await gamification.drainPendingJobs();
    const boss = await app.request(`/organizations/${org.id}/classes/${cls.id}/boss`, {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(await boss.json()).toMatchObject({
      title: '관성 보스',
      damage: 8,
      targetHp: 100,
      completed: false,
    });
    const detail = await app.request(`/organizations/${org.id}/classes/${cls.id}/boss/detail`, {
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const body: unknown = await detail.json();
    expect(body).toMatchObject({ projectionHealth: { pending: 0, failed: 0 } });
    expect(
      JSON.stringify(
        await (
          await app.request(`/organizations/${org.id}/classes/${cls.id}/boss`, {
            headers: { authorization: `Bearer ${studentToken}` },
          })
        ).json(),
      ),
    ).not.toContain(student.userId);
  });
});
