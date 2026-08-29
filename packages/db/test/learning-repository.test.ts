import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import type { Actor, ClientLearningEvent } from '@lessonquest/contracts';
import { parseScienceArtifact, ScienceGenerationError } from '@lessonquest/science-studio';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeSchema } from '../src/schema.js';
import {
  ContentIntegrityError,
  InvalidStateError,
  LearningRepository,
} from '../src/learning-repository.js';
import {
  ConflictError,
  ResourceNotFoundError,
  TenantRepository,
} from '../src/tenant-repository.js';

const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27f101',
  platformRole: 'TEACHER',
  memberships: [],
};
const otherTeacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27f102',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27f103',
  platformRole: 'STUDENT',
  memberships: [],
};
const otherStudent: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27f104',
  platformRole: 'STUDENT',
  memberships: [],
};

const initialNow = new Date('2026-08-29T12:00:00.000Z');
let currentTime = initialNow;
const eventIds = {
  started: '018f72a4-cc52-7c5a-a6f9-8b21aa27f201',
  wrong: '018f72a4-cc52-7c5a-a6f9-8b21aa27f202',
  retry: '018f72a4-cc52-7c5a-a6f9-8b21aa27f203',
  completed: '018f72a4-cc52-7c5a-a6f9-8b21aa27f204',
  retryAgain: '018f72a4-cc52-7c5a-a6f9-8b21aa27f205',
  invalid: '018f72a4-cc52-7c5a-a6f9-8b21aa27f206',
} as const;

