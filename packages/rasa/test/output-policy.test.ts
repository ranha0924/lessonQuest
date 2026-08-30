import { describe, expect, it } from 'vitest';

import { validateHintOutput } from '../src/index.js';
import { context } from './test-context.js';

const valid = {
  action: 'SHOW_HINT',
  experienceId: 'science_inertia_01',
  stepId: 'q_04',
  level: 1,
  content: '버스와 몸의 운동 상태를 나누어 생각해 보자.',
};

describe('validateHintOutput', () => {
  it('accepts only the expected contextual hint', () => {
    expect(
      validateHintOutput({
        rawAction: valid,
        context,
        expectedLevel: 1,
        correctOptionId: 'keep_moving',
        correctOptionLabel: '몸은 계속 앞으로 움직인다',
      }),
    ).toEqual(valid);
  });

  it.each([
    { ...valid, action: 'GO_TO_STEP' },
    { ...valid, level: 2 },
    { ...valid, stepId: 'other' },
    { ...valid, extra: true },
    { ...valid, content: '정답은 2번입니다.' },
    { ...valid, content: 'The correct answer is option B.' },
    { ...valid, content: '2번을 고르세요.' },
    { ...valid, content: 'Choose option B.' },
    { ...valid, content: '두 번째 선택지가 맞아요.' },
    { ...valid, content: 'B를 선택하세요.' },
    { ...valid, content: 'Select option B.' },
    { ...valid, content: 'Pick choice C.' },
    { ...valid, content: 'B가 맞아요.' },
    { ...valid, content: 'Option B is correct.' },
    { ...valid, content: 'The correct choice is C.' },
    { ...valid, content: '가장 적절한 것은 B입니다.' },
    { ...valid, content: 'Mark B as your answer.' },
    { ...valid, content: 'OPTION B: IS CORRECT.' },
    { ...valid, content: 'Option (B) is correct.' },
    { ...valid, content: 'The correct choice: C.' },
    { ...valid, content: 'The correct choice — C.' },
    { ...valid, content: 'Mark B, as your answer.' },
    { ...valid, content: '가장 적절한 것은 “B”입니다.' },
    { ...valid, content: 'B! 가 맞아요.' },
    { ...valid, content: '2번을, 고르세요.' },
    { ...valid, content: 'Choose\u200B option B.' },
    { ...valid, content: 'Option B\u2060 is correct.' },
    { ...valid, content: 'B\u00AD가 맞아요.' },
    { ...valid, content: '2번을\u034F 고르세요.' },
    { ...valid, content: 'Mark B\uFE0F as your answer.' },
    { ...valid, content: 'Option 🅱️ is correct.' },
    { ...valid, content: 'keep_moving' },
    { ...valid, content: '몸은   계속 앞으로 움직인다' },
    { ...valid, content: 'https://evil.example' },
    { ...valid, content: '<script>alert(1)</script>' },
    { ...valid, content: '다음 코드를 실행하세요' },
  ])('rejects unsafe or substituted output %#', (rawAction) => {
    expect(() =>
      validateHintOutput({
        rawAction,
        context,
        expectedLevel: 1,
        correctOptionId: 'keep_moving',
        correctOptionLabel: '몸은 계속 앞으로 움직인다',
      }),
    ).toThrow();
  });
});
