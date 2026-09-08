import { z } from 'zod';

import { uuidSchema } from './primitives.js';
import { supportedGradeBandSchema } from './science.js';

export const LESSON_INPUT_UNSUPPORTED_TEXT_MESSAGE =
  'Lesson input text must exclude NUL and unpaired surrogates';

const unpairedSurrogatePattern = /[\uD800-\uDFFF]/u;

function persistableTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .refine((value) => !value.includes('\u0000') && !unpairedSurrogatePattern.test(value), {
      message: LESSON_INPUT_UNSUPPORTED_TEXT_MESSAGE,
    });
}

const lessonTitleSchema = persistableTextSchema(120);
const lessonContentSchema = persistableTextSchema(32_768);
const learningObjectiveSchema = persistableTextSchema(300);

export const lessonInputFieldsSchema = z.strictObject({
  title: lessonTitleSchema,
  gradeBand: supportedGradeBandSchema,
  learningContent: lessonContentSchema,
  learningObjectives: z
    .array(learningObjectiveSchema)
    .min(1)
    .max(8)
    .refine((items) => new Set(items).size === items.length, 'Learning objectives must be unique'),
});

export const createLessonInputInputSchema = z.strictObject({
  mutationId: uuidSchema,
  ...lessonInputFieldsSchema.shape,
});

export const updateLessonInputInputSchema = z.strictObject({
  mutationId: uuidSchema,
  expectedRevision: z.int().positive().max(1_000_000),
  ...lessonInputFieldsSchema.shape,
});

export const lessonInputSchema = z.strictObject({
  id: uuidSchema,
  organizationId: uuidSchema,
  ownerTeacherId: uuidSchema,
  ...lessonInputFieldsSchema.shape,
  revision: z.int().positive().max(1_000_000),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const lessonInputSummarySchema = lessonInputSchema.pick({
  id: true,
  title: true,
  gradeBand: true,
  revision: true,
  updatedAt: true,
});

export const lessonInputListSchema = z.array(lessonInputSummarySchema).max(1_000);

export const lessonInputMutationResultSchema = z.strictObject({
  lessonInput: lessonInputSchema,
  duplicate: z.boolean(),
});

export type CreateLessonInputInput = z.infer<typeof createLessonInputInputSchema>;
export type UpdateLessonInputInput = z.infer<typeof updateLessonInputInputSchema>;
export type LessonInput = z.infer<typeof lessonInputSchema>;
export type LessonInputSummary = z.infer<typeof lessonInputSummarySchema>;
export type LessonInputMutationResult = z.infer<typeof lessonInputMutationResultSchema>;
