import { describe, expect, it } from 'vitest';

import { rasaActionSchema, rasaContextSchema } from '../src/rasa.js';

const context = {
  schemaVersion: 1,
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c401',
  assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c402',
  sessionId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c403',
  student: {
    id: '018f72a4-cc52-7c5a-a6f9-8b21aa27c404',
    gradeBand: 'middle1',
  },
  learning: {
    subject: 'science',
    unit: 'force_and_motion',
    experienceId: 'science_inertia_01',
    experienceVersion: 1,
    sceneId: 'bus_scene',
    stepId: 'q_04',
    questionSummary: '버스가 급정거할 때 몸의 움직임을 관성으로 설명한다.',
    recentResponses: [{ correct: false, misconceptionTag: 'force_direction' }],
    usedHintLevels: [1],
  },
  teacherPolicy: {
    learningObjectives: ['관성을 실제 상황에 적용한다'],
    maxHintLevel: 2,
    forbidFinalAnswer: true,
  },
} as const;

describe('rasaContextSchema', () => {
  it('accepts the minimum contextual learning state', () => {
    expect(rasaContextSchema.parse(context)).toEqual(context);
  });

  it('rejects missing organization and assignment boundaries', () => {
    const withoutOrganization: Record<string, unknown> = { ...context };
    const withoutAssignment: Record<string, unknown> = { ...context };
    delete withoutOrganization.organizationId;
    delete withoutAssignment.assignmentId;

    expect(() => rasaContextSchema.parse(withoutOrganization)).toThrow();
    expect(() => rasaContextSchema.parse(withoutAssignment)).toThrow();
  });

  it('rejects raw student identity fields and free-form answers', () => {
    expect(() =>
      rasaContextSchema.parse({
        ...context,
        student: { ...context.student, studentEmail: 'student@example.test' },
      }),
    ).toThrow();
    expect(() =>
      rasaContextSchema.parse({
        ...context,
        learning: {
          ...context.learning,
          recentResponses: [{ correct: false, answerText: '학생 원문 답안' }],
        },
      }),
    ).toThrow();
  });

  it('rejects excess history and duplicate hint levels', () => {
    expect(() =>
      rasaContextSchema.parse({
        ...context,
        learning: {
          ...context.learning,
          recentResponses: Array.from({ length: 21 }, () => ({ correct: false })),
        },
      }),
    ).toThrow();
    expect(() =>
      rasaContextSchema.parse({
        ...context,
        learning: { ...context.learning, usedHintLevels: [1, 1] },
      }),
    ).toThrow();
  });

  it('requires the no-final-answer policy', () => {
    expect(() =>
      rasaContextSchema.parse({
        ...context,
        teacherPolicy: { ...context.teacherPolicy, forbidFinalAnswer: false },
      }),
    ).toThrow();
  });
});

describe('rasaActionSchema', () => {
  it('accepts a bounded step hint', () => {
    const action = {
      action: 'SHOW_HINT',
      experienceId: 'science_inertia_01',
      stepId: 'q_04',
      level: 2,
      content: '몸과 버스의 운동 상태가 각각 어떻게 바뀌는지 비교해 보자.',
    } as const;

    expect(rasaActionSchema.parse(action)).toEqual(action);
  });

  it.each(['CLICK_ANYWHERE', 'RUN_COMMAND'])('rejects arbitrary action %s', (action) => {
    expect(() => rasaActionSchema.parse({ action })).toThrow();
  });

  it('rejects a final answer field', () => {
    expect(() =>
      rasaActionSchema.parse({
        action: 'SHOW_HINT',
        experienceId: 'science_inertia_01',
        stepId: 'q_04',
        level: 1,
        content: '힘이 작용하기 전과 후를 비교해 보자.',
        finalAnswer: '1번',
      }),
    ).toThrow();
  });

  it('accepts a teacher help request without an external recipient', () => {
    const action = {
      action: 'REQUEST_TEACHER_HELP',
      experienceId: 'science_inertia_01',
      stepId: 'q_04',
      reason: '두 단계의 힌트 뒤에도 같은 오개념이 반복되었습니다.',
    } as const;

    expect(rasaActionSchema.parse(action)).toEqual(action);
    expect(() =>
      rasaActionSchema.parse({ ...action, teacherEmail: 'teacher@example.test' }),
    ).toThrow();
  });

  it('uses asset identifiers rather than arbitrary media URLs', () => {
    expect(
      rasaActionSchema.parse({
        action: 'SHOW_IMAGE',
        experienceId: 'science_inertia_01',
        stepId: 'q_04',
        assetId: 'inertia_diagram_01',
      }),
    ).toMatchObject({ assetId: 'inertia_diagram_01' });
    expect(() =>
      rasaActionSchema.parse({
        action: 'SHOW_IMAGE',
        experienceId: 'science_inertia_01',
        stepId: 'q_04',
        url: 'https://evil.example/image.svg',
      }),
    ).toThrow();
  });
});
