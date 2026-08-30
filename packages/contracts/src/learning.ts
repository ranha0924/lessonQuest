import { z } from 'zod';

import {
  scienceBlockSpecSchema,
  scienceValidationReportSchema,
  studentScienceBlockSpecSchema,
} from './science.js';
import {
  boundedIdentifierSchema,
  contentHashSchema,
  experienceIdSchema,
  uuidSchema,
} from './primitives.js';
import { assignmentRasaPolicyInputSchema, hintLevelSchema } from './rasa.js';

export const experienceVersionStatusSchema = z.enum([
  'GENERATED',
  'VALIDATED',
  'REJECTED',
  'APPROVED',
  'PUBLISHED',
  'RETIRED',
]);

export const attemptStatusSchema = z.enum(['READY', 'IN_PROGRESS', 'COMPLETED']);

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
    rasaPolicy: assignmentRasaPolicyInputSchema.optional(),
  })
  .superRefine(({ startsAt, dueAt }, context) => {
    if (
      startsAt !== undefined &&
      dueAt !== undefined &&
      new Date(dueAt).getTime() <= new Date(startsAt).getTime()
    ) {
      context.addIssue({ code: 'custom', message: 'Assignment dueAt must follow startsAt' });
    }
  });

export const createdScienceExperienceSchema = z.strictObject({
  experienceId: uuidSchema,
  publicId: experienceIdSchema,
  versionId: uuidSchema,
  version: z.literal(1),
  status: z.literal('GENERATED'),
  contentHash: contentHashSchema,
});

export const experienceValidationResultSchema = z.strictObject({
  versionId: uuidSchema,
  status: z.enum(['VALIDATED', 'REJECTED']),
  report: scienceValidationReportSchema,
});

