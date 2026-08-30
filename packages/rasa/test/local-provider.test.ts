import { describe, expect, it } from 'vitest';

import { LocalRasaProvider, estimateTokens } from '../src/index.js';

const context = {
  schemaVersion: 1,
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c401',
  assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c402',
  sessionId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c403',
  student: { id: '018f72a4-cc52-7c5a-a6f9-8b21aa27c404', gradeBand: 'middle1' },
  learning: {
    subject: 'science', unit: 'force_and_motion', experienceId: 'science_inertia_01',
    experienceVersion: 1, sceneId: 'bus_scene', stepId: 'q_04',
    questionSummary: '버스가 급정거할 때 몸의 움직임',
    recentResponses: [{ correct: false }], usedHintLevels: [],
  },
  teacherPolicy: { learningObjectives: ['관성을 실제 상황에 적용한다'], maxHintLevel: 3, forbidFinalAnswer: true },
} as const;

describe('LocalRasaProvider', () => {
  it.each([1, 2, 3] as const)('returns deterministic bounded level-%s usage and hint', async (level) => {
    const provider = new LocalRasaProvider(() => 7);
    const input = { context, hintLevel: level, conceptSummary: '관성은 운동 상태를 유지하려는 성질이다.', simulationSummary: '버스의 속도 변화를 관찰한다.' };
    const first = await provider.generateHint(input, new AbortController().signal);
    const second = await provider.generateHint(input, new AbortController().signal);
    expect(first.action).toEqual(second.action);
    expect(first.action).toMatchObject({ action: 'SHOW_HINT', level, stepId: 'q_04' });
    expect(first.usage).toMatchObject({ provider: 'local', model: 'local-rasa-v1', costMicros: 0, latencyMs: 7 });
    expect(first.usage.inputTokens).toBeGreaterThan(0);
    expect(first.usage.outputTokens).toBeGreaterThan(0);
  });

  it('uses stable character estimates and rejects an already-aborted call', async () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    const controller = new AbortController();
    controller.abort();
    await expect(new LocalRasaProvider().generateHint({ context, hintLevel: 1, conceptSummary: '관성' }, controller.signal)).rejects.toMatchObject({ code: 'RASA_PROVIDER_ABORTED' });
  });
});
