import {
  IDENTITY_READINESS_REPORT_FORMAT,
  IDENTITY_TRANSITION_VERSION,
  identityMappingPlanV1Schema,
  identityReadinessReportV1Schema,
  wordQuestIdentityExportV1Schema,
  type IdentityMappingPlanV1,
  type IdentityReadinessFindingV1,
  type IdentityReadinessReportV1,
  type WordQuestIdentityAccountV1,
  type WordQuestIdentityExportV1,
} from '@lessonquest/contracts';

import {
  compareCodeUnits,
  fingerprintIdentifier,
  sha256,
  stableStringify,
} from './canonical-json.js';

export class DataTransitionValidationError extends Error {
  constructor() {
    super('Invalid data-transition input');
    this.name = 'DataTransitionValidationError';
  }
}

export interface CanonicalizedTransitionValue<T> {
  readonly value: T;
  readonly canonicalJson: string;
  readonly checksum: string;
}

function parseExport(input: unknown): WordQuestIdentityExportV1 {
  const parsed = wordQuestIdentityExportV1Schema.safeParse(input);
  if (!parsed.success) throw new DataTransitionValidationError();
  return parsed.data;
}

function parseMapping(input: unknown): IdentityMappingPlanV1 {
  const parsed = identityMappingPlanV1Schema.safeParse(input);
  if (!parsed.success) throw new DataTransitionValidationError();
  return parsed.data;
}

function compareStable(left: unknown, right: unknown): number {
  return compareCodeUnits(stableStringify(left), stableStringify(right));
}

export function canonicalizeWordQuestIdentityExport(
  input: unknown,
): CanonicalizedTransitionValue<WordQuestIdentityExportV1> {
  const value = parseExport(input);
  const canonicalValue = {
    ...value,
    accounts: [...value.accounts].sort(compareStable),
  };
  const canonicalJson = stableStringify(canonicalValue);
  return { value, canonicalJson, checksum: sha256(canonicalJson) };
}

export function canonicalizeIdentityMappingPlan(
  input: unknown,
): CanonicalizedTransitionValue<IdentityMappingPlanV1> {
  const value = parseMapping(input);
  const canonicalValue = {
    ...value,
    accountMappings: [...value.accountMappings].sort(compareStable),
    organizationMappings: [...value.organizationMappings].sort(compareStable),
  };
  const canonicalJson = stableStringify(canonicalValue);
  return { value, canonicalJson, checksum: sha256(canonicalJson) };
}

interface Indexed<T> {
  readonly index: number;
  readonly value: T;
}

function indexBy<T>(values: readonly T[], select: (value: T) => string): Map<string, Indexed<T>[]> {
  const groups = new Map<string, Indexed<T>[]>();
  values.forEach((value, index) => {
    const key = select(value);
    const existing = groups.get(key) ?? [];
    existing.push({ index, value });
    groups.set(key, existing);
  });
  return groups;
}

function finding(
  code: IdentityReadinessFindingV1['code'],
  fields: Omit<IdentityReadinessFindingV1, 'code' | 'severity'> = {},
): IdentityReadinessFindingV1 {
  return { code, severity: 'BLOCKER', ...fields };
}

function compareFinding(
  left: IdentityReadinessFindingV1,
  right: IdentityReadinessFindingV1,
): number {
  const numberValue = (value: number | undefined) => value ?? Number.MAX_SAFE_INTEGER;
  return (
    compareCodeUnits(left.code, right.code) ||
    numberValue(left.recordIndex) - numberValue(right.recordIndex) ||
    numberValue(left.mappingIndex) - numberValue(right.mappingIndex) ||
    numberValue(left.relatedIndex) - numberValue(right.relatedIndex) ||
    compareCodeUnits(left.fingerprint ?? '', right.fingerprint ?? '') ||
    compareCodeUnits(left.canonicalId ?? '', right.canonicalId ?? '')
  );
}

function blockSourceIndexes(
  groups: Map<string, Indexed<WordQuestIdentityAccountV1>[]>,
  key: string,
  blocked: Set<number>,
): void {
  for (const entry of groups.get(key) ?? []) blocked.add(entry.index);
}

