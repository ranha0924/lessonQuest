import { readFile } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import type { Actor, ClientLearningEvent } from '@lessonquest/contracts';
import { ScienceGenerationError } from '@lessonquest/science-studio';
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

const now = new Date('2026-08-29T12:00:00.000Z');
const eventIds = {
  started: '018f72a4-cc52-7c5a-a6f9-8b21aa27f201',
  wrong: '018f72a4-cc52-7c5a-a6f9-8b21aa27f202',
  retry: '018f72a4-cc52-7c5a-a6f9-8b21aa27f203',
  completed: '018f72a4-cc52-7c5a-a6f9-8b21aa27f204',
} as const;

describe('LearningRepository M3 and M4 lifecycle', () => {
  let database: PGlite;
  let tenants: TenantRepository;
  let learning: LearningRepository;
  let generatedSpecText: string;
  let organizationId: string;
  let classId: string;

  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    tenants = new TenantRepository(database);
    learning = new LearningRepository(database, { now: () => now });
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
    expect(first).toMatchObject({ resumed: false, status: 'READY' });
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
    const events: ClientLearningEvent[] = [
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
        payload: { correct: false, attempt: 1, elapsedMs: 1_200 },
      },
      {
        ...eventBase,
        eventId: eventIds.retry,
        type: 'ANSWER_RETRIED',
        stepId: 'quiz_force',
        sequence: 2,
        payload: { correct: true, attempt: 2, elapsedMs: 700 },
      },
      {
        ...eventBase,
        eventId: eventIds.completed,
        type: 'EXPERIENCE_COMPLETED',
        stepId: 'complete',
        sequence: 3,
        payload: { elapsedMs: 8_000 },
      },
    ];

    for (const event of events) {
      await expect(learning.ingestLearningEvent(student, event)).resolves.toEqual({
        accepted: true,
        duplicate: false,
      });
    }
    await expect(learning.ingestLearningEvent(student, events[1]!)).resolves.toEqual({
      accepted: false,
      duplicate: true,
    });
    await expect(learning.ingestLearningEvent(otherStudent, events[1]!)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(
      learning.ingestLearningEvent(student, { ...events[1]!, stepId: 'changed_step' }),
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

    expect(eventCount.rows).toEqual([{ count: 4 }]);
    await expect(
      database.query('DELETE FROM learning_events WHERE attempt_id = $1', [attempt.id]),
    ).rejects.toThrow();
    expect(progress).toEqual([
      {
        assignmentId: assignment.id,
        studentId: student.userId,
        started: true,
        wrongAnswers: 1,
        retries: 1,
        completed: true,
        lastSequence: 3,
        lastStepId: 'complete',
        projectionVersion: 4,
        updatedAt: '2026-08-29T12:00:00.000Z',
      },
    ]);
  });
});
