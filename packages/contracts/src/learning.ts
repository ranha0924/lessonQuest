import { z } from 'zod';

import { boundedIdentifierSchema, uuidSchema } from './primitives.js';

export const createScienceExperienceInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  generatedSpecText: z.string().min(1).max(32_768),
});

export const reviewExperienceVersionInputSchema = z.strictObject({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(1).max(1_000).optional(),
});

export const createAssignmentInputSchema = z
  .strictObject({
    experienceVersionId: uuidSchema,
    startsAt: z.iso.datetime({ offset: true }).optional(),
    dueAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine(({ startsAt, dueAt }, context) => {
    if (startsAt !== undefined && dueAt !== undefined && dueAt <= startsAt) {
      context.addIssue({ code: 'custom', message: 'Assignment dueAt must follow startsAt' });
    }
  });

export const studentProgressSchema = z.strictObject({
  assignmentId: uuidSchema,
  studentId: uuidSchema,
  started: z.boolean(),
  wrongAnswers: z.int().min(0),
  retries: z.int().min(0),
  completed: z.boolean(),
  lastSequence: z.int().min(0).nullable(),
  lastStepId: boundedIdentifierSchema.nullable(),
  projectionVersion: z.int().min(0),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const eventIngestionResultSchema = z
  .strictObject({
    accepted: z.boolean(),
    duplicate: z.boolean(),
  })
  .refine(({ accepted, duplicate }) => accepted !== duplicate, {
    message: 'Event result must be accepted or duplicate',
  });

export type CreateScienceExperienceInput = z.infer<typeof createScienceExperienceInputSchema>;
export type ReviewExperienceVersionInput = z.infer<typeof reviewExperienceVersionInputSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;
export type StudentProgress = z.infer<typeof studentProgressSchema>;
export type EventIngestionResult = z.infer<typeof eventIngestionResultSchema>;
