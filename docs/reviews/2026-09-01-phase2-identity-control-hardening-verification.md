# Phase 2 identity control-character hardening verification

Date: 2026-09-01

Base: `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`

Plan: `docs/superpowers/plans/2026-09-01-phase2-identity-control-hardening.md`

Plan gate: **99/100 PASS, no critical blocker**

## Candidate behavior

- The one shared opaque-identifier predicate now rejects the complete Unicode `Cc` ranges used by the v1 transition contract: C0 U+0000–U+001F and DEL/C1 U+007F–U+009F.
- U+0080, U+0085 and U+009F are rejected through export `externalAuthId`, export `legacyOrganizationKey`, account-mapping `externalAuthId` and organization-mapping `legacyOrganizationKey` paths.
- Adjacent U+007E and an internal U+00A0 remain byte-preserved, so the correction does not trim, normalize or broaden the rejected range.
- Pure-package invalid input still throws only `DataTransitionValidationError: Invalid data-transition input`. Its serialized public value contains only the constant error name; the rejected identifier, Zod input, cause and stack are absent.
- The v1 formats, schema shapes, messages, mapping and reconciliation algorithms, finding codes, canonical JSON and pinned source/mapping checksums are unchanged.

## TDD evidence

The first focused run followed test-only edits and reproduced the reported defect:

```text
Test Files 2 failed
Tests 4 failed | 44 passed (48)
```

The three contract failures showed U+0080, U+0085 and U+009F accepted instead of throwing. The package failure showed no `DataTransitionValidationError` was raised for U+0085.

After the one predicate change, direct contract tests passed while the package case still consumed the previous `packages/contracts/dist` build. Building `@lessonquest/contracts` made rejection observable through the package subpath. The first exact serialized-error assertion then exposed the established enumerable constant `name`; the test was corrected to require exactly `{"name":"DataTransitionValidationError"}`, still excluding input, cause and stack. No production change was made for either test-harness correction.

Final focused result after the dependency build:

```text
Test Files 2 passed (2)
Tests 48 passed (48)
```

The focused package file retains the exact pinned checksums:

- source: `sha256:896ac8209a16e9b983ede82aa9a83e118d463fa79f85b74d0aeb9b8403834d12`
- mapping: `sha256:b585df2f7e0e610e1d588a1f3a3ce3dfc8125e5098f9e473ac6b24398020b091`

## Final implementer verification

| Check                                                                                                              | Result                                                |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| focused contracts and reconciliation                                                                               | PASS — 2 files / 48 tests                             |
| `corepack pnpm check`                                                                                              | PASS — 39 files / 430 tests; lint/format/types/builds |
| `corepack pnpm test:integration`                                                                                   | PASS — 7 files / 52 tests                             |
| `corepack pnpm test:e2e`                                                                                           | PASS — 11 files / 77 tests                            |
| `corepack pnpm test:browser`                                                                                       | PASS — 12 Chromium cases                              |
| `corepack pnpm test:preview`                                                                                       | PASS — 33 Chromium cases                              |
| `corepack pnpm audit --prod --audit-level high`                                                                    | PASS — no known vulnerabilities                       |
| `git diff --check`                                                                                                 | PASS                                                  |
| normal/demo/preview JS and source-map scan for formats, package, privileged finding and synthetic identity markers | PASS — 18 emitted files / zero matches                |
| base-to-candidate lockfile and dependency-manifest diff                                                            | PASS — unchanged                                      |

The first `corepack pnpm check` run stopped at Prettier on the new contract test. Formatting only that test file resolved it; the complete command was then rerun from the start and passed. The service-preview build repeated the existing PGlite direct-`eval` and large-chunk warnings. The normal and demo builds do not contain PGlite, and this candidate introduces no warning, dependency or version change.

The emitted-asset scan covered JavaScript and source maps in `apps/web/dist`, `apps/web/dist-normal-check` and `apps/web/dist-preview`. It searched for all three transition format names, `@lessonquest/data-transition`, `PRIVILEGED_ROLE_REQUIRES_REVIEW`, `synthetic-firebase-student-01` and `synthetic-school-01`; no match was found.

## Scope, security and recovery

The actual production diff is one fail-closed predicate correction in `packages/contracts/src/data-transition.ts`. Test changes exercise exact boundaries, all four shared schema paths and the package error surface. No application, service, auth, database, schema, migration, API, web runtime, Vercel configuration, lockfile or dependency manifest changed.

Only synthetic strings were used. No Firebase, WordQuest repository or deployment, filesystem input, persistent database, credential, real student data, paid resource or external system was accessed or mutated. Recovery is a normal code revert because the package remains pure and this change writes no state.

This candidate closes independent finding F1 before any real identity input is connected. It does not authorize or implement a Firebase exporter, real-data inspection, backup, file reader, CLI, API, auth adapter, database identity column, dry run, migration or rollback rehearsal. Those remain separate gated tasks with explicit data-scope authority.

The three implementation/test files are frozen in `/tmp/lq-phase2-identity-control-hardening-hashes.json` for independent review. Documentation-only evidence changes remain outside that manifest and must not alter the three reviewed hashes.

Fresh independent final validation subsequently passed **99/100 with no critical blocker** in `docs/reviews/2026-09-01-phase2-identity-control-hardening-final-review.md`. The reviewer reran the full matrix, matched all three hashes before and after, scanned 18 emitted JavaScript/source-map files and passed a 40-path adversarial boundary probe. Exact-head CI and delivery evidence still follow this implementation report.
