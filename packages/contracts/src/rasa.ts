import { z } from 'zod';

import { subjectSchema } from './manifest.js';
import { boundedIdentifierSchema, experienceIdSchema, uuidSchema } from './primitives.js';

export const hintLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const assignmentRasaPolicyInputSchema = z.strictObject({
  enabled: z.boolean(),
  maxHintLevel: hintLevelSchema,
});

export const rasaHintRequestSchema = z.strictObject({
  requestId: uuidSchema,
  attemptId: uuidSchema,
  stepId: boundedIdentifierSchema,
});

const uniqueHintLevelsSchema = z
  .array(hintLevelSchema)
  .max(3)
  .superRefine((levels, context) => {
    if (new Set(levels).size !== levels.length) {
      context.addIssue({ code: 'custom', message: 'Hint levels must be unique' });
    }
  });

const learningObjectivesSchema = z
  .array(z.string().trim().min(1).max(300))
  .min(1)
  .max(12)
  .superRefine((objectives, context) => {
    if (new Set(objectives).size !== objectives.length) {
      context.addIssue({ code: 'custom', message: 'Learning objectives must be unique' });
    }
  });

export const rasaContextSchema = z.strictObject({
  schemaVersion: z.literal(1),
  organizationId: uuidSchema,
  assignmentId: uuidSchema,
  sessionId: uuidSchema,
  student: z.strictObject({
    id: uuidSchema,
    gradeBand: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[a-z][a-z0-9_]*$/),
  }),
  learning: z.strictObject({
    subject: subjectSchema,
    unit: boundedIdentifierSchema,
    experienceId: experienceIdSchema,
    experienceVersion: z.int().positive().max(1_000_000),
    sceneId: boundedIdentifierSchema,
    stepId: boundedIdentifierSchema,
    questionSummary: z.string().trim().min(1).max(500),
    recentResponses: z
      .array(
        z.strictObject({
          correct: z.boolean(),
          misconceptionTag: boundedIdentifierSchema.optional(),
        }),
      )
      .max(20),
    usedHintLevels: uniqueHintLevelsSchema,
  }),
  teacherPolicy: z.strictObject({
    learningObjectives: learningObjectivesSchema,
    maxHintLevel: hintLevelSchema,
    forbidFinalAnswer: z.literal(true),
  }),
});

const targetShape = {
  experienceId: experienceIdSchema,
  stepId: boundedIdentifierSchema,
};

const mediaAction = (action: 'PLAY_AUDIO' | 'PLAY_VIDEO' | 'SHOW_IMAGE') =>
  z.strictObject({
    action: z.literal(action),
    ...targetShape,
    assetId: boundedIdentifierSchema,
  });

export const rasaActionSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('OPEN_EXPERIENCE'),
    experienceId: experienceIdSchema,
  }),
  z.strictObject({ action: z.literal('GO_TO_STEP'), ...targetShape }),
  z.strictObject({ action: z.literal('NEXT_STEP'), ...targetShape }),
  z.strictObject({ action: z.literal('PREVIOUS_STEP'), ...targetShape }),
  z.strictObject({
    action: z.literal('SHOW_HINT'),
    ...targetShape,
    level: hintLevelSchema,
    content: z.string().trim().min(1).max(500),
  }),
  z.strictObject({
    action: z.literal('EXPLAIN_SIMPLER'),
    ...targetShape,
    content: z.string().trim().min(1).max(1_000),
  }),
  z.strictObject({
    action: z.literal('READ_TEXT'),
    ...targetShape,
    text: z.string().trim().min(1).max(2_000),
  }),
  mediaAction('PLAY_AUDIO'),
  mediaAction('PLAY_VIDEO'),
  mediaAction('SHOW_IMAGE'),
  z.strictObject({
    action: z.literal('ASK_REFLECTION'),
    ...targetShape,
    prompt: z.string().trim().min(1).max(500),
  }),
  z.strictObject({
    action: z.literal('REQUEST_TEACHER_HELP'),
    ...targetShape,
    reason: z.string().trim().min(1).max(300),
  }),
]);

export const showHintActionSchema = z.strictObject({
  action: z.literal('SHOW_HINT'),
  ...targetShape,
  level: hintLevelSchema,
  content: z.string().trim().min(1).max(500),
});

export const rasaHintResultSchema = z.strictObject({
  requestId: uuidSchema,
  sessionId: uuidSchema,
  duplicate: z.boolean(),
  action: showHintActionSchema,
  nextSequence: z.int().min(0).max(1_000_000),
});

export type RasaContext = z.infer<typeof rasaContextSchema>;
export type RasaAction = z.infer<typeof rasaActionSchema>;
export type ShowHintAction = z.infer<typeof showHintActionSchema>;
export type AssignmentRasaPolicyInput = z.infer<typeof assignmentRasaPolicyInputSchema>;
export type RasaHintRequest = z.infer<typeof rasaHintRequestSchema>;
export type RasaHintResult = z.infer<typeof rasaHintResultSchema>;
