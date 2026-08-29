import { z } from 'zod';

import { boundedIdentifierSchema } from './primitives.js';

const objectiveIdSchema = boundedIdentifierSchema;
const objectiveIdsSchema = z.array(objectiveIdSchema).min(1).max(8);
const textSchema = (maximum: number) => z.string().trim().min(1).max(maximum);

const withUniqueIds = <T extends z.ZodType<{ id: string }>>(schema: T, minimum: number) =>
  z
    .array(schema)
    .min(minimum)
    .max(12)
    .superRefine((items, context) => {
      const identifiers = items.map(({ id }) => id);
      if (new Set(identifiers).size !== identifiers.length) {
        context.addIssue({ code: 'custom', message: 'Identifiers must be unique' });
      }
    });

const objectiveSchema = z.strictObject({
  id: objectiveIdSchema,
  text: textSchema(300),
});

const blockBaseShape = {
  id: boundedIdentifierSchema,
  objectiveIds: objectiveIdsSchema,
};

const conceptCardSchema = z.strictObject({
  ...blockBaseShape,
  kind: z.literal('CONCEPT_CARD'),
  title: textSchema(120),
  body: textSchema(2_000),
});

const predictionChoiceSchema = z.strictObject({
  id: boundedIdentifierSchema,
  label: textSchema(240),
});

const predictionSchema = z.strictObject({
  ...blockBaseShape,
  kind: z.literal('PREDICTION'),
  prompt: textSchema(600),
  choices: withUniqueIds(predictionChoiceSchema, 2).max(6),
});

const simulationSchema = z.strictObject({
  ...blockBaseShape,
  kind: z.literal('SIMULATION'),
  model: z.literal('FORCE_MOTION'),
  prompt: textSchema(600),
  parameters: z.strictObject({
    massKg: z.number().min(0.1).max(1_000),
    forceN: z.number().min(-1_000).max(1_000),
    durationSec: z.number().positive().max(60),
  }),
});

const quizOptionSchema = z.strictObject({
  id: boundedIdentifierSchema,
  label: textSchema(240),
  correct: z.boolean(),
});

const studentQuizOptionSchema = z.strictObject({
  id: boundedIdentifierSchema,
  label: textSchema(240),
});

const quizSchema = z
  .strictObject({
    ...blockBaseShape,
    kind: z.literal('QUIZ'),
    question: textSchema(600),
    options: withUniqueIds(quizOptionSchema, 2).max(6),
    explanation: textSchema(1_000),
  })
  .superRefine(({ options }, context) => {
    if (options.filter(({ correct }) => correct).length !== 1) {
      context.addIssue({ code: 'custom', message: 'Quiz must have exactly one correct option' });
    }
  });

const reflectionSchema = z.strictObject({
  ...blockBaseShape,
  kind: z.literal('REFLECTION'),
  prompt: textSchema(600),
});

const studentQuizSchema = z.strictObject({
  ...blockBaseShape,
  kind: z.literal('QUIZ'),
  question: textSchema(600),
  options: withUniqueIds(studentQuizOptionSchema, 2).max(6),
});

export const scienceBlockSchema = z.discriminatedUnion('kind', [
  conceptCardSchema,
  predictionSchema,
  simulationSchema,
  quizSchema,
  reflectionSchema,
]);

export const studentScienceBlockSchema = z.discriminatedUnion('kind', [
  conceptCardSchema,
  predictionSchema,
  simulationSchema,
  studentQuizSchema,
  reflectionSchema,
]);

const requiredBlockOrder = [
  'CONCEPT_CARD',
  'PREDICTION',
  'SIMULATION',
  'QUIZ',
  'REFLECTION',
] as const;

export const supportedGradeBandSchema = z.enum([
  'elementary1',
  'elementary2',
  'elementary3',
  'elementary4',
  'elementary5',
  'elementary6',
  'middle1',
  'middle2',
  'middle3',
  'high1',
  'high2',
  'high3',
]);

function validateSpecReferences(
  blocks: readonly { id: string; kind: string; objectiveIds: readonly string[] }[],
  learningObjectives: readonly { id: string }[],
  context: z.RefinementCtx,
): void {
  const blockIds = blocks.map(({ id }) => id);
  if (new Set(blockIds).size !== blockIds.length) {
    context.addIssue({ code: 'custom', message: 'Block identifiers must be unique' });
  }

  for (const [index, requiredKind] of requiredBlockOrder.entries()) {
    if (blocks[index]?.kind !== requiredKind) {
      context.addIssue({ code: 'custom', message: 'Required blocks are out of order' });
      break;
    }
  }

  const objectiveIds = new Set(learningObjectives.map(({ id }) => id));
  if (
    blocks.some(({ objectiveIds: references }) =>
      references.some((reference) => !objectiveIds.has(reference)),
    )
  ) {
    context.addIssue({ code: 'custom', message: 'Block references an unknown objective' });
  }
}

export const scienceBlockSpecSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    title: textSchema(120),
    gradeBand: supportedGradeBandSchema,
    unit: boundedIdentifierSchema,
    learningObjectives: withUniqueIds(objectiveSchema, 1),
    blocks: z.array(scienceBlockSchema).length(requiredBlockOrder.length),
  })
  .superRefine(({ blocks, learningObjectives }, context) => {
    validateSpecReferences(blocks, learningObjectives, context);
  });

export const studentScienceBlockSpecSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    title: textSchema(120),
    gradeBand: supportedGradeBandSchema,
    unit: boundedIdentifierSchema,
    learningObjectives: withUniqueIds(objectiveSchema, 1),
    blocks: z.array(studentScienceBlockSchema).length(requiredBlockOrder.length),
  })
  .superRefine(({ blocks, learningObjectives }, context) => {
    validateSpecReferences(blocks, learningObjectives, context);
  });

export const scienceValidationFindingSchema = z.strictObject({
  code: z.enum(['OBJECTIVE_NOT_COVERED', 'SIMULATION_NO_OBSERVABLE_CHANGE']),
  severity: z.literal('ERROR'),
  blockId: boundedIdentifierSchema.nullable(),
});

export const scienceValidationReportSchema = z.strictObject({
  policyVersion: z.literal('science-validator-1'),
  verdict: z.enum(['PASS', 'FAIL']),
  findings: z.array(scienceValidationFindingSchema).max(64),
});

export type ScienceBlock = z.infer<typeof scienceBlockSchema>;
export type ScienceBlockSpec = z.infer<typeof scienceBlockSpecSchema>;
export type StudentScienceBlockSpec = z.infer<typeof studentScienceBlockSpecSchema>;
export type SupportedGradeBand = z.infer<typeof supportedGradeBandSchema>;
export type ScienceValidationReportContract = z.infer<typeof scienceValidationReportSchema>;
