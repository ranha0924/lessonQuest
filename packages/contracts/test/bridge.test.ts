import { describe, expect, it } from 'vitest';

import { BridgeMessageError, parseBridgeMessage } from '../src/bridge.js';

const nonce = 'a'.repeat(43);
const sessionId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c501';
const runnerOrigin = 'https://runner.lessonquest.test';

const trust = {
  actualOrigin: runnerOrigin,
  expectedOrigin: runnerOrigin,
  expectedNonce: nonce,
  sourceMatches: true,
} as const;

const readyMessage = {
  channel: 'lessonquest',
  schemaVersion: 1,
  sessionId,
  nonce,
  type: 'RUNNER_READY',
  payload: {
    experienceId: 'science_inertia_01',
    experienceVersion: 1,
  },
} as const;

const expectBridgeCode = (operation: () => unknown, code: BridgeMessageError['code']) => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(BridgeMessageError);
    expect((error as BridgeMessageError).code).toBe(code);
    return;
  }
  throw new Error(`Expected BridgeMessageError with code ${code}`);
};

describe('parseBridgeMessage', () => {
  it('accepts an exact runner-ready envelope', () => {
    expect(parseBridgeMessage(readyMessage, trust)).toEqual(readyMessage);
  });

  it('rejects a message from the wrong window source', () => {
    expectBridgeCode(
      () => parseBridgeMessage(readyMessage, { ...trust, sourceMatches: false }),
      'SOURCE_MISMATCH',
    );
  });

  it('rejects a message from the wrong origin', () => {
    expectBridgeCode(
      () => parseBridgeMessage(readyMessage, { ...trust, actualOrigin: 'https://evil.example' }),
      'ORIGIN_MISMATCH',
    );
  });

  it('rejects a message with the wrong session nonce', () => {
    expectBridgeCode(
      () => parseBridgeMessage({ ...readyMessage, nonce: 'b'.repeat(43) }, trust),
      'NONCE_MISMATCH',
    );
  });

  it.each([
    { ...readyMessage, channel: 'other' },
    { ...readyMessage, schemaVersion: 2 },
    { ...readyMessage, type: 'RUN_COMMAND' },
    { ...readyMessage, trusted: true },
  ])('rejects an invalid or expanded envelope', (message) => {
    expectBridgeCode(() => parseBridgeMessage(message, trust), 'INVALID_MESSAGE');
  });

  it('validates a Rasa action payload through the action contract', () => {
    const message = {
      ...readyMessage,
      type: 'RASA_ACTION',
      payload: {
        action: 'SHOW_HINT',
        experienceId: 'science_inertia_01',
        stepId: 'q_04',
        level: 1,
        content: '운동 상태가 언제 바뀌는지 먼저 표시해 보자.',
      },
    } as const;

    expect(parseBridgeMessage(message, trust)).toEqual(message);
    expectBridgeCode(
      () =>
        parseBridgeMessage(
          { ...message, payload: { ...message.payload, finalAnswer: '1번' } },
          trust,
        ),
      'INVALID_MESSAGE',
    );
  });

  it('rejects client-authored boss damage inside a learning event', () => {
    const message = {
      ...readyMessage,
      type: 'LEARNING_EVENT',
      payload: {
        schemaVersion: 1,
        eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c511',
        organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c512',
        assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c513',
        attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c514',
        experienceId: 'science_inertia_01',
        experienceVersion: 1,
        stepId: 'q_04',
        sequence: 8,
        occurredAt: '2026-08-29T03:20:20.000Z',
        type: 'BOSS_DAMAGE_EARNED',
        payload: { amount: 9_999, reason: 'answer_correct' },
      },
    } as const;

    expectBridgeCode(() => parseBridgeMessage(message, trust), 'INVALID_MESSAGE');
  });

  it('does not echo attacker-controlled data in rejection messages', () => {
    const marker = 'SECRET_ATTACKER_MARKER';
    try {
      parseBridgeMessage({ ...readyMessage, payload: marker }, trust);
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeMessageError);
      expect((error as Error).message).not.toContain(marker);
    }
  });
});
