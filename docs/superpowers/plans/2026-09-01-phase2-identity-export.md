# Phase 2 Identity Export Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned, side-effect-free WordQuest identity export and explicit mapping-readiness validator using synthetic fixtures only.

**Architecture:** `@lessonquest/contracts` owns strict v1 input/report schemas. A new `@lessonquest/data-transition` package validates, canonicalizes, hashes and reconciles caller-owned values without filesystem, Firebase, HTTP, database, environment or browser access. No current auth, tenant, API, DB or web runtime imports the package.

**Tech Stack:** TypeScript 6, Zod 4.5.2 through `@lessonquest/contracts`, Node `crypto`, Vitest 4, pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-01-phase2-identity-export-design.md`

## Global Constraints

- Use only synthetic source identifiers and UUIDs. Do not access Firebase, real student data, a reference deployment, a persistent database, credentials or paid resources.
- Do not modify the WordQuest repository, deployment or data.
- Do not add a DB column/table, auth adapter, API, CLI, file reader, environment variable, UI or browser bundle import.
- Treat source organization keys and roles as data to reconcile, never authorization. `MASTER` always blocks readiness and never implies `ORG_ADMIN` or `SUPER_ADMIN`.
- Do not silently trim opaque identifiers. Never echo raw `externalAuthId`, `legacyOrganizationKey` or rejected input in errors or findings.
- Preserve every external dependency and version. The lockfile may add only the new workspace importer's `workspace:*` link to `@lessonquest/contracts`; hashing uses built-in `node:crypto`.
- Implementation begins only after the recorded plan score is at least 86/100 with no critical blocker. Completion requires a different independent reviewer to score the actual candidate above 85 with no critical blocker.

---

## File map

| File                                                                                                  | Responsibility                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/contracts/src/data-transition.ts`                                                           | Strict export, plan, finding and report schemas/types                 |
| `packages/contracts/test/data-transition.test.ts`                                                     | Structural contract bounds and rejection tests                        |
| `packages/contracts/src/index.ts`                                                                     | Public contract export                                                |
| `packages/data-transition/package.json`                                                               | Private side-effect-free package metadata; contracts-only dependency  |
| `packages/data-transition/tsconfig.json`                                                              | Standard workspace TypeScript build                                   |
| `packages/data-transition/src/canonical-json.ts`                                                      | Stable object-key serialization and SHA-256 helpers                   |
| `packages/data-transition/src/identity-reconciliation.ts`                                             | Domain array ordering, validation, reconciliation and redacted report |
| `packages/data-transition/src/index.ts`                                                               | Public package export                                                 |
| `packages/data-transition/test/fixtures/wordquest-identity-export-v1.json`                            | Synthetic valid v1 export                                             |
| `packages/data-transition/test/identity-reconciliation.test.ts`                                       | Determinism, blockers, readiness and redaction tests                  |
| `pnpm-lock.yaml`                                                                                      | New workspace importer with a contracts-only local link               |
| `package.json`                                                                                        | Build the package in dependency order                                 |
| `README.md`, `docs/PHASE2_PROGRESS.md`, `docs/SOURCE_PROVENANCE.md`, `memory/projects/lessonquest.md` | Scope, status, provenance and remaining transition limits             |
| `docs/reviews/2026-09-01-phase2-identity-export-verification.md`                                      | Implementer evidence and exact counts                                 |
| `docs/reviews/2026-09-01-phase2-identity-export-final-review.md`                                      | Independent final gate                                                |

## Task 1 — strict transition contracts

Produces: versioned schemas whose values cannot carry unintended identity, credential or authority fields.

