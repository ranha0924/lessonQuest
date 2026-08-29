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

export const scienceBlockSchema = z.discriminatedUnion('kind', [
  conceptCardSchema,
  predictionSchema,
  simulationSchema,
  quizSchema,
  reflectionSchema,
]);

const requiredBlockOrder = [
  'CONCEPT_CARD',
  'PREDICTION',
  'SIMULATION',
  'QUIZ',
  'REFLECTION',
] as const;

export const scienceBlockSpecSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    title: textSchema(120),
    gradeBand: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[a-z][a-z0-9_]*$/),
    unit: boundedIdentifierSchema,
    learningObjectives: withUniqueIds(objectiveSchema, 1),
    blocks: z.array(scienceBlockSchema).length(requiredBlockOrder.length),
  })
  .superRefine(({ blocks, learningObjectives }, context) => {
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
  });

export type ScienceBlock = z.infer<typeof scienceBlockSchema>;
export type ScienceBlockSpec = z.infer<typeof scienceBlockSpecSchema>;