export const experienceReviewResultSchema = z.strictObject({
  versionId: uuidSchema,
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const experiencePreviewSchema = z.strictObject({
  versionId: uuidSchema,
  status: experienceVersionStatusSchema,
  contentHash: contentHashSchema,
  specification: scienceBlockSpecSchema,
  sandboxDocument: z.string().min(1).max(262_144),
  validationReport: scienceValidationReportSchema.nullable(),
});

export const assignmentSchema = z.strictObject({
  id: uuidSchema,
  organizationId: uuidSchema,
  classId: uuidSchema,
  experienceVersionId: uuidSchema,
  startsAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  status: z.literal('ACTIVE'),
});

export const studentAssignmentSummarySchema = z.strictObject({
  ...assignmentSchema.shape,
  title: z.string().trim().min(1).max(120),
  attemptStatus: attemptStatusSchema.nullable(),
});

export const studentAssignmentListSchema = z.array(studentAssignmentSummarySchema).max(1_000);

export const attemptAnswerStateSchema = z.strictObject({
  stepId: boundedIdentifierSchema,
  attempts: z.int().min(1).max(100),
  correct: z.boolean(),
});

export const attemptSessionSchema = z.strictObject({
  id: uuidSchema,
  assignmentId: uuidSchema,
  status: attemptStatusSchema,
  resumed: z.boolean(),
  nextSequence: z.int().min(0).max(1_000_000),
  answers: z.array(attemptAnswerStateSchema).max(12),
  rasa: z.strictObject({
    enabled: z.boolean(),
    maxHintLevel: hintLevelSchema,
    hints: z
      .array(
        z.strictObject({
          stepId: boundedIdentifierSchema,
          level: hintLevelSchema,
          content: z.string().trim().min(1).max(500),
        }),
      )
      .max(36),
  }),
});

export const playerSessionSchema = z.strictObject({
  assignmentId: uuidSchema,
  attemptId: uuidSchema,
  experienceId: experienceIdSchema,
  experienceVersion: z.int().positive().max(1_000_000),
  contentHash: contentHashSchema,
  specification: studentScienceBlockSpecSchema,
  sandboxDocument: z.string().min(1).max(262_144),
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
  hintsUsed: z.int().min(0),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const eventIngestionResultSchema = z
  .strictObject({
    accepted: z.boolean(),
    duplicate: z.boolean(),
    answer: z
      .strictObject({
        stepId: boundedIdentifierSchema,
        attempt: z.int().min(1).max(100),
        correct: z.boolean(),
      })
      .nullable(),
    nextSequence: z.int().min(0).max(1_000_000),
  })
  .refine(({ accepted, duplicate }) => accepted !== duplicate, {
    message: 'Event result must be accepted or duplicate',
  });

export const studentProgressListSchema = z.array(studentProgressSchema).max(10_000);

const bossAmountsSchema = z.strictObject({
  ANSWER_CORRECT: z.int().min(0).max(10_000),
  ANSWER_RETRIED: z.int().min(0).max(10_000),
  EXPERIENCE_COMPLETED: z.int().min(0).max(10_000),
});

export const bossCampaignPolicySchema = z.strictObject({ amounts: bossAmountsSchema });

const weeklyPeriodSchema = z
  .strictObject({ kind: z.literal('WEEKLY'), weekStart: z.iso.date() })
  .superRefine(({ weekStart }, context) => {
    if (new Date(`${weekStart}T00:00:00.000Z`).getUTCDay() !== 1) {
      context.addIssue({ code: 'custom', message: 'Weekly campaign must start on Monday' });
    }
  });

export const createBossCampaignInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  period: z.discriminatedUnion('kind', [
    weeklyPeriodSchema,
    z.strictObject({ kind: z.literal('SPECIAL'), version: z.int().positive().max(1_000_000) }),
  ]),
  targetHp: z.int().min(60).max(60_000),
  policy: bossCampaignPolicySchema,
});

export const endBossCampaignInputSchema = z.strictObject({ requestId: uuidSchema });

const bossProgressShape = {
  campaignId: uuidSchema,
  title: z.string().trim().min(1).max(120),
  targetHp: z.int().min(60).max(60_000),
  damage: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  completed: z.boolean(),
};

export const studentBossProgressSchema = z.strictObject(bossProgressShape).nullable();

export const teacherBossDetailSchema = z.strictObject({
  campaign: z.strictObject({ ...bossProgressShape, policy: bossCampaignPolicySchema }),
  contributions: z
    .array(
      z.strictObject({
        studentId: uuidSchema,
        damage: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
        reasons: z
          .array(z.enum(['answer_correct', 'answer_retried', 'experience_completed']))
          .max(3),
      }),
    )
    .max(10_000),
  projectionHealth: z.strictObject({
    pending: z.int().min(0).max(1_000_000),
    failed: z.int().min(0).max(1_000_000),
  }),
});

export type CreateScienceExperienceInput = z.infer<typeof createScienceExperienceInputSchema>;
export type ReviewExperienceVersionInput = z.infer<typeof reviewExperienceVersionInputSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentInputSchema>;
export type StudentProgress = z.infer<typeof studentProgressSchema>;
export type EventIngestionResult = z.infer<typeof eventIngestionResultSchema>;
export type CreatedScienceExperience = z.infer<typeof createdScienceExperienceSchema>;
export type ExperienceValidationResult = z.infer<typeof experienceValidationResultSchema>;
export type ExperienceReviewResult = z.infer<typeof experienceReviewResultSchema>;
export type ExperiencePreview = z.infer<typeof experiencePreviewSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type StudentAssignmentSummary = z.infer<typeof studentAssignmentSummarySchema>;
export type AttemptAnswerState = z.infer<typeof attemptAnswerStateSchema>;
export type AttemptSession = z.infer<typeof attemptSessionSchema>;
export type PlayerSession = z.infer<typeof playerSessionSchema>;
export type CreateBossCampaignInput = z.infer<typeof createBossCampaignInputSchema>;
export type EndBossCampaignInput = z.infer<typeof endBossCampaignInputSchema>;
export type StudentBossProgress = z.infer<typeof studentBossProgressSchema>;
export type TeacherBossDetail = z.infer<typeof teacherBossDetailSchema>;
