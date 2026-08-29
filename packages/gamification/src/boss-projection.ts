import { uuidSchema } from '@lessonquest/contracts';
import { z } from 'zod';

import { bossCampaignClassId, bossCampaignKeySchema } from './boss-rules.js';

export const verifiedBossOutcomeKindSchema = z.enum([
  'ANSWER_CORRECT',
  'ANSWER_RETRIED',
  'EXPERIENCE_COMPLETED',
]);

export const verifiedBossOutcomeSchema = z.strictObject({
  organizationId: uuidSchema,
  classId: uuidSchema,
  studentId: uuidSchema,
  sourceEventId: uuidSchema,
  kind: verifiedBossOutcomeKindSchema,
  serverAccepted: z.literal(true),
  firstForRule: z.boolean(),
  capped: z.boolean(),
});

export const bossContributionPolicySchema = z.strictObject({
  enabled: z.boolean(),
  amounts: z.strictObject({
    ANSWER_CORRECT: z.int().min(0).max(10_000),
    ANSWER_RETRIED: z.int().min(0).max(10_000),
    EXPERIENCE_COMPLETED: z.int().min(0).max(10_000),
  }),
});

export const bossProjectionInputSchema = z
  .strictObject({
    organizationId: uuidSchema,
    classId: uuidSchema,
    campaignKey: bossCampaignKeySchema,
    policy: bossContributionPolicySchema,
    existingSourceEventIds: z.array(uuidSchema).max(10_000),
    outcomes: z.array(verifiedBossOutcomeSchema).max(10_000),
  })
  .superRefine((input, context) => {
    if (bossCampaignClassId(input.campaignKey) !== input.classId) {
      context.addIssue({
        code: 'custom',
        path: ['campaignKey'],
        message: 'Boss campaign key must belong to the projected class.',
      });
    }
  });

export type VerifiedBossOutcomeKind = z.infer<typeof verifiedBossOutcomeKindSchema>;
export type VerifiedBossOutcome = z.infer<typeof verifiedBossOutcomeSchema>;
export type BossContributionPolicy = z.infer<typeof bossContributionPolicySchema>;
export type BossProjectionInput = z.infer<typeof bossProjectionInputSchema>;

export interface ProjectedBossContribution {
  organizationId: string;
  classId: string;
  campaignKey: string;
  studentId: string;
  sourceEventId: string;
  amount: number;
  reason: 'answer_correct' | 'answer_retried' | 'experience_completed';
}

const reasonByKind = {
  ANSWER_CORRECT: 'answer_correct',
  ANSWER_RETRIED: 'answer_retried',
  EXPERIENCE_COMPLETED: 'experience_completed',
} as const satisfies Record<VerifiedBossOutcomeKind, ProjectedBossContribution['reason']>;

export function projectBossContributions(input: BossProjectionInput): ProjectedBossContribution[] {
  const parsed = bossProjectionInputSchema.parse(input);
  if (!parsed.policy.enabled) return [];

  const seenSourceEventIds = new Set(parsed.existingSourceEventIds);
  const contributions: ProjectedBossContribution[] = [];

  for (const outcome of parsed.outcomes) {
    if (
      outcome.organizationId !== parsed.organizationId ||
      outcome.classId !== parsed.classId ||
      seenSourceEventIds.has(outcome.sourceEventId)
    ) {
      continue;
    }

    seenSourceEventIds.add(outcome.sourceEventId);
    if (!outcome.firstForRule || outcome.capped) continue;

    const amount = parsed.policy.amounts[outcome.kind];
    if (amount === 0) continue;

    contributions.push({
      organizationId: parsed.organizationId,
      classId: parsed.classId,
      campaignKey: parsed.campaignKey,
      studentId: outcome.studentId,
      sourceEventId: outcome.sourceEventId,
      amount,
      reason: reasonByKind[outcome.kind],
    });
  }

  return contributions;
}