export function reconcileIdentityExport(
  exportInput: unknown,
  mappingInput: unknown,
): IdentityReadinessReportV1 {
  const source = canonicalizeWordQuestIdentityExport(exportInput);
  const mapping = canonicalizeIdentityMappingPlan(mappingInput);
  const sourceAccounts = indexBy(source.value.accounts, ({ externalAuthId }) => externalAuthId);
  const sourceOrganizations = indexBy(
    source.value.accounts,
    ({ legacyOrganizationKey }) => legacyOrganizationKey,
  );
  const accountMappings = indexBy(
    mapping.value.accountMappings,
    ({ externalAuthId }) => externalAuthId,
  );
  const organizationMappings = indexBy(
    mapping.value.organizationMappings,
    ({ legacyOrganizationKey }) => legacyOrganizationKey,
  );
  const mappingsByCanonicalUser = indexBy(mapping.value.accountMappings, ({ userId }) => userId);
  const mappingsByCanonicalOrganization = indexBy(
    mapping.value.organizationMappings,
    ({ organizationId }) => organizationId,
  );
  const findings: IdentityReadinessFindingV1[] = [];
  const blockedSourceIndexes = new Set<number>();
  let globalSourceBlocker = false;

  if (mapping.value.sourceExportChecksum !== source.checksum) {
    findings.push(finding('SOURCE_CHECKSUM_MISMATCH'));
    globalSourceBlocker = true;
  }
  if (source.value.sourceCounts.users !== sourceAccounts.size) {
    findings.push(finding('SOURCE_USER_COUNT_MISMATCH'));
    globalSourceBlocker = true;
  }

  for (const [externalAuthId, group] of sourceAccounts) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const firstValue = stableStringify(first.value);
    for (const duplicate of group.slice(1)) {
      findings.push(
        finding(
          stableStringify(duplicate.value) === firstValue
            ? 'DUPLICATE_EXTERNAL_ACCOUNT'
            : 'CONFLICTING_SOURCE_ACCOUNT',
          {
            recordIndex: duplicate.index,
            relatedIndex: first.index,
            fingerprint: fingerprintIdentifier(externalAuthId),
          },
        ),
      );
    }
    blockSourceIndexes(sourceAccounts, externalAuthId, blockedSourceIndexes);
  }

  for (const [externalAuthId, group] of accountMappings) {
    if (group.length < 2) continue;
    const first = group[0]!;
    for (const duplicate of group.slice(1)) {
      findings.push(
        finding('DUPLICATE_ACCOUNT_MAPPING', {
          mappingIndex: duplicate.index,
          relatedIndex: first.index,
          fingerprint: fingerprintIdentifier(externalAuthId),
          canonicalId: duplicate.value.userId,
        }),
      );
    }
    blockSourceIndexes(sourceAccounts, externalAuthId, blockedSourceIndexes);
  }

  for (const [userId, group] of mappingsByCanonicalUser) {
    const externalIds = new Set(group.map(({ value }) => value.externalAuthId));
    if (externalIds.size < 2) continue;
    const first = group[0]!;
    for (const collision of group.slice(1)) {
      if (collision.value.externalAuthId === first.value.externalAuthId) continue;
      findings.push(
        finding('CANONICAL_USER_COLLISION', {
          mappingIndex: collision.index,
          relatedIndex: first.index,
          fingerprint: fingerprintIdentifier(collision.value.externalAuthId),
          canonicalId: userId,
        }),
      );
    }
    for (const externalAuthId of externalIds) {
      blockSourceIndexes(sourceAccounts, externalAuthId, blockedSourceIndexes);
    }
  }

  for (const [legacyOrganizationKey, group] of organizationMappings) {
    if (group.length < 2) continue;
    const first = group[0]!;
    for (const duplicate of group.slice(1)) {
      findings.push(
        finding('DUPLICATE_ORGANIZATION_MAPPING', {
          mappingIndex: duplicate.index,
          relatedIndex: first.index,
          fingerprint: fingerprintIdentifier(legacyOrganizationKey),
          canonicalId: duplicate.value.organizationId,
        }),
      );
    }
    for (const sourceEntry of sourceOrganizations.get(legacyOrganizationKey) ?? []) {
      blockedSourceIndexes.add(sourceEntry.index);
    }
  }

  for (const [organizationId, group] of mappingsByCanonicalOrganization) {
    const legacyKeys = new Set(group.map(({ value }) => value.legacyOrganizationKey));
    if (legacyKeys.size < 2) continue;
    const first = group[0]!;
    for (const collision of group.slice(1)) {
      if (collision.value.legacyOrganizationKey === first.value.legacyOrganizationKey) continue;
      findings.push(
        finding('CANONICAL_ORGANIZATION_COLLISION', {
          mappingIndex: collision.index,
          relatedIndex: first.index,
          fingerprint: fingerprintIdentifier(collision.value.legacyOrganizationKey),
          canonicalId: organizationId,
        }),
      );
    }
    for (const legacyKey of legacyKeys) {
      for (const sourceEntry of sourceOrganizations.get(legacyKey) ?? []) {
        blockedSourceIndexes.add(sourceEntry.index);
      }
    }
  }

  for (const [externalAuthId, group] of sourceAccounts) {
    const representative = group[0]!;
    if ((accountMappings.get(externalAuthId) ?? []).length === 0) {
      findings.push(
        finding('UNMAPPED_EXTERNAL_ACCOUNT', {
          recordIndex: representative.index,
          fingerprint: fingerprintIdentifier(externalAuthId),
        }),
      );
      blockSourceIndexes(sourceAccounts, externalAuthId, blockedSourceIndexes);
    }
  }

  for (const [legacyOrganizationKey, group] of sourceOrganizations) {
    if ((organizationMappings.get(legacyOrganizationKey) ?? []).length > 0) continue;
    findings.push(
      finding('UNMAPPED_LEGACY_ORGANIZATION', {
        recordIndex: group[0]!.index,
        fingerprint: fingerprintIdentifier(legacyOrganizationKey),
      }),
    );
    for (const sourceEntry of group) blockedSourceIndexes.add(sourceEntry.index);
  }

  source.value.accounts.forEach((account, recordIndex) => {
    if (account.sourceRole === 'MASTER') {
      findings.push(
        finding('PRIVILEGED_ROLE_REQUIRES_REVIEW', {
          recordIndex,
          fingerprint: fingerprintIdentifier(account.externalAuthId),
        }),
      );
      blockedSourceIndexes.add(recordIndex);
    }
  });

  mapping.value.accountMappings.forEach((entry, mappingIndex) => {
    if (sourceAccounts.has(entry.externalAuthId)) return;
    findings.push(
      finding('UNUSED_ACCOUNT_MAPPING', {
        mappingIndex,
        fingerprint: fingerprintIdentifier(entry.externalAuthId),
        canonicalId: entry.userId,
      }),
    );
  });
  mapping.value.organizationMappings.forEach((entry, mappingIndex) => {
    if (sourceOrganizations.has(entry.legacyOrganizationKey)) return;
    findings.push(
      finding('UNUSED_ORGANIZATION_MAPPING', {
        mappingIndex,
        fingerprint: fingerprintIdentifier(entry.legacyOrganizationKey),
        canonicalId: entry.organizationId,
      }),
    );
  });

  const uniqueAccounts = [...sourceAccounts.values()].map((group) => group[0]!);
  const mappedAccounts = uniqueAccounts.filter(
    ({ value }) => (accountMappings.get(value.externalAuthId) ?? []).length === 1,
  );
  const readyAccounts = globalSourceBlocker
    ? []
    : uniqueAccounts.filter(({ index }) => !blockedSourceIndexes.has(index));
  const proposedRoles = readyAccounts.reduce(
    (totals, { value }) => {
      if (value.sourceRole === 'STUDENT') totals.students += 1;
      if (value.sourceRole === 'TEACHER') totals.teachers += 1;
      return totals;
    },
    { students: 0, teachers: 0 },
  );
  findings.sort(compareFinding);

  return identityReadinessReportV1Schema.parse({
    format: IDENTITY_READINESS_REPORT_FORMAT,
    version: IDENTITY_TRANSITION_VERSION,
    sourceChecksum: source.checksum,
    mappingChecksum: mapping.checksum,
    counts: {
      sourceRecords: source.value.accounts.length,
      uniqueSourceAccounts: sourceAccounts.size,
      accountMappings: mapping.value.accountMappings.length,
      organizationMappings: mapping.value.organizationMappings.length,
      mappedAccounts: mappedAccounts.length,
      readyAccounts: readyAccounts.length,
    },
    proposedRoles,
    ready: findings.length === 0,
    findings,
  });
}
