import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import type { Actor } from '@lessonquest/contracts';
import { LocalRasaProvider } from '@lessonquest/rasa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initializeSchema,
  LearningRepository,
  RasaRepository,
  TenantRepository,
} from '../src/index.js';

const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a101',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a102',
  platformRole: 'STUDENT',
  memberships: [],
};
const requestId = '018f72a4-cc52-7c5a-a6f9-8b21aa27a201';

describe('RasaRepository', () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
  });
  afterEach(async () => {
    await database.close();
  });

  it('builds safe context, persists one answer-safe hint, and replays idempotently', async () => {
    const tenants = new TenantRepository(database);
    const learning = new LearningRepository(database, {
      now: () => new Date('2026-08-29T12:00:00Z'),
    });
    await tenants.upsertUser(teacher);
    await tenants.upsertUser(student);
    const org = await tenants.createOrganization(teacher, '별빛중');
    const lessonClass = await tenants.createClass(teacher, org.id, '1반');
    await tenants.addStudentToClass(teacher, org.id, lessonClass.id, student.userId);
    const generated = await readFile(
      new URL('../../science-studio/test/fixtures/force-motion.json', import.meta.url),
      'utf8',
    );
    const experience = await learning.createScienceExperience(
      teacher,
      org.id,
      '힘과 운동',
      generated,
    );
    await learning.validateExperienceVersion(teacher, org.id, experience.versionId);
    await learning.reviewExperienceVersion(teacher, org.id, experience.versionId, {
      decision: 'APPROVE',
    });
    const assignment = await learning.createAssignment(teacher, org.id, lessonClass.id, {
      experienceVersionId: experience.versionId,
      rasaPolicy: { enabled: true, maxHintLevel: 2 },
    });
    const attempt = await learning.startOrResumeAttempt(student, org.id, assignment.id);
    const player = await learning.getPlayerSession(student, org.id, assignment.id);
    const base = {
      schemaVersion: 1 as const,
      organizationId: org.id,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: 1,
      occurredAt: '2026-08-29T12:00:00.000Z',
    };
    await learning.ingestLearningEvent(student, {
      ...base,
      eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a301',
      type: 'EXPERIENCE_STARTED',
      stepId: 'start',
      sequence: 0,
      payload: {},
    });
    await learning.ingestLearningEvent(student, {
      ...base,
      eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a302',
      type: 'QUESTION_ANSWERED',
      stepId: 'quiz_force',
      sequence: 1,
      payload: { optionId: 'heavy', attempt: 1, elapsedMs: 10 },
    });
    const provider = new LocalRasaProvider();
    const spy = vi.spyOn(provider, 'generateHint');
    const repository = new RasaRepository(database);
    const input = { requestId, attemptId: attempt.id, stepId: 'quiz_force' };
    const first = await repository.requestHint(
      student,
      org.id,
      lessonClass.id,
      input,
      '018f72a4-cc52-7c5a-a6f9-8b21aa27a401',
      {
        provider,
        createId: (() => {
          let i = 500;
          return () => `018f72a4-cc52-7c5a-a6f9-8b21aa27a${i++}`;
        })(),
      },
    );
    const duplicate = await repository.requestHint(
      student,
      org.id,
      lessonClass.id,
      input,
      '018f72a4-cc52-7c5a-a6f9-8b21aa27a402',
      { provider },
    );
    expect(first).toMatchObject({
      requestId,
      duplicate: false,
      nextSequence: 4,
      action: { action: 'SHOW_HINT', stepId: 'quiz_force', level: 1 },
    });
    expect(duplicate).toEqual({ ...first, duplicate: true });
    expect(spy).toHaveBeenCalledTimes(1);
    const rows = await database.query<{
      requests: number;
      actions: number;
      usage: number;
      events: number;
    }>(
      `SELECT (SELECT COUNT(*)::int FROM rasa_requests) requests, (SELECT COUNT(*)::int FROM rasa_actions) actions, (SELECT COUNT(*)::int FROM ai_usage) usage, (SELECT COUNT(*)::int FROM learning_events WHERE type IN ('RASA_OPENED','HINT_USED')) events`,
    );
    expect(rows.rows[0]).toEqual({ requests: 1, actions: 1, usage: 1, events: 2 });
    const resumed = await learning.startOrResumeAttempt(student, org.id, assignment.id);
    expect(resumed.rasa.hints).toHaveLength(1);
  });
});
