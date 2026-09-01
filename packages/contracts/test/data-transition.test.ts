import { describe, expect, it } from 'vitest';

import {
  identityMappingPlanV1Schema,
  identityReadinessReportV1Schema,
  wordQuestIdentityExportV1Schema,
} from '../src/data-transition.js';

const exportAccount = {
  externalAuthId: 'synthetic-firebase-user-01',
  legacyOrganizationKey: 'synthetic-school-01',
  sourceRole: 'STUDENT',
  sourceStatus: 'ACTIVE',
} as const;

const validExport = {
  format: 'lessonquest.wordquest.identity-export',
  version: 1,
  exportId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d001',
  exportedAt: '2026-09-01T12:34:56+09:00',
  sourceSystem: 'WORDQUEST_FIREBASE',
  sourceCounts: {
    users: 1,
    privateStateDocuments: 1,
    summaryDocuments: 1,
    learningRecords: 4,
  },
  accounts: [exportAccount],
} as const;

const validPlan = {
  format: 'lessonquest.identity-mapping-plan',
  version: 1,
  sourceExportChecksum: `sha256:${'a'.repeat(64)}`,
  accountMappings: [
    {
      externalAuthId: exportAccount.externalAuthId,
      userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d002',
    },
  ],
  organizationMappings: [
    {
      legacyOrganizationKey: exportAccount.legacyOrganizationKey,
      organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d003',
    },
  ],
} as const;

const validReport = {
  format: 'lessonquest.identity-readiness-report',
  version: 1,
  sourceChecksum: `sha256:${'a'.repeat(64)}`,
  mappingChecksum: `sha256:${'b'.repeat(64)}`,
  counts: {
    sourceRecords: 1,
    uniqueSourceAccounts: 1,
    accountMappings: 1,
    organizationMappings: 1,
    mappedAccounts: 1,
    readyAccounts: 1,
  },
  proposedRoles: { students: 1, teachers: 0 },
  ready: true,
  findings: [],
} as const;

const c1ControlCharacters = [
  ['U+0080', '\u0080'],
  ['U+0085', '\u0085'],
  ['U+009F', '\u009f'],
] as const;

describe('WordQuestIdentityExportV1', () => {
  it('accepts a bounded synthetic identity export and preserves opaque identifiers exactly', () => {
    expect(wordQuestIdentityExportV1Schema.parse(validExport)).toEqual(validExport);
  });

  it('requires an offset-aware RFC 3339 timestamp and safe source counts', () => {
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({
        ...validExport,
        exportedAt: '2026-09-01T12:34:56',
      }),
    ).toThrow();
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({
        ...validExport,
        sourceCounts: { ...validExport.sourceCounts, users: Number.MAX_SAFE_INTEGER + 1 },
      }),
    ).toThrow();
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({
        ...validExport,
        sourceCounts: { ...validExport.sourceCounts, learningRecords: -1 },
      }),
    ).toThrow();
  });

  it.each([
    ['leading whitespace', ` ${exportAccount.externalAuthId}`],
    ['trailing whitespace', `${exportAccount.externalAuthId} `],
    ['control characters', `${exportAccount.externalAuthId}\n`],
    ['DEL control character', `${exportAccount.externalAuthId}\u007f`],
    ['empty identifiers', ''],
    ['oversized identifiers', 'x'.repeat(129)],
  ])('rejects %s instead of normalizing opaque identifiers', (_label, externalAuthId) => {
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({
        ...validExport,
        accounts: [{ ...exportAccount, externalAuthId }],
      }),
    ).toThrow();
  });

  it.each(c1ControlCharacters)(
    'rejects C1 control character %s through every opaque identity-key path',
    (_label, controlCharacter) => {
      const externalAuthId = `synthetic${controlCharacter}external`;
      const legacyOrganizationKey = `synthetic${controlCharacter}organization`;

      expect(() =>
        wordQuestIdentityExportV1Schema.parse({
          ...validExport,
          accounts: [{ ...exportAccount, externalAuthId }],
        }),
      ).toThrow();
      expect(() =>
        wordQuestIdentityExportV1Schema.parse({
          ...validExport,
          accounts: [{ ...exportAccount, legacyOrganizationKey }],
        }),
      ).toThrow();
      expect(() =>
        identityMappingPlanV1Schema.parse({
          ...validPlan,
          accountMappings: [{ ...validPlan.accountMappings[0], externalAuthId }],
        }),
      ).toThrow();
      expect(() =>
        identityMappingPlanV1Schema.parse({
          ...validPlan,
          organizationMappings: [{ ...validPlan.organizationMappings[0], legacyOrganizationKey }],
        }),
      ).toThrow();
    },
  );

  it.each([
    ['U+007E', `synthetic~external`],
    ['U+00A0', `synthetic\u00a0external`],
  ])('preserves adjacent accepted boundary %s exactly', (_label, externalAuthId) => {
    const parsed = wordQuestIdentityExportV1Schema.parse({
      ...validExport,
      accounts: [{ ...exportAccount, externalAuthId }],
    });

    expect(parsed.accounts[0]?.externalAuthId).toBe(externalAuthId);
  });

  it.each(['displayName', 'email', 'token', 'organizationLabel', 'targetRole'])(
    'rejects injected %s account data',
    (field) => {
      expect(() =>
        wordQuestIdentityExportV1Schema.parse({
          ...validExport,
          accounts: [{ ...exportAccount, [field]: 'must-not-cross-transition-contract' }],
        }),
      ).toThrow();
    },
  );

  it('rejects unknown top-level fields and unsupported contract discriminators', () => {
    expect(() => wordQuestIdentityExportV1Schema.parse({ ...validExport, rawUsers: [] })).toThrow();
    expect(() => wordQuestIdentityExportV1Schema.parse({ ...validExport, version: 2 })).toThrow();
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({ ...validExport, sourceSystem: 'FIREBASE' }),
    ).toThrow();
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({
        ...validExport,
        accounts: [{ ...exportAccount, sourceRole: 'ORG_ADMIN' }],
      }),
    ).toThrow();
  });

  it('caps source account records at 100,000', () => {
    const tooMany = Array.from({ length: 100_001 }, () => exportAccount);
    expect(() =>
      wordQuestIdentityExportV1Schema.parse({ ...validExport, accounts: tooMany }),
    ).toThrow();
  });
});