- [ ] Add `packages/contracts/test/data-transition.test.ts` first. Assert a minimal valid export/plan/report, exact opaque identifier preservation, offset-aware timestamp validation, safe integer/count bounds, 100,000-record caps, content-hash/UUID validation, strict unknown-field rejection and invalid format/version/source/role/status rejection.
- [ ] Include explicit cases proving display name, email, token, organization label and target-role injection are rejected; leading/trailing whitespace and control characters in opaque identifiers are rejected rather than normalized.
- [ ] Run `corepack pnpm exec vitest run packages/contracts/test/data-transition.test.ts` and record RED because the module/exports do not exist.
- [ ] Add `packages/contracts/src/data-transition.ts` with named constants for formats/version, bounded exact-identifier schema, strict `sourceCounts`, account/mapping schemas, finding-code enum, finding schema and strict report schema. Export inferred public types.
- [ ] Export the module from `packages/contracts/src/index.ts` and rerun the focused contract test GREEN.

Exact report fields:

```ts
{
  format: 'lessonquest.identity-readiness-report';
  version: 1;
  sourceChecksum: `sha256:${string}`;
  mappingChecksum: `sha256:${string}`;
  counts: {
    sourceRecords: number;
    uniqueSourceAccounts: number;
    accountMappings: number;
    organizationMappings: number;
    mappedAccounts: number;
    readyAccounts: number;
  }
  proposedRoles: {
    students: number;
    teachers: number;
  }
  ready: boolean;
  findings: Array<{
    code: IdentityReadinessFindingCode;
    severity: 'BLOCKER';
    recordIndex?: number;
    mappingIndex?: number;
    relatedIndex?: number;
    fingerprint?: `sha256:${string}`;
    canonicalId?: string;
  }>;
}
```

Finding codes are exactly: `SOURCE_CHECKSUM_MISMATCH`, `SOURCE_USER_COUNT_MISMATCH`, `DUPLICATE_EXTERNAL_ACCOUNT`, `CONFLICTING_SOURCE_ACCOUNT`, `DUPLICATE_ACCOUNT_MAPPING`, `CANONICAL_USER_COLLISION`, `DUPLICATE_ORGANIZATION_MAPPING`, `CANONICAL_ORGANIZATION_COLLISION`, `UNMAPPED_EXTERNAL_ACCOUNT`, `UNMAPPED_LEGACY_ORGANIZATION`, `UNUSED_ACCOUNT_MAPPING`, `UNUSED_ORGANIZATION_MAPPING`, `PRIVILEGED_ROLE_REQUIRES_REVIEW`.

## Task 2 — canonicalization and pure readiness reconciliation

Produces: one isolated package that returns a deterministic complete report and performs no I/O.

- [ ] Scaffold the package config and synthetic fixture, then write `packages/data-transition/test/identity-reconciliation.test.ts` before implementation. Import the missing public functions so the focused suite is RED.
- [ ] Cover a complete ready fixture; pin exact source/mapping checksums; prove reordered accounts/mappings keep checksums and reports identical; prove any metadata/count/identifier/mapping mutation changes the relevant checksum.
- [ ] Add table cases for all 13 finding codes. Include identical duplicate source records, conflicting duplicates, duplicate mappings, canonical UUID collisions, missing and unused mappings, user-count mismatch, source-checksum mismatch and `MASTER` blocking.
- [ ] Assert `ready` is true only with zero findings, `readyAccounts` excludes every blocked account, proposed roles count only ready `STUDENT`/`TEACHER` accounts, and findings sort by code/index/fingerprint.
- [ ] Serialize reports and thrown public validation errors, then assert none contain the fixture's raw external account/organization keys, injected email/token/display name, Zod input dump, stack or cause.
- [ ] Add a package-containment test reading only repository metadata/test sources to assert production source imports no `fs`, Firebase, HTTP, DB, auth, API, web or environment module and `package.json` has only `@lessonquest/contracts` as a dependency.
- [ ] Run the focused suite and record RED before functions exist.
- [ ] Implement `canonical-json.ts`: recursively sort plain-object keys, preserve array order, reject non-JSON values internally, encode UTF-8 with `JSON.stringify`, hash with `node:crypto`, and fingerprint each raw identifier independently.
- [ ] Implement domain canonicalizers: parse first, sort export accounts and mapping arrays by their full stable record strings, then stable-stringify and hash. This makes conflict ordering deterministic without merging or trimming values.
- [ ] Implement a constant-message `DataTransitionValidationError`. Catch only input-schema failures and throw it without attaching source input/cause; let unexpected programming failures propagate.
- [ ] Implement reconciliation as a read-only multi-pass index. Collect every blocker, use source indexes from the original input for findings, fingerprint raw identifiers, never emit them, and validate the final object through `identityReadinessReportV1Schema` before returning.
- [ ] Export public functions/types, add the package to `deps:build`, and rerun focused contract and package tests GREEN.

