import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor, ClientLearningEvent } from '@lessonquest/contracts';
import { initializeSchema, LearningRepository, TenantRepository } from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const trustedOrigin = 'https://play.lessonquest.test';
const teacherToken = `dev_${'t'.repeat(32)}`;
const otherTeacherToken = `dev_${'o'.repeat(32)}`;
const studentToken = `dev_${'s'.repeat(32)}`;
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a101',
  platformRole: 'TEACHER',
  memberships: [],
};
const otherTeacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a102',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27a103',
  platformRole: 'STUDENT',
  memberships: [],
};
const eventIds = [
  '018f72a4-cc52-7c5a-a6f9-8b21aa27a201',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27a202',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27a203',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27a204',
] as const;

function headers(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    origin: trustedOrigin,
    'content-type': 'application/json',
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected object response');
  }
  return value as Record<string, unknown>;
}

describe('M3 Science Studio to M4 student play API', () => {
  let database: PGlite;
  let tenants: TenantRepository;
  let learningRepository: LearningRepository;
  let auth: LocalAuthProvider;
  let organizationId: string;
  let classId: string;
  let generatedSpecText: string;

  function buildApp() {
    return createApp({
      auth,
      repository: tenants,
      learningRepository,
      trustedOrigin,
      diagnostics: { record() {} },
    });
  }

  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    tenants = new TenantRepository(database);
    learningRepository = new LearningRepository(database, {
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });
    for (const actor of [teacher, otherTeacher, student]) {
      await tenants.upsertUser(actor);
    }
    const organization = await tenants.createOrganization(teacher, '별빛중학교');
    organizationId = organization.id;
    const lessonClass = await tenants.createClass(teacher, organizationId, '1학년 3반');
    classId = lessonClass.id;
    await tenants.addStudentToClass(teacher, organizationId, classId, student.userId);
    auth = new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [teacherToken, teacher],
        [otherTeacherToken, otherTeacher],
        [studentToken, student],
      ]),
    });
    generatedSpecText = await readFile(
      new URL('../../../packages/science-studio/test/fixtures/force-motion.json', import.meta.url),
      'utf8',
    );
  });

  afterEach(async () => {
    await database.close();
  });

  it('runs create, validate, preview, approve, assign, resume, events, and teacher projection', async () => {
    const app = buildApp();
    const createdResponse = await app.request(
      `/organizations/${organizationId}/experiences/science`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({ title: '힘과 운동', generatedSpecText }),
      },
    );
    const created = await json(createdResponse);
    const versionId = String(created['versionId']);

    const validationResponse = await app.request(
      `/organizations/${organizationId}/experience-versions/${versionId}/validate`,
      { method: 'POST', headers: headers(teacherToken), body: '{}' },
    );
    const previewResponse = await app.request(
      `/organizations/${organizationId}/experience-versions/${versionId}/preview`,
      { headers: { authorization: `Bearer ${teacherToken}` } },
    );
    const preview = await json(previewResponse);
    const reviewResponse = await app.request(
      `/organizations/${organizationId}/experience-versions/${versionId}/review`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({ decision: 'APPROVE', note: '교사 검토 완료' }),
      },
    );
    const assignmentResponse = await app.request(
      `/organizations/${organizationId}/classes/${classId}/assignments`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({ experienceVersionId: versionId }),
      },
    );
    const assignment = await json(assignmentResponse);
    const assignmentId = String(assignment['id']);
    const studentHomeResponse = await app.request(
      `/organizations/${organizationId}/student/assignments`,
      { headers: { authorization: `Bearer ${studentToken}` } },
    );
    const studentHome: unknown = await studentHomeResponse.json();
    const firstAttemptResponse = await app.request(
      `/organizations/${organizationId}/assignments/${assignmentId}/attempts`,
      { method: 'POST', headers: headers(studentToken), body: '{}' },
    );
    const firstAttempt = await json(firstAttemptResponse);
    const resumedResponse = await app.request(
      `/organizations/${organizationId}/assignments/${assignmentId}/attempts`,
      { method: 'POST', headers: headers(studentToken), body: '{}' },
    );
    const resumed = await json(resumedResponse);
    const playerResponse = await app.request(
      `/organizations/${organizationId}/assignments/${assignmentId}/player`,
      { headers: { authorization: `Bearer ${studentToken}` } },
    );
    const player = await json(playerResponse);

    const eventBase = {
      schemaVersion: 1 as const,
      organizationId,
      assignmentId,
      attemptId: String(firstAttempt['id']),
      experienceId: String(player['experienceId']),
      experienceVersion: Number(player['experienceVersion']),
      occurredAt: '2026-08-29T11:55:00.000Z',
    };
    const events: ClientLearningEvent[] = [
      {
        ...eventBase,
        eventId: eventIds[0],
        type: 'EXPERIENCE_STARTED',
        stepId: 'start',
        sequence: 0,
        payload: {},
      },
      {
        ...eventBase,
        eventId: eventIds[1],
        type: 'QUESTION_ANSWERED',
        stepId: 'quiz_force',
        sequence: 1,
        payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_000 },
      },
      {
        ...eventBase,
        eventId: eventIds[2],
        type: 'ANSWER_RETRIED',
        stepId: 'quiz_force',
        sequence: 2,
        payload: { optionId: 'light', attempt: 2, elapsedMs: 600 },
      },
      {
        ...eventBase,
        eventId: eventIds[3],
        type: 'EXPERIENCE_COMPLETED',
        stepId: 'complete',
        sequence: 3,
        payload: { elapsedMs: 7_500 },
      },
    ];
    const eventResponses: Response[] = [];
    for (const event of events) {
      const response = await app.request(`/organizations/${organizationId}/learning-events`, {
        method: 'POST',
        headers: headers(studentToken),
        body: JSON.stringify(event),
      });
      eventResponses.push(response);
      expect(response.status).toBe(202);
    }
    const duplicateResponse = await app.request(
      `/organizations/${organizationId}/learning-events`,
      {
        method: 'POST',
        headers: headers(studentToken),
        body: JSON.stringify(events[1]),
      },
    );
    const progressResponse = await app.request(
      `/organizations/${organizationId}/classes/${classId}/assignments/${assignmentId}/progress`,
      { headers: { authorization: `Bearer ${teacherToken}` } },
    );
    const progress: unknown = await progressResponse.json();

    expect(createdResponse.status).toBe(201);
    expect(validationResponse.status).toBe(200);
    expect(previewResponse.status).toBe(200);
    expect(String(preview['sandboxDocument'])).toContain("default-src 'none'");
    expect(reviewResponse.status).toBe(200);
    expect(assignmentResponse.status).toBe(201);
    expect(studentHomeResponse.status).toBe(200);
    expect(studentHome).toEqual([
      expect.objectContaining({ id: assignmentId, title: '힘과 운동', attemptStatus: null }),
    ]);
    expect(firstAttemptResponse.status).toBe(201);
    expect(firstAttempt['resumed']).toBe(false);
    expect(resumedResponse.status).toBe(200);
    expect(resumed).toEqual({ ...firstAttempt, resumed: true });
    expect(playerResponse.status).toBe(200);
    expect(JSON.stringify(player['specification'])).not.toContain('"correct"');
    expect(JSON.stringify(player['specification'])).not.toContain('"explanation"');
    expect(duplicateResponse.status).toBe(200);
    await expect(json(duplicateResponse)).resolves.toEqual({
      accepted: false,
      duplicate: true,
      answer: { stepId: 'quiz_force', attempt: 1, correct: false },
      nextSequence: 4,
    });
    expect(progressResponse.status).toBe(200);
    expect(progress).toEqual([
      expect.objectContaining({
        studentId: student.userId,
        started: true,
        wrongAnswers: 1,
        retries: 1,
        completed: true,
        projectionVersion: 4,
      }),
    ]);

    const expectedAudits = [
      [createdResponse, 'EXPERIENCE_CREATED', 'SUCCEEDED'],
      [validationResponse, 'EXPERIENCE_VALIDATED', 'SUCCEEDED'],
      [reviewResponse, 'EXPERIENCE_REVIEWED', 'SUCCEEDED'],
      [assignmentResponse, 'ASSIGNMENT_CREATED', 'SUCCEEDED'],
      [firstAttemptResponse, 'ATTEMPT_STARTED', 'SUCCEEDED'],
      [eventResponses[0]!, 'LEARNING_EVENT_INGESTED', 'SUCCEEDED'],
      [duplicateResponse, 'LEARNING_EVENT_INGESTED', 'DUPLICATE'],
      [progressResponse, 'PROGRESS_READ', 'SUCCEEDED'],
    ] as const;
    for (const [response, action, outcome] of expectedAudits) {
      const traceId = response.headers.get('x-trace-id');
      expect(traceId).not.toBeNull();
      const audit = await database.query<{ action: string; outcome: string }>(
        'SELECT action, outcome FROM audit_logs WHERE trace_id = $1',
        [traceId],
      );
      expect(audit.rows).toEqual([{ action, outcome }]);
    }
  });

  it('rejects student Studio access and failed-validation publication without leaking content', async () => {
    const app = buildApp();
    const studentCreate = await app.request(
      `/organizations/${organizationId}/experiences/science`,
      {
        method: 'POST',
        headers: headers(studentToken),
        body: JSON.stringify({ title: '권한 상승', generatedSpecText }),
      },
    );
    const unsafe = JSON.parse(generatedSpecText) as Record<string, unknown>;
    const blocks = unsafe['blocks'];
    if (!Array.isArray(blocks) || typeof blocks[2] !== 'object' || blocks[2] === null) {
      throw new TypeError('Fixture simulation block missing');
    }
    blocks[2] = {
      ...(blocks[2] as Record<string, unknown>),
      parameters: { massKg: 2, forceN: 0, durationSec: 3 },
    };
    const create = await app.request(`/organizations/${organizationId}/experiences/science`, {
      method: 'POST',
      headers: headers(teacherToken),
      body: JSON.stringify({ title: '검증 실패', generatedSpecText: JSON.stringify(unsafe) }),
    });
    const created = await json(create);
    const versionId = String(created['versionId']);
    const validation = await app.request(
      `/organizations/${organizationId}/experience-versions/${versionId}/validate`,
      { method: 'POST', headers: headers(teacherToken), body: '{}' },
    );
    const review = await app.request(
      `/organizations/${organizationId}/experience-versions/${versionId}/review`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({ decision: 'APPROVE' }),
      },
    );
    const assignment = await app.request(
      `/organizations/${organizationId}/classes/${classId}/assignments`,
      {
        method: 'POST',
        headers: headers(teacherToken),
        body: JSON.stringify({ experienceVersionId: versionId }),
      },
    );
    const serialized = JSON.stringify(await json(review));

    expect(studentCreate.status).toBe(404);
    expect(validation.status).toBe(200);
    expect(review.status).toBe(422);
    expect(assignment.status).toBe(422);
    expect(serialized).not.toContain('같은 힘이라면');
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('stack');
  });
});
