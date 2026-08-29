import { describe, expect, it } from 'vitest';

import {
  scienceBlockSpecSchema,
  studentScienceBlockSpecSchema,
  supportedGradeBandSchema,
} from '../src/science.js';

const validScienceSpec = {
  schemaVersion: 1,
  title: '가벼운 손수레가 더 빨리 움직이는 이유',
  gradeBand: 'middle1',
  unit: 'force_and_motion',
  learningObjectives: [
    {
      id: 'objective_force',
      text: '힘, 질량, 가속도의 관계를 설명한다.',
    },
  ],
  blocks: [
    {
      id: 'concept_force',
      kind: 'CONCEPT_CARD',
      title: '힘은 움직임을 바꿔요',
      body: '같은 힘이라면 가벼운 물체의 움직임이 더 크게 바뀌어요.',
      objectiveIds: ['objective_force'],
    },
    {
      id: 'predict_force',
      kind: 'PREDICTION',
      prompt: '같은 힘으로 밀 때 어느 손수레가 더 멀리 갈까요?',
      choices: [
        { id: 'light', label: '가벼운 손수레' },
        { id: 'heavy', label: '무거운 손수레' },
      ],
      objectiveIds: ['objective_force'],
    },
    {
      id: 'simulate_force',
      kind: 'SIMULATION',
      model: 'FORCE_MOTION',
      prompt: '질량과 힘을 바꿔 이동 거리를 비교해 보세요.',
      parameters: { massKg: 2, forceN: 6, durationSec: 3 },
      objectiveIds: ['objective_force'],
    },
    {
      id: 'quiz_force',
      kind: 'QUIZ',
      question: '같은 힘을 받을 때 가속도가 더 큰 물체는?',
      options: [
        { id: 'light', label: '질량 2 kg', correct: true },
        { id: 'heavy', label: '질량 6 kg', correct: false },
      ],
      explanation: '가속도는 힘에 비례하고 질량에 반비례해요.',
      objectiveIds: ['objective_force'],
    },
    {
      id: 'reflect_force',
      kind: 'REFLECTION',
      prompt: '생활 속에서 같은 힘으로 밀었을 때 다르게 움직인 예를 적어 보세요.',
      objectiveIds: ['objective_force'],
    },
  ],
} as const;

describe('scienceBlockSpecSchema', () => {
  it('accepts the bounded five-block Phase 1 science specification', () => {
    expect(scienceBlockSpecSchema.parse(validScienceSpec)).toEqual(validScienceSpec);
    expect(supportedGradeBandSchema.parse('middle1')).toBe('middle1');
    expect(supportedGradeBandSchema.safeParse('college').success).toBe(false);
  });

  it('validates a student-safe specification without accepting an answer key', () => {
    const quiz = validScienceSpec.blocks[3];
    const safe = {
      ...validScienceSpec,
      blocks: [
        ...validScienceSpec.blocks.slice(0, 3),
        {
          id: quiz.id,
          kind: quiz.kind,
          question: quiz.question,
          options: quiz.options.map(({ id, label }) => ({ id, label })),
          objectiveIds: quiz.objectiveIds,
        },
        validScienceSpec.blocks[4],
      ],
    };

    expect(studentScienceBlockSpecSchema.parse(safe)).toEqual(safe);
    expect(studentScienceBlockSpecSchema.safeParse(validScienceSpec).success).toBe(false);
  });

  it('rejects missing, duplicate, and out-of-order required blocks', () => {
    const missing = { ...validScienceSpec, blocks: validScienceSpec.blocks.slice(0, 4) };
    const duplicate = {
      ...validScienceSpec,
      blocks: [
        validScienceSpec.blocks[0],
        validScienceSpec.blocks[0],
        ...validScienceSpec.blocks.slice(2),
      ],
    };
    const outOfOrder = {
      ...validScienceSpec,
      blocks: [
        validScienceSpec.blocks[1],
        validScienceSpec.blocks[0],
        ...validScienceSpec.blocks.slice(2),
      ],
    };

    expect(scienceBlockSpecSchema.safeParse(missing).success).toBe(false);
    expect(scienceBlockSpecSchema.safeParse(duplicate).success).toBe(false);
    expect(scienceBlockSpecSchema.safeParse(outOfOrder).success).toBe(false);
  });

  it('rejects code, URL, unknown simulation models, and out-of-range parameters', () => {
    const simulation = validScienceSpec.blocks[2];
    const unsafeInputs = [
      { ...simulation, script: 'fetch("https://attacker.example")' },
      { ...simulation, assetUrl: 'https://attacker.example/payload.js' },
      { ...simulation, model: 'CUSTOM_JAVASCRIPT' },
      { ...simulation, parameters: { ...simulation.parameters, forceN: 100_000 } },
    ];

    for (const unsafe of unsafeInputs) {
      const candidate = {
        ...validScienceSpec,
        blocks: [
          validScienceSpec.blocks[0],
          validScienceSpec.blocks[1],
          unsafe,
          validScienceSpec.blocks[3],
          validScienceSpec.blocks[4],
        ],
      };
      expect(scienceBlockSpecSchema.safeParse(candidate).success).toBe(false);
    }
  });

  it('requires exactly one correct quiz option and valid objective references', () => {
    const quiz = validScienceSpec.blocks[3];
    const noCorrect = {
      ...quiz,
      options: quiz.options.map((option) => ({ ...option, correct: false })),
    };
    const twoCorrect = {
      ...quiz,
      options: quiz.options.map((option) => ({ ...option, correct: true })),
    };
    const unknownObjective = {
      ...validScienceSpec.blocks[0],
      objectiveIds: ['objective_attacker'],
    };

    for (const replacement of [noCorrect, twoCorrect]) {
      expect(
        scienceBlockSpecSchema.safeParse({
          ...validScienceSpec,
          blocks: [...validScienceSpec.blocks.slice(0, 3), replacement, validScienceSpec.blocks[4]],
        }).success,
      ).toBe(false);
    }
    expect(
      scienceBlockSpecSchema.safeParse({
        ...validScienceSpec,
        blocks: [unknownObjective, ...validScienceSpec.blocks.slice(1)],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate identifiers and oversized generated text', () => {
    const duplicateBlockId = {
      ...validScienceSpec,
      blocks: [
        validScienceSpec.blocks[0],
        { ...validScienceSpec.blocks[1], id: validScienceSpec.blocks[0].id },
        ...validScienceSpec.blocks.slice(2),
      ],
    };
    const oversized = {
      ...validScienceSpec,
      blocks: [
        { ...validScienceSpec.blocks[0], body: '가'.repeat(2_001) },
        ...validScienceSpec.blocks.slice(1),
      ],
    };

    expect(scienceBlockSpecSchema.safeParse(duplicateBlockId).success).toBe(false);
    expect(scienceBlockSpecSchema.safeParse(oversized).success).toBe(false);
  });
});

export { validScienceSpec };
