import { z } from 'zod';

import { boundedIdentifierSchema, experienceIdSchema, uuidSchema } from './primitives.js';

const elapsedMsSchema = z.int().min(0).max(86_400_000);

const eventBaseShape = {
  schemaVersion: z.literal(1),
  eventId: uuidSchema,
  organizationId: uuidSchema,
  assignmentId: uuidSchema,
  attemptId: uuidSchema,
  experienceId: experienceIdSchema,
  experienceVersion: z.int().positive().max(1_000_000),
  stepId: boundedIdentifierSchema,
  sequence: z.int().min(0).max(1_000_000),
  occurredAt: z.iso.datetime({ offset: true }),
};

const defineEvent = <Type extends string, Payload extends z.ZodType>(
  type: Type,
  payload: Payload,
) =>
  z.strictObject({
    ...eventBaseShape,
    type: z.literal(type),
    payload,
  });

const emptyPayloadSchema = z.strictObject({});
const passiveElapsedPayloadSchema = z.strictObject({ elapsedMs: elapsedMsSchema.optional() });
const answerSubmissionPayloadSchema = z.strictObject({
  optionId: boundedIdentifierSchema,
  attempt: z.int().min(1).max(100),
  elapsedMs: elapsedMsSchema,
});

const authoritativeAnswerPayloadSchema = z.strictObject({
  ...answerSubmissionPayloadSchema.shape,
  correct: z.boolean(),
});

const experienceStartedEventSchema = defineEvent('EXPERIENCE_STARTED', emptyPayloadSchema);
const stepViewedEventSchema = defineEvent('STEP_VIEWED', passiveElapsedPayloadSchema);
const clientQuestionAnsweredEventSchema = defineEvent(
  'QUESTION_ANSWERED',
  answerSubmissionPayloadSchema,
);
const clientAnswerRetriedEventSchema = defineEvent('ANSWER_RETRIED', answerSubmissionPayloadSchema);
const serverQuestionAnsweredEventSchema = defineEvent(
  'QUESTION_ANSWERED',
  authoritativeAnswerPayloadSchema,
);
const serverAnswerRetriedEventSchema = defineEvent(
  'ANSWER_RETRIED',
  authoritativeAnswerPayloadSchema,
);
const hintUsedEventSchema = defineEvent(
  'HINT_USED',
  z.strictObject({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
);
const rasaOpenedEventSchema = defineEvent('RASA_OPENED', emptyPayloadSchema);
const choiceMadeEventSchema = defineEvent(
  'CHOICE_MADE',
  z.strictObject({ choiceId: boundedIdentifierSchema }),
);
const experienceCompletedEventSchema = defineEvent(
  'EXPERIENCE_COMPLETED',
  z.strictObject({ elapsedMs: elapsedMsSchema }),
);
const experienceExitedEventSchema = defineEvent(
  'EXPERIENCE_EXITED',
  z.strictObject({
    elapsedMs: elapsedMsSchema,
    reason: z.enum(['user', 'navigation', 'timeout', 'error']),
  }),
);
const errorReportedEventSchema = defineEvent(
  'ERROR_REPORTED',
  z.strictObject({
    code: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    recoverable: z.boolean(),
  }),
);
const bossDamageEarnedEventSchema = defineEvent(
  'BOSS_DAMAGE_EARNED',
  z.strictObject({
    amount: z.int().min(1).max(10_000),
    reason: z.enum([
      'answer_correct',
      'answer_retried',
      'experience_completed',
      'improvement',
      'participation',
    ]),
  }),
);

const clientEventVariants = [
  experienceStartedEventSchema,
  stepViewedEventSchema,
  clientQuestionAnsweredEventSchema,
  clientAnswerRetriedEventSchema,
  hintUsedEventSchema,
  rasaOpenedEventSchema,
  choiceMadeEventSchema,
  experienceCompletedEventSchema,
  experienceExitedEventSchema,
  errorReportedEventSchema,
] as const;

export const clientLearningEventSchema = z.discriminatedUnion('type', clientEventVariants);

export const serverLearningEventSchema = z.discriminatedUnion('type', [
  experienceStartedEventSchema,
  stepViewedEventSchema,
  serverQuestionAnsweredEventSchema,
  serverAnswerRetriedEventSchema,
  hintUsedEventSchema,
  rasaOpenedEventSchema,
  choiceMadeEventSchema,
  experienceCompletedEventSchema,
  experienceExitedEventSchema,
  errorReportedEventSchema,
  bossDamageEarnedEventSchema,
]);

export type ClientLearningEvent = z.infer<typeof clientLearningEventSchema>;
export type ServerLearningEvent = z.infer<typeof serverLearningEventSchema>;
