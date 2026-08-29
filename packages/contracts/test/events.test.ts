import { describe, expect, it } from 'vitest';

import { clientLearningEventSchema, serverLearningEventSchema } from '../src/events.js';

const base = {
  schemaVersion: 1,
  eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c301',
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c302',
  assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c303',
  attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c304',
  experienceId: 'science_inertia_01',
  experienceVersion: 1,
  stepId: 'q_04',
  sequence: 7,
  occurredAt: '2026-08-29T03:20:10.000Z',
} as const;

describe('clientLearningEventSchema', () => {
  it('accepts a bounded question answer event', () => {
    const event = {
      ...base,
      type: 'QUESTION_ANSWERED',
      payload: { correct: false, attempt: 1, elapsedMs: 18_400 },
    } as const;

    expect(clientLearningEventSchema.parse(event)).toEqual(event);
  });

  it.each([
    { attempt: 0, elapsedMs: 18_400 },
    { attempt: 1, elapsedMs: -1 },
    { attempt: 1, elapsedMs: 86_400_001 },
  ])('rejects invalid question payload bounds: %o', (payload) => {
    expect(() =>
      clientLearningEventSchema.parse({
        ...base,
        type: 'QUESTION_ANSWERED',
        payload: { correct: false, ...payload },
      }),
    ).toThrow();
  });

  it('rejects answer text that is outside the event contract', () => {
    expect(() =>
      clientLearningEventSchema.parse({
        ...base,
        type: 'QUESTION_ANSWERED',
        payload: { correct: false, attempt: 1, elapsedMs: 100, answerText: '학생 원문' },
      }),
    ).toThrow();
  });

  it('rejects a timestamp without a timezone offset', () => {
    expect(() =>
      clientLearningEventSchema.parse({
        ...base,
        occurredAt: '2026-08-29T03:20:10',
        type: 'EXPERIENCE_STARTED',
        payload: {},
      }),
    ).toThrow();
  });

  it('rejects client-authored boss damage', () => {
    expect(() =>
      clientLearningEventSchema.parse({
        ...base,
        type: 'BOSS_DAMAGE_EARNED',
        payload: { amount: 4, reason: 'answer_retried' },
      }),
    ).toThrow();
  });

  it('rejects unknown event types and extra top-level fields', () => {
    expect(() =>
      clientLearningEventSchema.parse({ ...base, type: 'ADMIN_GRANTED', payload: {} }),
    ).toThrow();
    expect(() =>
      clientLearningEventSchema.parse({
        ...base,
        type: 'EXPERIENCE_STARTED',
        payload: {},
        trusted: true,
      }),
    ).toThrow();
  });
});

describe('serverLearningEventSchema', () => {
  it('accepts bounded server-derived boss damage', () => {
    const event = {
      ...base,
      type: 'BOSS_DAMAGE_EARNED',
      payload: { amount: 4, reason: 'answer_retried' },
    } as const;

    expect(serverLearningEventSchema.parse(event)).toEqual(event);
  });

  it('rejects out-of-policy server boss damage', () => {
    expect(() =>
      serverLearningEventSchema.parse({
        ...base,
        type: 'BOSS_DAMAGE_EARNED',
        payload: { amount: 10_001, reason: 'answer_retried' },
      }),
    ).toThrow();
  });
});
