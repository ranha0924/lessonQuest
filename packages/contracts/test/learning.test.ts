import { describe, expect, it } from 'vitest';

import {
  createAssignmentInputSchema,
  createScienceExperienceInputSchema,
  eventIngestionResultSchema,
  reviewExperienceVersionInputSchema,
  studentProgressSchema,
} from '../src/learning.js';

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
    expect(eventIngestionResultSchema.parse({ accepted: true, duplicate: false })).toEqual({
      accepted: true,
      duplicate: false,
    });
    expect(eventIngestionResultSchema.parse({ accepted: false, duplicate: true })).toEqual({
      accepted: false,
      duplicate: true,
    });
    expect(
      eventIngestionResultSchema.safeParse({ accepted: false, duplicate: false }).success,
    ).toBe(false);
  });
});