describe('IdentityMappingPlanV1', () => {
  it('accepts explicit account and organization UUID mappings only', () => {
    expect(identityMappingPlanV1Schema.parse(validPlan)).toEqual(validPlan);
  });

  it.each(['email', 'displayName', 'sourceRole', 'targetRole', 'platformRole'])(
    'rejects injected %s mapping authority',
    (field) => {
      expect(() =>
        identityMappingPlanV1Schema.parse({
          ...validPlan,
          accountMappings: [{ ...validPlan.accountMappings[0], [field]: 'SUPER_ADMIN' }],
        }),
      ).toThrow();
    },
  );

  it('rejects malformed hashes, UUIDs, identifiers and more than 100,000 mappings', () => {
    expect(() =>
      identityMappingPlanV1Schema.parse({ ...validPlan, sourceExportChecksum: 'sha256:ABC' }),
    ).toThrow();
    expect(() =>
      identityMappingPlanV1Schema.parse({
        ...validPlan,
        accountMappings: [{ ...validPlan.accountMappings[0], userId: 'user-1' }],
      }),
    ).toThrow();
    expect(() =>
      identityMappingPlanV1Schema.parse({
        ...validPlan,
        organizationMappings: [
          { ...validPlan.organizationMappings[0], legacyOrganizationKey: ' school ' },
        ],
      }),
    ).toThrow();
    expect(() =>
      identityMappingPlanV1Schema.parse({
        ...validPlan,
        accountMappings: Array.from({ length: 100_001 }, () => validPlan.accountMappings[0]),
      }),
    ).toThrow();
  });
});

describe('IdentityReadinessReportV1', () => {
  it('accepts a strict ready report and bounded blocker metadata', () => {
    expect(identityReadinessReportV1Schema.parse(validReport)).toEqual(validReport);
    expect(
      identityReadinessReportV1Schema.parse({
        ...validReport,
        ready: false,
        findings: [
          {
            code: 'UNMAPPED_EXTERNAL_ACCOUNT',
            severity: 'BLOCKER',
            recordIndex: 0,
            fingerprint: `sha256:${'c'.repeat(64)}`,
            canonicalId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d002',
          },
        ],
      }).findings,
    ).toHaveLength(1);
  });

  it('rejects unknown finding codes, raw identity fields and malformed indexes', () => {
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        findings: [{ code: 'UNKNOWN', severity: 'BLOCKER' }],
      }),
    ).toThrow();
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        findings: [
          {
            code: 'UNMAPPED_EXTERNAL_ACCOUNT',
            severity: 'BLOCKER',
            externalAuthId: exportAccount.externalAuthId,
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        findings: [{ code: 'UNMAPPED_EXTERNAL_ACCOUNT', severity: 'BLOCKER', recordIndex: -1 }],
      }),
    ).toThrow();
  });

  it('rejects internally contradictory readiness flags and counts', () => {
    expect(() => identityReadinessReportV1Schema.parse({ ...validReport, ready: false })).toThrow();
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        ready: true,
        findings: [{ code: 'SOURCE_CHECKSUM_MISMATCH', severity: 'BLOCKER' }],
      }),
    ).toThrow();
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        counts: { ...validReport.counts, mappedAccounts: 2 },
      }),
    ).toThrow();
    expect(() =>
      identityReadinessReportV1Schema.parse({
        ...validReport,
        proposedRoles: { students: 2, teachers: 0 },
      }),
    ).toThrow();
  });
});
