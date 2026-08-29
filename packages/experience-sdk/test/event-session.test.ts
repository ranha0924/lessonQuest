import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExperienceEventSession } from '../src/index.js';

const context = {
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27b101',
  assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27b102',
  attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27b103',
  experienceId: 'science_force_01',
  experienceVersion: 1,
} as const;
const ids = [
  '018f72a4-cc52-7c5a-a6f9-8b21aa27b201',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27b202',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27b203',
  '018f72a4-cc52-7c5a-a6f9-8b21aa27b204',
] as const;

describe('createExperienceEventSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds literal start, wrong, retry, and completion envelopes with monotonic sequences', () => {
    let idIndex = 0;
    const session = createExperienceEventSession(context, {
      createId: () => ids[idIndex++]!,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });

    expect(session.started('start')).toEqual({
      schemaVersion: 1,
      eventId: ids[0],
      type: 'EXPERIENCE_STARTED',
      ...context,
      stepId: 'start',
      sequence: 0,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: {},
    });
    expect(session.wrongAnswer('quiz_force', 1, 1_200)).toEqual({
      schemaVersion: 1,
      eventId: ids[1],
      type: 'QUESTION_ANSWERED',
      ...context,
      stepId: 'quiz_force',
      sequence: 1,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: { correct: false, attempt: 1, elapsedMs: 1_200 },
    });
    expect(session.retriedAnswer('quiz_force', 2, 700)).toEqual({
      schemaVersion: 1,
      eventId: ids[2],
      type: 'ANSWER_RETRIED',
      ...context,
      stepId: 'quiz_force',
      sequence: 2,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: { correct: true, attempt: 2, elapsedMs: 700 },
    });
    expect(session.completed('complete', 8_000)).toEqual({
      schemaVersion: 1,
      eventId: ids[3],
      type: 'EXPERIENCE_COMPLETED',
      ...context,
      stepId: 'complete',
      sequence: 3,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: { elapsedMs: 8_000 },
    });
  });

  it('rejects invalid fixed context and invalid event measurements through shared contracts', () => {
    expect(() =>
      createExperienceEventSession({ ...context, organizationId: 'attacker-org' }),
    ).toThrow();
    const session = createExperienceEventSession(context);

    expect(() => session.started('../escape')).toThrow();
    expect(() => session.wrongAnswer('quiz_force', 0, 100)).toThrow();
    expect(() => session.retriedAnswer('quiz_force', 101, 100)).toThrow();
    expect(() => session.completed('complete', -1)).toThrow();
  });

  it('does not expose an API for changing authority context or emitting boss damage', () => {
    const session = createExperienceEventSession(context);
    const keys = Object.keys(session).sort();

    expect(keys).toEqual(['completed', 'retriedAnswer', 'started', 'wrongAnswer']);
    expect(keys).not.toContain('setOrganizationId');
    expect(keys).not.toContain('bossDamage');
  });

  it('uses platform Web Crypto by default so the SDK remains browser compatible', () => {
    vi.stubGlobal('crypto', { randomUUID: () => ids[0] });

    expect(createExperienceEventSession(context).started('start').eventId).toBe(ids[0]);
  });
});
