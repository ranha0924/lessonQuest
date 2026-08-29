import { describe, expect, it } from 'vitest';

import {
  assignmentSchema,
  attemptSessionSchema,
  createAssignmentInputSchema,
  createScienceExperienceInputSchema,
  createdScienceExperienceSchema,
  eventIngestionResultSchema,
  experiencePreviewSchema,
  experienceReviewResultSchema,
  experienceValidationResultSchema,
  playerSessionSchema,
  reviewExperienceVersionInputSchema,
  studentAssignmentListSchema,
  studentProgressSchema,
  studentProgressListSchema,
} from '../src/learning.js';
import { validScienceSpec } from './science.test.js';

const versionId = '018f72a4-cc52-7c5a-a6f9-8b21aa27e101';

describe('science and assignment request contracts', () => {
  it('accepts only teacher-authored content fields and rejects server-owned fields', () => {
    const valid = {
      title: '힘과 운동',
      generatedSpecText: '{"schemaVersion":1}',
    };

    expect(createScienceExperienceInputSchema.parse(valid)).toEqual(valid);
    for (const injected of [
      { ...valid, organizationId: versionId },
      { ...valid, ownerId: versionId },
      { ...valid, status: 'APPROVED' },
      { ...valid, contentHash: `sha256:${'a'.repeat(64)}` },
      { ...valid, artifact: '<script>alert(1)</script>' },
    ]) {
      expect(createScienceExperienceInputSchema.safeParse(injected).success).toBe(false);
    }
  });

  it('bounds generated text and review notes and keeps the decision allowlisted', () => {
    expect(
      createScienceExperienceInputSchema.safeParse({
        title: '힘과 운동',
        generatedSpecText: '가'.repeat(32_769),
      }).success,
    ).toBe(false);
    expect(
      reviewExperienceVersionInputSchema.parse({ decision: 'APPROVE', note: '검토 완료' }),
    ).toEqual({ decision: 'APPROVE', note: '검토 완료' });
    expect(
      reviewExperienceVersionInputSchema.safeParse({ decision: 'PUBLISH', role: 'SUPER_ADMIN' })
        .success,
    ).toBe(false);
  });

  it('accepts an approved-version assignment window and rejects inverted or injected windows', () => {
    const valid = {
      experienceVersionId: versionId,
      startsAt: '2026-08-29T00:00:00.000Z',
      dueAt: '2026-09-05T00:00:00.000Z',
    };

    expect(createAssignmentInputSchema.parse(valid)).toEqual(valid);
    expect(createAssignmentInputSchema.safeParse({ ...valid, dueAt: valid.startsAt }).success).toBe(
      false,
    );
    expect(createAssignmentInputSchema.safeParse({ ...valid, status: 'PUBLISHED' }).success).toBe(
      false,
    );
    expect(
      createAssignmentInputSchema.safeParse({
        experienceVersionId: versionId,
        startsAt: '2026-08-29T12:30:00+09:00',
        dueAt: '2026-08-29T04:00:00Z',
      }).success,
    ).toBe(true);
  });
});

