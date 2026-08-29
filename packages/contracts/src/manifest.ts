import { z } from 'zod';

import {
  contentHashSchema,
  experienceIdSchema,
  relativeEntrypointSchema,
  uuidSchema,
} from './primitives.js';

const uniqueArray = <T extends z.ZodType>(itemSchema: T, minimum: number, maximum: number) =>
  z
    .array(itemSchema)
    .min(minimum)
    .max(maximum)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) {
        context.addIssue({ code: 'custom', message: 'Items must be unique' });
      }
    });

export const subjectSchema = z.enum([
  'science',
  'social',
  'korean',
  'english',
  'history',
  'hanja',
  'other',
]);

export const experienceTypeSchema = z.enum([
  'simulation',
  'map_exploration',
  'clue_collection',
  'story_scene',
  'quiz',
  'rpg',
]);

export const capabilitySchema = z.enum(['quiz', 'rasa', 'class_boss']);

const gradeBandSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-z][a-z0-9_]*$/);

const learningObjectiveSchema = z.string().trim().min(1).max(300);

export const experienceManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: experienceIdSchema,
  version: z.int().positive().max(1_000_000),
  title: z.string().trim().min(1).max(120),
  subject: subjectSchema,
  gradeBands: uniqueArray(gradeBandSchema, 1, 8),
  type: experienceTypeSchema,
  entrypoint: relativeEntrypointSchema,
  organizationId: uuidSchema,
  authorId: uuidSchema,
  status: z.literal('approved'),
  learningObjectives: uniqueArray(learningObjectiveSchema, 1, 12),
  capabilities: uniqueArray(capabilitySchema, 0, 3),
  createdWithAI: z.boolean(),
  contentHash: contentHashSchema,
});

export type ExperienceManifest = z.infer<typeof experienceManifestSchema>;