describe('LearningRepository M3 and M4 lifecycle', () => {
  let database: PGlite;
  let tenants: TenantRepository;
  let learning: LearningRepository;
  let generatedSpecText: string;
  let organizationId: string;
  let classId: string;

  beforeEach(async () => {
    currentTime = initialNow;
    database = new PGlite();
    await initializeSchema(database);
    tenants = new TenantRepository(database);
    learning = new LearningRepository(database, { now: () => currentTime });
    for (const actor of [teacher, otherTeacher, student, otherStudent]) {
      await tenants.upsertUser(actor);
    }
    const organization = await tenants.createOrganization(teacher, '별빛중학교');
    organizationId = organization.id;
    const lessonClass = await tenants.createClass(teacher, organizationId, '1학년 3반');
    classId = lessonClass.id;
    await tenants.addStudentToClass(teacher, organizationId, classId, student.userId);
    generatedSpecText = await readFile(
      new URL('../../science-studio/test/fixtures/force-motion.json', import.meta.url),
      'utf8',
    );
  });

  afterEach(async () => {
    await database.close();
  });

  async function createApprovedVersion() {
    const created = await learning.createScienceExperience(
      teacher,
      organizationId,
      '힘과 운동',
      generatedSpecText,
    );
    const validation = await learning.validateExperienceVersion(
      teacher,
      organizationId,
      created.versionId,
    );
    const reviewed = await learning.reviewExperienceVersion(
      teacher,
      organizationId,
      created.versionId,
      { decision: 'APPROVE', note: '검토 완료' },
    );
    expect(validation.report.verdict).toBe('PASS');
    expect(reviewed.status).toBe('APPROVED');
    return created;
  }

  async function createAssignmentAndAttempt() {
    const version = await createApprovedVersion();
    const assignment = await learning.createAssignment(teacher, organizationId, classId, {
      experienceVersionId: version.versionId,
    });
    const attempt = await learning.startOrResumeAttempt(student, organizationId, assignment.id);
    const player = await learning.getPlayerSession(student, organizationId, assignment.id);
    return { assignment, attempt, player, version };
  }

  it('creates, validates, approves, and protects an immutable science version', async () => {
    const created = await createApprovedVersion();
    const rows = await database.query<{
      status: string;
      content_hash: string;
      validation_count: number;
      approval_count: number;
    }>(
      `SELECT v.status, v.content_hash,
        (SELECT COUNT(*)::int FROM experience_validations WHERE version_id = v.id) AS validation_count,
        (SELECT COUNT(*)::int FROM experience_approvals WHERE version_id = v.id) AS approval_count
       FROM experience_versions v WHERE v.id = $1`,
      [created.versionId],
    );

    expect(created).toMatchObject({ version: 1, status: 'GENERATED' });
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({
      status: 'APPROVED',
      validation_count: 1,
      approval_count: 1,
    });
    expect(rows.rows[0]?.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(
      database.query(
        `UPDATE experience_versions
         SET specification = jsonb_set(specification, '{title}', '"tampered"')
         WHERE id = $1`,
        [created.versionId],
      ),
    ).rejects.toThrow();
    await expect(
      database.query(
        "UPDATE experience_validations SET findings = '[]'::jsonb WHERE version_id = $1",
        [created.versionId],
      ),
    ).rejects.toThrow();
    await expect(
      database.query('DELETE FROM experience_approvals WHERE version_id = $1', [created.versionId]),
    ).rejects.toThrow();
  });

  it('binds validation and approval to one immutable canonical artifact and forward-only state', async () => {
    const validated = await learning.createScienceExperience(
      teacher,
      organizationId,
      '검증 결속',
      generatedSpecText,
    );
    const storedBeforeValidation = await database.query<{ artifact: unknown }>(
      'SELECT artifact FROM experience_versions WHERE id = $1',
      [validated.versionId],
    );
    expect(() => parseScienceArtifact(storedBeforeValidation.rows[0]?.artifact)).not.toThrow();
    await learning.validateExperienceVersion(teacher, organizationId, validated.versionId);
    const validationEvidence = await database.query<{ content_hash: string }>(
      'SELECT content_hash FROM experience_validations WHERE version_id = $1',
      [validated.versionId],
    );
    expect(validationEvidence.rows).toEqual([{ content_hash: validated.contentHash }]);

    await expect(
      database.query(
        `UPDATE experience_versions
         SET artifact = jsonb_set(artifact, '{specification,blocks,2,parameters,forceN}', '0'),
             content_hash = $2
         WHERE id = $1`,
        [validated.versionId, `sha256:${'b'.repeat(64)}`],
      ),
    ).rejects.toThrow();

    await learning.reviewExperienceVersion(teacher, organizationId, validated.versionId, {
      decision: 'APPROVE',
    });
    const approvalEvidence = await database.query<{ content_hash: string }>(
      'SELECT content_hash FROM experience_approvals WHERE version_id = $1',
      [validated.versionId],
    );
    expect(approvalEvidence.rows).toEqual([{ content_hash: validated.contentHash }]);
    await expect(
      database.query("UPDATE experience_versions SET status = 'GENERATED' WHERE id = $1", [
        validated.versionId,
      ]),
    ).rejects.toThrow();

    const directJump = await learning.createScienceExperience(
      teacher,
      organizationId,
      '직접 점프',
      generatedSpecText,
    );
    await expect(
      database.query("UPDATE experience_versions SET status = 'APPROVED' WHERE id = $1", [
        directJump.versionId,
      ]),
    ).rejects.toThrow();

    const divergent = await learning.createScienceExperience(
      teacher,
      organizationId,
      '불일치',
      generatedSpecText,
    );
    await database.query(
      `UPDATE experience_versions
       SET artifact = jsonb_set(artifact, '{specification,title}', '"다른 산출물"')
       WHERE id = $1`,
      [divergent.versionId],
    );
    await expect(
      learning.validateExperienceVersion(teacher, organizationId, divergent.versionId),
    ).rejects.toBeInstanceOf(ContentIntegrityError);
  });

  it('leaves no row for generation failure and prevents failed validation from approval or assignment', async () => {
    await expect(
      learning.createScienceExperience(teacher, organizationId, '잘못된 생성물', '{'),
    ).rejects.toBeInstanceOf(ScienceGenerationError);
    const countAfterParseFailure = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM experiences',
    );
    expect(countAfterParseFailure.rows).toEqual([{ count: 0 }]);

    const unsafeSpec = JSON.parse(generatedSpecText) as Record<string, unknown>;
    const blocks = unsafeSpec['blocks'];
    if (!Array.isArray(blocks) || typeof blocks[2] !== 'object' || blocks[2] === null) {
      throw new TypeError('Fixture simulation block missing');
    }
    blocks[2] = {
      ...(blocks[2] as Record<string, unknown>),
      parameters: { massKg: 2, forceN: 0, durationSec: 3 },
    };
    const created = await learning.createScienceExperience(
      teacher,
      organizationId,
      '움직이지 않는 실험',
      JSON.stringify(unsafeSpec),
    );
    const validation = await learning.validateExperienceVersion(
      teacher,
      organizationId,
      created.versionId,
    );

    expect(validation).toMatchObject({ status: 'REJECTED', report: { verdict: 'FAIL' } });
    await expect(
      learning.reviewExperienceVersion(teacher, organizationId, created.versionId, {
        decision: 'APPROVE',
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      learning.createAssignment(teacher, organizationId, classId, {
        experienceVersionId: created.versionId,
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it('fails closed for cross-tenant IDs, students on teacher actions, and stale roles', async () => {
    const created = await createApprovedVersion();
    const otherOrganization = await tenants.createOrganization(otherTeacher, '다른학교');
    const otherClass = await tenants.createClass(otherTeacher, otherOrganization.id, '다른 반');

    await expect(
      learning.getExperiencePreview(otherTeacher, otherOrganization.id, created.versionId),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.createAssignment(otherTeacher, otherOrganization.id, otherClass.id, {
        experienceVersionId: created.versionId,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.createScienceExperience(student, organizationId, '권한 상승', generatedSpecText),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await database.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'TEACHER')`,
      [organizationId, otherTeacher.userId],
    );
    await expect(
      learning.getExperiencePreview(otherTeacher, organizationId, created.versionId),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.createAssignment(otherTeacher, organizationId, classId, {
        experienceVersionId: created.versionId,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    const ownerAssignment = await learning.createAssignment(teacher, organizationId, classId, {
      experienceVersionId: created.versionId,
    });
    await expect(
      learning.listTeacherProgress(otherTeacher, organizationId, classId, ownerAssignment.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await tenants.upsertUser({ ...teacher, platformRole: 'STUDENT' });
    await expect(
      learning.getExperiencePreview(teacher, organizationId, created.versionId),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('assigns only approved content, lists it for active members, and resumes one attempt', async () => {
    const version = await createApprovedVersion();
    const assignment = await learning.createAssignment(teacher, organizationId, classId, {
      experienceVersionId: version.versionId,
    });
    const listed = await learning.listStudentAssignments(student, organizationId);
    const first = await learning.startOrResumeAttempt(student, organizationId, assignment.id);
    const resumed = await learning.startOrResumeAttempt(student, organizationId, assignment.id);

    expect(listed).toEqual([
      expect.objectContaining({
        id: assignment.id,
        title: '힘과 운동',
        attemptStatus: null,
      }),
    ]);
    expect(first).toMatchObject({
      resumed: false,
      status: 'READY',
      nextSequence: 0,
      answers: [],
    });
    expect(resumed).toEqual({ ...first, resumed: true });
    await expect(
      learning.startOrResumeAttempt(otherStudent, organizationId, assignment.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('refuses a player session when persisted approved content no longer matches its hash', async () => {
    const { assignment, version } = await createAssignmentAndAttempt();
    await database.exec('ALTER TABLE experience_versions DISABLE TRIGGER protect_approved_version');
    await database.query(
      `UPDATE experience_versions
       SET artifact = jsonb_set(artifact, '{specification,title}', '"tampered"')
       WHERE id = $1`,
      [version.versionId],
    );
    await database.exec('ALTER TABLE experience_versions ENABLE TRIGGER protect_approved_version');

    await expect(
      learning.getPlayerSession(student, organizationId, assignment.id),
    ).rejects.toBeInstanceOf(ContentIntegrityError);
  });

  it('resumes at the server-owned next sequence and enforces assignment and institution lifecycle', async () => {
    const version = await createApprovedVersion();
    const assignment = await learning.createAssignment(teacher, organizationId, classId, {
      experienceVersionId: version.versionId,
      dueAt: '2026-08-29T12:30:00.000Z',
    });
    const attempt = await learning.startOrResumeAttempt(student, organizationId, assignment.id);
    const player = await learning.getPlayerSession(student, organizationId, assignment.id);
    const started: ClientLearningEvent = {
      schemaVersion: 1,
      eventId: eventIds.started,
      type: 'EXPERIENCE_STARTED',
      organizationId,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: player.experienceVersion,
      stepId: 'start',
      sequence: 0,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: {},
    };

    await expect(learning.ingestLearningEvent(student, started)).resolves.toEqual({
      accepted: true,
      duplicate: false,
      answer: null,
    });
    await expect(
      learning.startOrResumeAttempt(student, organizationId, assignment.id),
    ).resolves.toMatchObject({
      id: attempt.id,
      status: 'IN_PROGRESS',
      resumed: true,
      nextSequence: 1,
      answers: [],
    });

    currentTime = new Date('2026-08-29T13:00:00.000Z');
    await expect(
      learning.getPlayerSession(student, organizationId, assignment.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.ingestLearningEvent(student, {
        ...started,
        eventId: eventIds.wrong,
        type: 'QUESTION_ANSWERED',
        stepId: 'quiz_force',
        sequence: 1,
        payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_000 },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    currentTime = initialNow;
    await database.query("UPDATE classes SET status = 'DISABLED' WHERE id = $1", [classId]);
    await expect(learning.listStudentAssignments(student, organizationId)).resolves.toEqual([]);
    await expect(
      learning.getPlayerSession(student, organizationId, assignment.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await database.query("UPDATE classes SET status = 'ACTIVE' WHERE id = $1", [classId]);
    await database.query("UPDATE organizations SET status = 'DISABLED' WHERE id = $1", [
      organizationId,
    ]);
    await expect(learning.listStudentAssignments(student, organizationId)).resolves.toEqual([]);
    await expect(
      learning.getPlayerSession(student, organizationId, assignment.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('stores start, wrong, retry, and complete once and projects the literal teacher result', async () => {
    const { assignment, attempt, player } = await createAssignmentAndAttempt();
    const eventBase = {
      schemaVersion: 1 as const,
      organizationId,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: player.experienceVersion,
      occurredAt: '2026-08-29T11:55:00.000Z',
    };
    const events = [
      {
        ...eventBase,
        eventId: eventIds.started,
        type: 'EXPERIENCE_STARTED',
        stepId: 'start',
        sequence: 0,
        payload: {},
      },
      {
        ...eventBase,
        eventId: eventIds.wrong,
        type: 'QUESTION_ANSWERED',
        stepId: 'quiz_force',
        sequence: 1,
        payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_200 },
      },
      {
        ...eventBase,
        eventId: eventIds.retry,
        type: 'ANSWER_RETRIED',
        stepId: 'quiz_force',
        sequence: 2,
        payload: { optionId: 'heavy', attempt: 2, elapsedMs: 700 },
      },
      {
        ...eventBase,
        eventId: eventIds.retryAgain,
        type: 'ANSWER_RETRIED',
        stepId: 'quiz_force',
        sequence: 3,
        payload: { optionId: 'light', attempt: 3, elapsedMs: 500 },
      },
      {
        ...eventBase,
        eventId: eventIds.completed,
        type: 'EXPERIENCE_COMPLETED',
        stepId: 'complete',
        sequence: 4,
        payload: { elapsedMs: 8_000 },
      },
    ] as const satisfies readonly ClientLearningEvent[];

    await expect(learning.ingestLearningEvent(student, events[0])).resolves.toEqual({
      accepted: true,
      duplicate: false,
      answer: null,
    });
    await expect(
      learning.ingestLearningEvent(student, { ...events[1], sequence: 2 }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      learning.ingestLearningEvent(student, {
        ...events[1],
        stepId: 'quiz_unknown',
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.ingestLearningEvent(student, {
        ...events[1],
        payload: { optionId: 'unknown', attempt: 1, elapsedMs: 1_200 },
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      learning.ingestLearningEvent(student, {
        ...events[1],
        payload: { optionId: 'heavy', correct: true, attempt: 1, elapsedMs: 1_200 },
      } as unknown as ClientLearningEvent),
    ).rejects.toThrow();

    await expect(learning.ingestLearningEvent(student, events[1])).resolves.toEqual({
      accepted: true,
      duplicate: false,
      answer: { stepId: 'quiz_force', attempt: 1, correct: false },
    });
    await expect(
      learning.ingestLearningEvent(student, {
        ...events[4],
        eventId: eventIds.invalid,
        sequence: 2,
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      learning.ingestLearningEvent(student, {
        ...events[2],
        payload: { optionId: 'heavy', attempt: 4, elapsedMs: 700 },
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    for (const [event, correct] of [
      [events[2], false],
      [events[3], true],
    ] as const) {
      await expect(learning.ingestLearningEvent(student, event)).resolves.toEqual({
        accepted: true,
        duplicate: false,
        answer: { stepId: 'quiz_force', attempt: event.payload.attempt, correct },
      });
    }
    await expect(learning.ingestLearningEvent(student, events[4])).resolves.toEqual({
      accepted: true,
      duplicate: false,
      answer: null,
    });
    await expect(learning.ingestLearningEvent(student, events[1])).resolves.toEqual({
      accepted: false,
      duplicate: true,
      answer: { stepId: 'quiz_force', attempt: 1, correct: false },
    });
    await expect(learning.ingestLearningEvent(otherStudent, events[1])).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(
      learning.ingestLearningEvent(student, { ...events[1], stepId: 'changed_step' }),
    ).rejects.toBeInstanceOf(ConflictError);

    const progress = await learning.listTeacherProgress(
      teacher,
      organizationId,
      classId,
      assignment.id,
    );
    const eventCount = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM learning_events WHERE attempt_id = $1',
      [attempt.id],
    );

    expect(eventCount.rows).toEqual([{ count: 5 }]);
    await expect(
      database.query('DELETE FROM learning_events WHERE attempt_id = $1', [attempt.id]),
    ).rejects.toThrow();
    expect(progress).toEqual([
      {
        assignmentId: assignment.id,
        studentId: student.userId,
        started: true,
        wrongAnswers: 2,
        retries: 2,
        completed: true,
        lastSequence: 4,
        lastStepId: 'complete',
        projectionVersion: 5,
        updatedAt: '2026-08-29T12:00:00.000Z',
      },
    ]);
    await expect(
      learning.startOrResumeAttempt(student, organizationId, assignment.id),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      resumed: true,
      nextSequence: 5,
      answers: [{ stepId: 'quiz_force', attempts: 3, correct: true }],
    });
  });

  it('accepts a correct first answer and rejects retry after success or further completed events', async () => {
    const { assignment, attempt, player } = await createAssignmentAndAttempt();
    const base = {
      schemaVersion: 1 as const,
      organizationId,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: player.experienceVersion,
      occurredAt: '2026-08-29T12:00:00.000Z',
    };
    await learning.ingestLearningEvent(student, {
      ...base,
      eventId: eventIds.started,
      type: 'EXPERIENCE_STARTED',
      stepId: 'start',
      sequence: 0,
      payload: {},
    });
    await expect(
      learning.ingestLearningEvent(student, {
        ...base,
        eventId: eventIds.wrong,
        type: 'QUESTION_ANSWERED',
        stepId: 'quiz_force',
        sequence: 1,
        payload: { optionId: 'light', attempt: 1, elapsedMs: 400 },
      }),
    ).resolves.toMatchObject({ answer: { correct: true } });
    await expect(
      learning.ingestLearningEvent(student, {
        ...base,
        eventId: eventIds.retry,
        type: 'ANSWER_RETRIED',
        stepId: 'quiz_force',
        sequence: 2,
        payload: { optionId: 'heavy', attempt: 2, elapsedMs: 300 },
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await learning.ingestLearningEvent(student, {
      ...base,
      eventId: eventIds.completed,
      type: 'EXPERIENCE_COMPLETED',
      stepId: 'complete',
      sequence: 2,
      payload: { elapsedMs: 2_000 },
    });
    await expect(
      learning.ingestLearningEvent(student, {
        ...base,
        eventId: eventIds.retryAgain,
        type: 'EXPERIENCE_COMPLETED',
        stepId: 'complete',
        sequence: 3,
        payload: { elapsedMs: 2_100 },
      }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it('writes redacted trace-correlated audits for M3/M4 success, duplicate, denial, and conflict', async () => {
    const traceIds = {
      create: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa01',
      validate: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa02',
      review: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa03',
      assign: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa04',
      attempt: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa05',
      event: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa06',
      duplicate: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa07',
      conflict: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa08',
      progress: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa09',
      denied: '018f72a4-cc52-7c5a-a6f9-8b21aa27fa10',
    } as const;
    const version = await learning.createScienceExperience(
      teacher,
      organizationId,
      '감사 가능한 체험',
      generatedSpecText,
      traceIds.create,
    );
    await learning.validateExperienceVersion(
      teacher,
      organizationId,
      version.versionId,
      traceIds.validate,
    );
    await learning.reviewExperienceVersion(
      teacher,
      organizationId,
      version.versionId,
      { decision: 'APPROVE' },
      traceIds.review,
    );
    const assignment = await learning.createAssignment(
      teacher,
      organizationId,
      classId,
      { experienceVersionId: version.versionId },
      traceIds.assign,
    );
    const attempt = await learning.startOrResumeAttempt(
      student,
      organizationId,
      assignment.id,
      traceIds.attempt,
    );
    const player = await learning.getPlayerSession(student, organizationId, assignment.id);
    const started: ClientLearningEvent = {
      schemaVersion: 1,
      eventId: eventIds.started,
      type: 'EXPERIENCE_STARTED',
      organizationId,
      assignmentId: assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: player.experienceVersion,
      stepId: 'start',
      sequence: 0,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: {},
    };
    await learning.ingestLearningEvent(student, started, traceIds.event);
    await learning.ingestLearningEvent(student, started, traceIds.duplicate);
    await expect(
      learning.ingestLearningEvent(
        student,
        {
          ...started,
          eventId: eventIds.completed,
          type: 'EXPERIENCE_COMPLETED',
          stepId: 'complete',
          sequence: 1,
          payload: { elapsedMs: 100 },
        },
        traceIds.conflict,
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await learning.listTeacherProgress(
      teacher,
      organizationId,
      classId,
      assignment.id,
      traceIds.progress,
    );
    await expect(
      learning.createAssignment(
        otherTeacher,
        organizationId,
        classId,
        { experienceVersionId: version.versionId },
        traceIds.denied,
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const audits = await database.query<{
      trace_id: string;
      action: string;
      outcome: string;
    }>(
      `SELECT trace_id, action, outcome
       FROM audit_logs
       WHERE trace_id = ANY($1::uuid[])
       ORDER BY trace_id`,
      [Object.values(traceIds)],
    );
    expect(audits.rows).toEqual([
      { trace_id: traceIds.create, action: 'EXPERIENCE_CREATED', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.validate, action: 'EXPERIENCE_VALIDATED', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.review, action: 'EXPERIENCE_REVIEWED', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.assign, action: 'ASSIGNMENT_CREATED', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.attempt, action: 'ATTEMPT_STARTED', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.event, action: 'LEARNING_EVENT_INGESTED', outcome: 'SUCCEEDED' },
      {
        trace_id: traceIds.duplicate,
        action: 'LEARNING_EVENT_INGESTED',
        outcome: 'CONFLICT',
      },
      { trace_id: traceIds.conflict, action: 'LEARNING_EVENT_INGESTED', outcome: 'CONFLICT' },
      { trace_id: traceIds.progress, action: 'PROGRESS_READ', outcome: 'SUCCEEDED' },
      { trace_id: traceIds.denied, action: 'ASSIGNMENT_CREATED', outcome: 'DENIED' },
    ]);
    const serialized = JSON.stringify(audits.rows);
    expect(serialized).not.toContain('감사 가능한 체험');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('light');
  });

  it('rolls back a protected write when its success audit cannot be committed', async () => {
    await database.exec(
      "ALTER TABLE audit_logs ADD CONSTRAINT reject_experience_created CHECK (action <> 'EXPERIENCE_CREATED')",
    );

    await expect(
      learning.createScienceExperience(
        teacher,
        organizationId,
        '감사 실패 시 롤백',
        generatedSpecText,
      ),
    ).rejects.toThrow();

    const experiences = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM experiences WHERE organization_id = $1',
      [organizationId],
    );
    expect(experiences.rows).toEqual([{ count: 0 }]);
  });
});
