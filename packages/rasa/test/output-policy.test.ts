import { describe, expect, it } from 'vitest';

import { validateHintOutput } from '../src/index.js';
import { context } from './test-context.js';

const valid = { action: 'SHOW_HINT', experienceId: 'science_inertia_01', stepId: 'q_04', level: 1, content: '버스와 몸의 운동 상태를 나누어 생각해 보자.' };

describe('validateHintOutput', () => {
  it('accepts only the expected contextual hint', () => {
    expect(validateHintOutput({ rawAction: valid, context, expectedLevel: 1, correctOptionId: 'keep_moving', correctOptionLabel: '몸은 계속 앞으로 움직인다' })).toEqual(valid);
  });

  it.each([
    { ...valid, action: 'GO_TO_STEP' }, { ...valid, level: 2 }, { ...valid, stepId: 'other' },
    { ...valid, extra: true }, { ...valid, content: '정답은 2번입니다.' },
    { ...valid, content: 'The correct answer is option B.' }, { ...valid, content: 'keep_moving' },
    { ...valid, content: '몸은   계속 앞으로 움직인다' }, { ...valid, content: 'https://evil.example' },
    { ...valid, content: '<script>alert(1)</script>' }, { ...valid, content: '다음 코드를 실행하세요' },
  ])('rejects unsafe or substituted output %#', (rawAction) => {
    expect(() => validateHintOutput({ rawAction, context, expectedLevel: 1, correctOptionId: 'keep_moving', correctOptionLabel: '몸은 계속 앞으로 움직인다' })).toThrow();
  });
});
