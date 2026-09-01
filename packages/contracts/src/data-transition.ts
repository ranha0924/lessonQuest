import { z } from 'zod';

import { contentHashSchema, uuidSchema } from './primitives.js';

export const WORDQUEST_IDENTITY_EXPORT_FORMAT = 'lessonquest.wordquest.identity-export';
export const IDENTITY_MAPPING_PLAN_FORMAT = 'lessonquest.identity-mapping-plan';
export const IDENTITY_READINESS_REPORT_FORMAT = 'lessonquest.identity-readiness-report';
export const IDENTITY_TRANSITION_VERSION = 1;
export const MAX_IDENTITY_TRANSITION_RECORDS = 100_000;

const safeCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const transitionIndexSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_IDENTITY_TRANSITION_RECORDS - 1);

export const externalIdentityKeySchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim(), 'Opaque identifiers cannot have edge whitespace')
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    'Opaque identifiers cannot contain control characters',
  );

export const wordQuestSourceRoleSchema = z.enum(['STUDENT', 'TEACHER', 'MASTER']);
export const wordQuestSourceStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

export const wordQuestIdentityAccountV1Schema = z.strictObject({
  externalAuthId: externalIdentityKeySchema,
  legacyOrganizationKey: externalIdentityKeySchema,
  sourceRole: wordQuestSourceRoleSchema,
  sourceStatus: wordQuestSourceStatusSchema,
});

export const wordQuestIdentityExportV1Schema = z.strictObject({
  format: z.literal(WORDQUEST_IDENTITY_EXPORT_FORMAT),
  version: z.literal(IDENTITY_TRANSITION_VERSION),
  exportId: uuidSchema,
  exportedAt: z.iso.datetime({ offset: true }),
  sourceSystem: z.literal('WORDQUEST_FIREBASE'),
  sourceCounts: z.strictObject({
    users: safeCountSchema,
    privateStateDocuments: safeCountSchema,
    summaryDocuments: safeCountSchema,
    learningRecords: safeCountSchema,
  }),
  accounts: z.array(wordQuestIdentityAccountV1Schema).max(MAX_IDENTITY_TRANSITION_RECORDS),
});

export const identityMappingPlanV1Schema = z.strictObject({
  format: z.literal(IDENTITY_MAPPING_PLAN_FORMAT),
  version: z.literal(IDENTITY_TRANSITION_VERSION),
  sourceExportChecksum: contentHashSchema,
  accountMappings: z
    .array(
      z.strictObject({
        externalAuthId: externalIdentityKeySchema,
        userId: uuidSchema,
      }),
    )
    .max(MAX_IDENTITY_TRANSITION_RECORDS),
  organizationMappings: z
    .array(
      z.strictObject({
        legacyOrganizationKey: externalIdentityKeySchema,
        organizationId: uuidSchema,
      }),
    )
    .max(MAX_IDENTITY_TRANSITION_RECORDS),
});

export const identityReadinessFindingCodeSchema = z.enum([
  'SOURCE_CHECKSUM_MISMATCH',
  'SOURCE_USER_COUNT_MISMATCH',
  'DUPLICATE_EXTERNAL_ACCOUNT',
  'CONFLICTING_SOURCE_ACCOUNT',
  'DUPLICATE_ACCOUNT_MAPPING',
  'CANONICAL_USER_COLLISION',
  'DUPLICATE_ORGANIZATION_MAPPING',
  'CANONICAL_ORGANIZATION_COLLISION',
  'UNMAPPED_EXTERNAL_ACCOUNT',
  'UNMAPPED_LEGACY_ORGANIZATION',
  'UNUSED_ACCOUNT_MAPPING',
  'UNUSED_ORGANIZATION_MAPPING',
  'PRIVILEGED_ROLE_REQUIRES_REVIEW',
]);

export const identityReadinessFindingV1Schema = z.strictObject({
  code: identityReadinessFindingCodeSchema,
  severity: z.literal('BLOCKER'),
  recordIndex: transitionIndexSchema.optional(),
  mappingIndex: transitionIndexSchema.optional(),
  relatedIndex: transitionIndexSchema.optional(),
  fingerprint: contentHashSchema.optional(),
  canonicalId: uuidSchema.optional(),
});

export const identityReadinessReportV1Schema = z
  .strictObject({
    format: z.literal(IDENTITY_READINESS_REPORT_FORMAT),
    version: z.literal(IDENTITY_TRANSITION_VERSION),
    sourceChecksum: contentHashSchema,
    mappingChecksum: contentHashSchema,
    counts: z.strictObject({
      sourceRecords: safeCountSchema,
      uniqueSourceAccounts: safeCountSchema,
      accountMappings: safeCountSchema,
      organizationMappings: safeCountSchema,
      mappedAccounts: safeCountSchema,
      readyAccounts: safeCountSchema,
    }),
    proposedRoles: z.strictObject({
      students: safeCountSchema,
      teachers: safeCountSchema,
    }),
    ready: z.boolean(),
    findings: z.array(identityReadinessFindingV1Schema).max(1_000_000),
  })
  .superRefine((report, context) => {
    if (report.ready !== (report.findings.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['ready'],
        message: 'Readiness must agree with blocker findings',
      });
    }
    if (
      report.counts.uniqueSourceAccounts > report.counts.sourceRecords ||
      report.counts.mappedAccounts > report.counts.uniqueSourceAccounts ||
      report.counts.readyAccounts > report.counts.mappedAccounts
    ) {
      context.addIssue({
        code: 'custom',
        path: ['counts'],
        message: 'Readiness counts must be monotonic',
      });
    }
    if (
      report.proposedRoles.students + report.proposedRoles.teachers >
      report.counts.readyAccounts
    ) {
      context.addIssue({
        code: 'custom',
        path: ['proposedRoles'],
        message: 'Proposed roles cannot exceed ready accounts',
      });
    }
  });

export type WordQuestSourceRole = z.infer<typeof wordQuestSourceRoleSchema>;
export type WordQuestSourceStatus = z.infer<typeof wordQuestSourceStatusSchema>;
export type WordQuestIdentityAccountV1 = z.infer<typeof wordQuestIdentityAccountV1Schema>;
export type WordQuestIdentityExportV1 = z.infer<typeof wordQuestIdentityExportV1Schema>;
export type IdentityMappingPlanV1 = z.infer<typeof identityMappingPlanV1Schema>;
export type IdentityReadinessFindingCode = z.infer<typeof identityReadinessFindingCodeSchema>;
export type IdentityReadinessFindingV1 = z.infer<typeof identityReadinessFindingV1Schema>;
export type IdentityReadinessReportV1 = z.infer<typeof identityReadinessReportV1Schema>;
