import { describe, expect, it } from 'vitest';
import {
  createLessonInputInputSchema,
  lessonInputListSchema,
  lessonInputMutationResultSchema,
  lessonInputSchema,
  lessonInputSummarySchema,
  updateLessonInputInputSchema,
} from '../src/lesson-inputs.js';

const mutationId = '018f72a4-cc52-7c5a-a6f9-8b21aa270101';
const validCreate = {
  mutationId,
  title: '  힘과 운동 수업  ',
  gradeBand: 'middle1',
  learningContent: '  같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.  ',
  learningObjectives: [' 힘과 질량의 관계를 설명한다. ', ' 실험 결과를 근거로 예측한다. '],
};

describe('F01 lesson input contracts', () => {
  it('normalizes a valid create input', () => {
    expect(createLessonInputInputSchema.parse(validCreate)).toEqual({
      mutationId,
      title: '힘과 운동 수업',
      gradeBand: 'middle1',
      learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
      learningObjectives: ['힘과 질량의 관계를 설명한다.', '실험 결과를 근거로 예측한다.'],
    });
  });

  it('enforces text, objective, grade, UUID, and revision constraints', () => {
    const invalidTexts = [
      { title: '' },
      { title: ' '.repeat(121) },
      { learningContent: '' },
      { learningContent: 'x'.repeat(32_769) },
      { learningObjectives: [] },
      { learningObjectives: Array.from({ length: 9 }, (_, index) => `목표 ${index}`) },
      { learningObjectives: [''] },
      { learningObjectives: ['x'.repeat(301)] },
      { learningObjectives: [' 같은 목표 ', '같은 목표'] },
    ];
    for (const invalid of invalidTexts)
      expect(createLessonInputInputSchema.safeParse({ ...validCreate, ...invalid }).success).toBe(
        false,
      );
    expect(createLessonInputInputSchema.safeParse({ ...validCreate, gradeBand: 'unknown' }).success).toBe(false);
    expect(createLessonInputInputSchema.safeParse({ ...validCreate, mutationId: 'not-a-uuid' }).success).toBe(false);
    for (const expectedRevision of [0, -1, 1.5, 1_000_001, '1', null])
      expect(
        updateLessonInputInputSchema.safeParse({ ...validCreate, expectedRevision }).success,
      ).toBe(false);
  });

  it('rejects forged identity, tenant, revision, timestamp, and extra keys', () => {
    for (const key of [
      'organizationId',
      'ownerTeacherId',
      'revision',
      'createdAt',
      'updatedAt',
      'extra',
    ])
      expect(createLessonInputInputSchema.safeParse({ ...validCreate, [key]: 'forged' }).success).toBe(false);
  });

  it('parses complete responses and rejects unknown response keys', () => {
    const lessonInput = {
      id: '018f72a4-cc52-7c5a-a6f9-8b21aa270102',
      organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270103',
      ownerTeacherId: '018f72a4-cc52-7c5a-a6f9-8b21aa270104',
      title: '힘과 운동 수업',
      gradeBand: 'middle1',
      learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
      learningObjectives: ['힘과 질량의 관계를 설명한다.', '실험 결과를 근거로 예측한다.'],
      revision: 1,
      createdAt: '2026-09-07T00:00:00+09:00',
      updatedAt: '2026-09-07T00:00:00+09:00',
    };
    const result = lessonInputMutationResultSchema.parse({ lessonInput, duplicate: false });
    expect(result.lessonInput).toEqual(lessonInput);
    expect(lessonInputSummarySchema.parse({
      id: lessonInput.id,
      title: lessonInput.title,
      gradeBand: lessonInput.gradeBand,
      revision: lessonInput.revision,
      updatedAt: lessonInput.updatedAt,
    })).toEqual({
      id: lessonInput.id,
      title: lessonInput.title,
      gradeBand: lessonInput.gradeBand,
      revision: lessonInput.revision,
      updatedAt: lessonInput.updatedAt,
    });
    expect(lessonInputListSchema.parse([{
      id: lessonInput.id,
      title: lessonInput.title,
      gradeBand: lessonInput.gradeBand,
      revision: lessonInput.revision,
      updatedAt: lessonInput.updatedAt,
    }])).toHaveLength(1);
    expect(lessonInputMutationResultSchema.safeParse({ lessonInput, duplicate: false, extra: true }).success).toBe(false);
    for (const key of ['organizationId', 'ownerTeacherId', 'revision', 'createdAt', 'updatedAt', 'extra'])
      expect(lessonInputSummarySchema.safeParse({ ...lessonInput, [key]: 'forged' }).success).toBe(false);
  });
});