describe('M4 response contracts', () => {
  it('validates a replayable progress projection without answer content or rank', () => {
    const progress = {
      assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e102',
      studentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e103',
      started: true,
      wrongAnswers: 1,
      retries: 1,
      completed: true,
      lastSequence: 3,
      lastStepId: 'complete',
      projectionVersion: 4,
      updatedAt: '2026-08-29T12:00:00.000Z',
    };

    expect(studentProgressSchema.parse(progress)).toEqual(progress);
    expect(studentProgressSchema.safeParse({ ...progress, answer: '정답' }).success).toBe(false);
    expect(studentProgressSchema.safeParse({ ...progress, rank: 1 }).success).toBe(false);
  });

  it('distinguishes accepted events from exact duplicate retransmissions', () => {
    expect(
      eventIngestionResultSchema.parse({ accepted: true, duplicate: false, answer: null }),
    ).toEqual({
      accepted: true,
      duplicate: false,
      answer: null,
    });
    expect(
      eventIngestionResultSchema.parse({
        accepted: false,
        duplicate: true,
        answer: { stepId: 'quiz_force', attempt: 1, correct: false },
      }),
    ).toEqual({
      accepted: false,
      duplicate: true,
      answer: { stepId: 'quiz_force', attempt: 1, correct: false },
    });
    expect(
      eventIngestionResultSchema.safeParse({ accepted: false, duplicate: false, answer: null })
        .success,
    ).toBe(false);
  });

  it('strictly validates every M3/M4 response boundary', () => {
    const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27e104';
    const classId = '018f72a4-cc52-7c5a-a6f9-8b21aa27e105';
    const assignmentId = '018f72a4-cc52-7c5a-a6f9-8b21aa27e106';
    const attemptId = '018f72a4-cc52-7c5a-a6f9-8b21aa27e107';
    const contentHash = `sha256:${'a'.repeat(64)}`;
    const report = {
      policyVersion: 'science-validator-1',
      verdict: 'PASS',
      findings: [],
    } as const;
    const assignment = {
      id: assignmentId,
      organizationId,
      classId,
      experienceVersionId: versionId,
      startsAt: '2026-08-29T12:00:00.000Z',
      dueAt: null,
      status: 'ACTIVE',
    } as const;
    const safeQuiz = validScienceSpec.blocks[3];
    const studentSpecification = {
      ...validScienceSpec,
      blocks: [
        ...validScienceSpec.blocks.slice(0, 3),
        {
          id: safeQuiz.id,
          kind: safeQuiz.kind,
          question: safeQuiz.question,
          options: safeQuiz.options.map(({ id, label }) => ({ id, label })),
          objectiveIds: safeQuiz.objectiveIds,
        },
        validScienceSpec.blocks[4],
      ],
    };

    expect(
      createdScienceExperienceSchema.parse({
        experienceId: organizationId,
        publicId: 'science_force_01',
        versionId,
        version: 1,
        status: 'GENERATED',
        contentHash,
      }),
    ).toBeTruthy();
    expect(
      experienceValidationResultSchema.parse({ versionId, status: 'VALIDATED', report }),
    ).toBeTruthy();
    expect(experienceReviewResultSchema.parse({ versionId, status: 'APPROVED' })).toBeTruthy();
    expect(
      experiencePreviewSchema.parse({
        versionId,
        status: 'VALIDATED',
        contentHash,
        specification: validScienceSpec,
        sandboxDocument: '<!doctype html>',
        validationReport: report,
      }),
    ).toBeTruthy();
    expect(assignmentSchema.parse(assignment)).toEqual(assignment);
    expect(
      studentAssignmentListSchema.parse([
        { ...assignment, title: '힘과 운동', attemptStatus: null },
      ]),
    ).toHaveLength(1);
    expect(
      attemptSessionSchema.parse({
        id: attemptId,
        assignmentId,
        status: 'IN_PROGRESS',
        resumed: true,
        nextSequence: 2,
        answers: [{ stepId: 'quiz_force', attempts: 1, correct: false }],
      }),
    ).toBeTruthy();
    expect(
      playerSessionSchema.parse({
        assignmentId,
        attemptId,
        experienceId: 'science_force_01',
        experienceVersion: 1,
        contentHash,
        specification: studentSpecification,
        sandboxDocument: '<!doctype html>',
      }),
    ).toBeTruthy();
    expect(studentProgressListSchema.parse([])).toEqual([]);
    expect(assignmentSchema.safeParse({ ...assignment, attacker: true }).success).toBe(false);
    expect(
      playerSessionSchema.safeParse({
        assignmentId,
        attemptId,
        experienceId: 'science_force_01',
        experienceVersion: 1,
        contentHash,
        specification: validScienceSpec,
        sandboxDocument: '<!doctype html>',
      }).success,
    ).toBe(false);
  });
});
