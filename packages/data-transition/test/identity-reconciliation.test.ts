import { readFileSync } from 'node:fs';

import {
  identityMappingPlanV1Schema,
  wordQuestIdentityExportV1Schema,
  type IdentityMappingPlanV1,
  type IdentityReadinessFindingCode,
  type WordQuestIdentityExportV1,
} from '@lessonquest/contracts/data-transition';
import { describe, expect, it } from 'vitest';

import {
  DataTransitionValidationError,
  canonicalizeIdentityMappingPlan,
  canonicalizeWordQuestIdentityExport,
  reconcileIdentityExport,
} from '../src/index.js';

const fixtureUrl = new URL('./fixtures/wordquest-identity-export-v1.json', import.meta.url);
const baseExport = wordQuestIdentityExportV1Schema.parse(
  JSON.parse(readFileSync(fixtureUrl, 'utf8')),
);

const STUDENT_USER = '018f72a4-cc52-7c5a-a6f9-8b21aa27e011';
const TEACHER_USER = '018f72a4-cc52-7c5a-a6f9-8b21aa27e012';
const OTHER_USER = '018f72a4-cc52-7c5a-a6f9-8b21aa27e013';
const ORGANIZATION = '018f72a4-cc52-7c5a-a6f9-8b21aa27e021';
const OTHER_ORGANIZATION = '018f72a4-cc52-7c5a-a6f9-8b21aa27e022';
const STUDENT_EXTERNAL = 'synthetic-firebase-student-01';
const TEACHER_EXTERNAL = 'synthetic-firebase-teacher-01';
const OTHER_EXTERNAL = 'synthetic-firebase-student-02';
const LEGACY_ORGANIZATION = 'synthetic-school-01';
const OTHER_LEGACY_ORGANIZATION = 'synthetic-school-02';

function mappingFor(source: WordQuestIdentityExportV1 = baseExport): IdentityMappingPlanV1 {
  return identityMappingPlanV1Schema.parse({
    format: 'lessonquest.identity-mapping-plan',
    version: 1,
    sourceExportChecksum: canonicalizeWordQuestIdentityExport(source).checksum,
    accountMappings: [
      { externalAuthId: STUDENT_EXTERNAL, userId: STUDENT_USER },
      { externalAuthId: TEACHER_EXTERNAL, userId: TEACHER_USER },
    ],
    organizationMappings: [
      { legacyOrganizationKey: LEGACY_ORGANIZATION, organizationId: ORGANIZATION },
    ],
  });
}

function withBoundChecksum(
  source: WordQuestIdentityExportV1,
  mapping: Omit<IdentityMappingPlanV1, 'sourceExportChecksum'> & {
    readonly sourceExportChecksum?: string;
  },
): IdentityMappingPlanV1 {
  return identityMappingPlanV1Schema.parse({
    ...mapping,
    sourceExportChecksum:
      mapping.sourceExportChecksum ?? canonicalizeWordQuestIdentityExport(source).checksum,
  });
}

function codes(
  source: WordQuestIdentityExportV1,
  mapping: IdentityMappingPlanV1,
): IdentityReadinessFindingCode[] {
  return reconcileIdentityExport(source, mapping).findings.map(({ code }) => code);
}

