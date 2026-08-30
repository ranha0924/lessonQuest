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

  it('builds literal start, answer, retry, and completion envelopes with monotonic sequences', () => {
    let idIndex = 0;
    const session = createExperienceEventSession(context, {
      createId: () => ids[idIndex++]!,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });

    const started = session.started('start');
    expect(started).toEqual({
      schemaVersion: 1,
      eventId: ids[0],
      type: 'EXPERIENCE_STARTED',
      ...context,
      stepId: 'start',
      sequence: 0,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: {},
    });
    session.acknowledge(started.eventId, 1);
    const answered = session.answered('quiz_force', 'heavy', 1, 1_200);
    expect(answered).toEqual({
      schemaVersion: 1,
      eventId: ids[1],
      type: 'QUESTION_ANSWERED',
      ...context,
      stepId: 'quiz_force',
      sequence: 1,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_200 },
    });
    session.acknowledge(answered.eventId, 2);
    const retried = session.retried('quiz_force', 'light', 2, 700);
    expect(retried).toEqual({
      schemaVersion: 1,
      eventId: ids[2],
      type: 'ANSWER_RETRIED',
      ...context,
      stepId: 'quiz_force',
      sequence: 2,
      occurredAt: '2026-08-29T12:00:00.000Z',
      payload: { optionId: 'light', attempt: 2, elapsedMs: 700 },
    });
    session.acknowledge(retried.eventId, 3);
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
    expect(() => session.answered('quiz_force', 'heavy', 0, 100)).toThrow();
    expect(() => session.retried('quiz_force', 'light', 101, 100)).toThrow();
    expect(() => session.completed('complete', -1)).toThrow();
  });

  it('does not expose an API for changing authority context or emitting boss damage', () => {
    const session = createExperienceEventSession(context);
    const keys = Object.keys(session).sort();

    expect(keys).toEqual(['acknowledge', 'answered', 'completed', 'retried', 'started', 'synchronize']);
    expect(keys).not.toContain('setOrganizationId');
    expect(keys).not.toContain('bossDamage');
  });

  it('uses platform Web Crypto by default so the SDK remains browser compatible', () => {
    vi.stubGlobal('crypto', { randomUUID: () => ids[0] });

    expect(createExperienceEventSession(context).started('start').eventId).toBe(ids[0]);
  });

  it('continues from a server-owned resume sequence', () => {
    const session = createExperienceEventSession(context, {
      initialSequence: 4,
      createId: () => ids[0],
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });

    expect(session.retried('quiz_force', 'light', 3, 500).sequence).toBe(4);
    expect(() => createExperienceEventSession(context, { initialSequence: -1 })).toThrow();
  });

  it('retains one exact pending envelope until acknowledged', () => {
    let idIndex = 0;
    const session = createExperienceEventSession(context, {
      createId: () => ids[idIndex++]!,
      now: () => new Date('2026-08-29T12:00:00.000Z'),
    });

    const first = session.answered('quiz_force', 'heavy', 1, 1_200);
    const retriedDelivery = session.answered('quiz_force', 'heavy', 1, 1_200);
    expect(retriedDelivery).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(() => session.completed('complete', 8_000)).toThrow(/pending/i);
    expect(() => session.acknowledge(ids[1], 1)).toThrow();
    session.acknowledge(first.eventId, 3);
    expect(session.completed('complete', 8_000).sequence).toBe(3);
  });

  it('synchronizes only forward while no event is pending', () => {
    const session = createExperienceEventSession(context, { initialSequence: 2, createId: () => ids[0] });
    session.synchronize(5);
    expect(session.started('start').sequence).toBe(5);
    expect(() => session.synchronize(6)).toThrow(/pending/i);
    session.acknowledge(ids[0], 6);
    expect(() => session.acknowledge(ids[0], 6)).toThrow();
    expect(() => session.synchronize(5)).toThrow(/backward/i);
  });
});