Public functions:

```ts
canonicalizeWordQuestIdentityExport(input: unknown): {
  value: WordQuestIdentityExportV1;
  canonicalJson: string;
  checksum: ContentHash;
};

canonicalizeIdentityMappingPlan(input: unknown): {
  value: IdentityMappingPlanV1;
  canonicalJson: string;
  checksum: ContentHash;
};

reconcileIdentityExport(
  exportInput: unknown,
  mappingInput: unknown,
): IdentityReadinessReportV1;
```

## Task 3 — regression, documentation and verification evidence

Produces: a reviewed candidate whose package remains outside operating runtime paths.

- [ ] Run focused tests, `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm test:browser`, `corepack pnpm test:preview`, `corepack pnpm audit --prod --audit-level high` and `git diff --check` sequentially. Do not increase timeouts to hide failures.
- [ ] Inspect normal/preview build manifests or emitted assets and prove `@lessonquest/data-transition`, its fixture strings and raw synthetic identifiers are absent from browser output.
- [ ] Update README, Phase 2 progress, provenance and project memory. State that this is synthetic mapping readiness, not a Firebase exporter, migration, real-data dry run, schema change or authorization adapter.
- [ ] Record RED/GREEN commands, exact final counts, build warnings, containment evidence and limitations in `docs/reviews/2026-09-01-phase2-identity-export-verification.md`.
- [ ] Freeze SHA-256 hashes for every implementation/test/script file reviewed by the independent agent. Documentation-only status edits after the gate must not alter the reviewed manifest.

## Task 4 — independent gate and authorized delivery

Produces: independently accepted code merged and released through the existing Git-linked workflow.

- [ ] Assign a fresh non-implementing agent to inspect the actual diff and hash manifest, run the relevant focused/full/regression/containment checks, and score the five project rubric categories. Preserve a failed report and remediate test-first if the score is 85 or below or any critical blocker exists.
- [ ] After a score of at least 86 with no blocker, commit the exact reviewed candidate, push the feature branch, open a PR and require exact-head CI. Confirm `main` did not move unexpectedly and merge only with the expected reviewed head SHA.
- [ ] Synchronize local `main`; verify exact-merge main CI and the existing Git-linked Vercel status. Do not create a duplicate manual deployment.
- [ ] Verify the live synthetic preview remains healthy with no external request/browser error and that its delivered JS/assets contain no data-transition fixture or source identifier. Record head SHA, merge SHA, CI, deployment and live evidence in the PR body.

## Recovery and acceptance trace

- Contract/package failure: remove the unused package/contracts or revert the reviewed commit; no stored or external state exists.
- Invalid export/mapping: return a safe validation error or `ready: false`; change only a caller-owned copy and rerun. Never apply partial results.
- Mapping ambiguity: require explicit corrected mappings; do not infer from names, email, role or organization label.
- Future transition: a Firebase exporter, I/O, schema, writes, real-data checks, backups and rollback rehearsal remain separate gated work.
- Acceptance trace: spec versioned inputs → Tasks 1–2; canonical checksum and redaction → Task 2; tenant/role fail-closed behavior → Tasks 1–2; no runtime/data access → Tasks 2–3; full/independent/release evidence → Tasks 3–4.