describe('identity transition canonicalization', () => {
  it('produces exact deterministic source and mapping checksums for the synthetic fixture', () => {
    const source = canonicalizeWordQuestIdentityExport(baseExport);
    const mapping = canonicalizeIdentityMappingPlan(mappingFor());

    expect(source.checksum).toBe(
      'sha256:896ac8209a16e9b983ede82aa9a83e118d463fa79f85b74d0aeb9b8403834d12',
    );
    expect(mapping.checksum).toBe(
      'sha256:b585df2f7e0e610e1d588a1f3a3ce3dfc8125e5098f9e473ac6b24398020b091',
    );
    expect(JSON.parse(source.canonicalJson)).toEqual(baseExport);
    expect(JSON.parse(mapping.canonicalJson)).toEqual(mappingFor());
  });

  it('is independent of account and mapping input order', () => {
    const reversedExport = {
      ...baseExport,
      accounts: [...baseExport.accounts].reverse(),
    };
    const mapping = mappingFor();
    const reversedMapping = {
      ...mapping,
      accountMappings: [...mapping.accountMappings].reverse(),
      organizationMappings: [...mapping.organizationMappings].reverse(),
    };

    expect(canonicalizeWordQuestIdentityExport(reversedExport).checksum).toBe(
      canonicalizeWordQuestIdentityExport(baseExport).checksum,
    );
    expect(canonicalizeIdentityMappingPlan(reversedMapping).checksum).toBe(
      canonicalizeIdentityMappingPlan(mapping).checksum,
    );
    expect(reconcileIdentityExport(reversedExport, reversedMapping)).toEqual(
      reconcileIdentityExport(baseExport, mapping),
    );
  });

  it('uses locale-independent UTF-16 code-unit ordering for opaque identifiers', () => {
    const source = wordQuestIdentityExportV1Schema.parse({
      ...baseExport,
      accounts: [
        { ...baseExport.accounts[0]!, externalAuthId: 'ä-source' },
        { ...baseExport.accounts[1]!, externalAuthId: 'z-source' },
      ],
    });
    const canonical = canonicalizeWordQuestIdentityExport(source);

    expect(
      (JSON.parse(canonical.canonicalJson) as WordQuestIdentityExportV1).accounts.map(
        ({ externalAuthId }) => externalAuthId,
      ),
    ).toEqual(['z-source', 'ä-source']);
  });

  it('changes checksums when any bound source or mapping value changes', () => {
    const sourceChecksum = canonicalizeWordQuestIdentityExport(baseExport).checksum;
    const mapping = mappingFor();
    const mappingChecksum = canonicalizeIdentityMappingPlan(mapping).checksum;

    expect(
      canonicalizeWordQuestIdentityExport({
        ...baseExport,
        sourceCounts: { ...baseExport.sourceCounts, learningRecords: 8 },
      }).checksum,
    ).not.toBe(sourceChecksum);
    expect(
      canonicalizeWordQuestIdentityExport({
        ...baseExport,
        exportId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e099',
      }).checksum,
    ).not.toBe(sourceChecksum);
    expect(
      canonicalizeIdentityMappingPlan({
        ...mapping,
        accountMappings: mapping.accountMappings.map((entry, index) =>
          index === 0 ? { ...entry, userId: OTHER_USER } : entry,
        ),
      }).checksum,
    ).not.toBe(mappingChecksum);
  });

  it('uses a constant public validation error without rejected identity data', () => {
    const raw = 'private@example.invalid';
    let failure: unknown;
    try {
      canonicalizeWordQuestIdentityExport({ ...baseExport, email: raw });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(DataTransitionValidationError);
    expect(failure).toMatchObject({
      name: 'DataTransitionValidationError',
      message: 'Invalid data-transition input',
    });
    expect((failure as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain(raw);
    expect(String(failure)).not.toContain(raw);
  });
});

describe('identity mapping readiness', () => {
  it('returns one strict ready report for the complete synthetic fixture', () => {
    const report = reconcileIdentityExport(baseExport, mappingFor());

    expect(report).toEqual({
      format: 'lessonquest.identity-readiness-report',
      version: 1,
      sourceChecksum: canonicalizeWordQuestIdentityExport(baseExport).checksum,
      mappingChecksum: canonicalizeIdentityMappingPlan(mappingFor()).checksum,
      counts: {
        sourceRecords: 2,
        uniqueSourceAccounts: 2,
        accountMappings: 2,
        organizationMappings: 1,
        mappedAccounts: 2,
        readyAccounts: 2,
      },
      proposedRoles: { students: 1, teachers: 1 },
      ready: true,
      findings: [],
    });
  });

  it('reports a stale source checksum and count mismatch as global blockers', () => {
    const stale = { ...mappingFor(), sourceExportChecksum: `sha256:${'f'.repeat(64)}` };
    const wrongCount = {
      ...baseExport,
      sourceCounts: { ...baseExport.sourceCounts, users: 3 },
    };

    expect(codes(baseExport, identityMappingPlanV1Schema.parse(stale))).toContain(
      'SOURCE_CHECKSUM_MISMATCH',
    );
    expect(codes(wrongCount, mappingFor(wrongCount))).toContain('SOURCE_USER_COUNT_MISMATCH');
  });

  it('distinguishes identical and conflicting duplicate source accounts', () => {
    const identical = {
      ...baseExport,
      sourceCounts: { ...baseExport.sourceCounts, users: 2 },
      accounts: [baseExport.accounts[0]!, baseExport.accounts[0]!],
    };
    const conflicting = {
      ...identical,
      accounts: [baseExport.accounts[0]!, { ...baseExport.accounts[0]!, sourceRole: 'TEACHER' }],
    } as WordQuestIdentityExportV1;

    expect(codes(identical, mappingFor(identical))).toContain('DUPLICATE_EXTERNAL_ACCOUNT');
    expect(codes(conflicting, mappingFor(conflicting))).toContain('CONFLICTING_SOURCE_ACCOUNT');
  });

  it('reports privilege and organization blockers on every conflicting source record', () => {
    const source = wordQuestIdentityExportV1Schema.parse({
      ...baseExport,
      sourceCounts: { ...baseExport.sourceCounts, users: 1 },
      accounts: [
        baseExport.accounts[0]!,
        {
          ...baseExport.accounts[0]!,
          legacyOrganizationKey: OTHER_LEGACY_ORGANIZATION,
          sourceRole: 'MASTER',
        },
      ],
    });
    const mapping = withBoundChecksum(source, {
      format: 'lessonquest.identity-mapping-plan',
      version: 1,
      accountMappings: [{ externalAuthId: STUDENT_EXTERNAL, userId: STUDENT_USER }],
      organizationMappings: [
        { legacyOrganizationKey: LEGACY_ORGANIZATION, organizationId: ORGANIZATION },
      ],
    });

    expect(codes(source, mapping)).toEqual(
      expect.arrayContaining([
        'CONFLICTING_SOURCE_ACCOUNT',
        'PRIVILEGED_ROLE_REQUIRES_REVIEW',
        'UNMAPPED_LEGACY_ORGANIZATION',
      ]),
    );
  });

  it('reports duplicate account mappings and canonical-user collisions', () => {
    const base = mappingFor();
    const duplicate = withBoundChecksum(baseExport, {
      ...base,
      accountMappings: [base.accountMappings[0]!, base.accountMappings[0]!],
    });
    const collision = withBoundChecksum(baseExport, {
      ...base,
      accountMappings: [
        base.accountMappings[0]!,
        { externalAuthId: TEACHER_EXTERNAL, userId: STUDENT_USER },
      ],
    });

    expect(codes(baseExport, duplicate)).toContain('DUPLICATE_ACCOUNT_MAPPING');
    expect(codes(baseExport, collision)).toContain('CANONICAL_USER_COLLISION');
  });

  it('reports duplicate organization mappings and canonical-organization collisions', () => {
    const base = mappingFor();
    const duplicate = withBoundChecksum(baseExport, {
      ...base,
      organizationMappings: [base.organizationMappings[0]!, base.organizationMappings[0]!],
    });
    const collisionExport = wordQuestIdentityExportV1Schema.parse({
      ...baseExport,
      sourceCounts: { ...baseExport.sourceCounts, users: 3 },
      accounts: [
        ...baseExport.accounts,
        {
          externalAuthId: OTHER_EXTERNAL,
          legacyOrganizationKey: OTHER_LEGACY_ORGANIZATION,
          sourceRole: 'STUDENT',
          sourceStatus: 'ACTIVE',
        },
      ],
    });
    const collision = withBoundChecksum(collisionExport, {
      ...base,
      accountMappings: [
        ...base.accountMappings,
        { externalAuthId: OTHER_EXTERNAL, userId: OTHER_USER },
      ],
      organizationMappings: [
        base.organizationMappings[0]!,
        {
          legacyOrganizationKey: OTHER_LEGACY_ORGANIZATION,
          organizationId: ORGANIZATION,
        },
      ],
    });

    expect(codes(baseExport, duplicate)).toContain('DUPLICATE_ORGANIZATION_MAPPING');
    expect(codes(collisionExport, collision)).toContain('CANONICAL_ORGANIZATION_COLLISION');
  });

  it('reports missing and unused account and organization mappings', () => {
    const base = mappingFor();
    const missing = withBoundChecksum(baseExport, {
      ...base,
      accountMappings: [base.accountMappings[0]!],
      organizationMappings: [],
    });
    const unused = withBoundChecksum(baseExport, {
      ...base,
      accountMappings: [
        ...base.accountMappings,
        { externalAuthId: OTHER_EXTERNAL, userId: OTHER_USER },
      ],
      organizationMappings: [
        ...base.organizationMappings,
        {
          legacyOrganizationKey: OTHER_LEGACY_ORGANIZATION,
          organizationId: OTHER_ORGANIZATION,
        },
      ],
    });

    expect(codes(baseExport, missing)).toEqual(
      expect.arrayContaining(['UNMAPPED_EXTERNAL_ACCOUNT', 'UNMAPPED_LEGACY_ORGANIZATION']),
    );
    expect(codes(baseExport, unused)).toEqual(
      expect.arrayContaining(['UNUSED_ACCOUNT_MAPPING', 'UNUSED_ORGANIZATION_MAPPING']),
    );
  });

  it('always blocks MASTER without projecting elevated authority', () => {
    const source = wordQuestIdentityExportV1Schema.parse({
      ...baseExport,
      accounts: baseExport.accounts.map((entry, index) =>
        index === 1 ? { ...entry, sourceRole: 'MASTER' } : entry,
      ),
    });
    const report = reconcileIdentityExport(source, mappingFor(source));

    expect(report.ready).toBe(false);
    expect(report.findings.map(({ code }) => code)).toContain('PRIVILEGED_ROLE_REQUIRES_REVIEW');
    expect(report.proposedRoles).toEqual({ students: 1, teachers: 0 });
    expect(JSON.stringify(report)).not.toMatch(/ORG_ADMIN|SUPER_ADMIN/);
  });

  it('counts only unambiguous records as ready and emits deterministically sorted findings', () => {
    const source = wordQuestIdentityExportV1Schema.parse({
      ...baseExport,
      sourceCounts: { ...baseExport.sourceCounts, users: 3 },
      accounts: [
        ...baseExport.accounts,
        {
          externalAuthId: OTHER_EXTERNAL,
          legacyOrganizationKey: OTHER_LEGACY_ORGANIZATION,
          sourceRole: 'MASTER',
          sourceStatus: 'ACTIVE',
        },
      ],
    });
    const report = reconcileIdentityExport(source, mappingFor(source));
    const sortedCodes = [...report.findings.map(({ code }) => code)].sort();

    expect(report.counts.mappedAccounts).toBe(2);
    expect(report.counts.readyAccounts).toBe(2);
    expect(report.ready).toBe(false);
    expect(report.findings.map(({ code }) => code)).toEqual(sortedCodes);
  });

  it('never includes raw source identifiers or injected private fields in findings', () => {
    const missing = withBoundChecksum(baseExport, {
      ...mappingFor(),
      accountMappings: [],
      organizationMappings: [],
    });
    const serialized = JSON.stringify(reconcileIdentityExport(baseExport, missing));

    expect(serialized).not.toContain(STUDENT_EXTERNAL);
    expect(serialized).not.toContain(TEACHER_EXTERNAL);
    expect(serialized).not.toContain(LEGACY_ORGANIZATION);
    expect(serialized).not.toMatch(/displayName|email|token|private@example/);
    expect(serialized).toMatch(/sha256:[0-9a-f]{64}/);
  });
});

describe('package containment', () => {
  it('has a contracts-only dependency and no runtime I/O or operating-service imports', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies: Record<string, string> };
    const source = ['canonical-json.ts', 'identity-reconciliation.ts', 'index.ts']
      .map((file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
      .join('\n');

    expect(Object.keys(packageJson.dependencies)).toEqual(['@lessonquest/contracts']);
    expect(source).not.toMatch(
      /node:fs|firebase|https?:|@lessonquest\/(?:auth|db|api|web)|process\.env|\bfetch\b|XMLHttpRequest/,
    );
  });

  it('exposes transition contracts only through their dedicated package subpath', () => {
    const contractsPackage = JSON.parse(
      readFileSync(new URL('../../contracts/package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, unknown> };
    const contractsBarrel = readFileSync(
      new URL('../../contracts/src/index.ts', import.meta.url),
      'utf8',
    );

    expect(contractsPackage.exports['./data-transition']).toEqual({
      types: './dist/data-transition.d.ts',
      default: './dist/data-transition.js',
    });
    expect(contractsBarrel).not.toContain("export * from './data-transition.js'");
  });
});
