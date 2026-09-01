# Phase 2 identity control-character hardening — independent final validation

Date: 2026-09-01
Reviewer: fresh independent non-implementing agent `phase2_identity_control_final_validation`
Base: `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`
Branch: `codex/phase2-identity-control-hardening`
Candidate: branch commit `db5b5fc7c2aea2b21921466b26363a7aee2c6b19` plus the inspected base-to-working-tree candidate, frozen by `/tmp/lq-phase2-identity-control-hardening-hashes.json`

## Decision

**PASS — 99/100. No critical blocker remains.**

The candidate closes the prior identity-export review's C1 finding within the approved synthetic contract-only scope. The shared opaque-key predicate now rejects exactly C0 U+0000–U+001F and DEL/C1 U+007F–U+009F. It preserves adjacent printable, Unicode-space-inside-key and astral values byte for byte, performs no normalization, and leaves formats, schemas, error text, reconciliation, finding codes and pinned checksums unchanged.

No Firebase, real identity/student data, filesystem input, network, database, auth, API, CLI, migration or operating runtime is connected. No dependency manifest, lockfile or external version changed. A real exporter, real-data dry run and migration remain separately gated work.

## Independence and candidate integrity

- I did not implement this candidate. I did not edit its implementation, tests, scripts, package manifests or lockfile. My only repository change is this report.
- I read `AGENTS.md`, `docs/PROJECT_CANON.md`, the approved implementation plan, its **99/100** plan review, the implementer verification record and the final rubric in `memory/projects/lessonquest.md`.
- I inspected the actual diff from `79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`, including documentation and the untracked verification record. The production change is one shared predicate in `packages/contracts/src/data-transition.ts`; two test files add the planned regression evidence. No app, service, auth, DB, web, deployment, package manifest or lockfile changed.
- Before checks, all **3/3** frozen implementation/test SHA-256 values matched `/tmp/lq-phase2-identity-control-hardening-hashes.json`. They still matched after focused, full, browser, audit, asset and adversarial validation.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | The exact C0/DEL/C1 ranges, all four public identity-key paths, no-normalization behavior, constant public failure, checksum compatibility and synthetic-only exclusions match the approved plan. The candidate adds no exporter, I/O, runtime or migration scope.                                                                                                                                                                 |
| Correctness and code quality                |      20/20 | `packages/contracts/src/data-transition.ts:18-29` iterates Unicode code points and applies the exact `Cc` ranges without splitting astral values. The correction remains centralized and does not alter any public shape or reconciliation algorithm. Independent boundary probes confirmed rejection and preservation at every requested point.                                                                                   |
| Security, privacy, and tenant isolation     |      20/20 | C1 identifiers now fail closed before later transport or operator tooling can consume them. Invalid package input exposes only the constant error name/message and no raw value, cause or serialized stack. The package remains pure, legacy organization keys remain non-authoritative, and no real data, secret, tenant operation or external system was accessed.                                                               |
| Test and verification evidence              |      19/20 | Fresh focused **48**, full **430**, integration **52**, E2E **77**, demo Chromium **12** and preview Chromium **33** checks passed, as did audit, diff, dependency and emitted-asset checks. Durable tests cover representative C0/DEL/C1 and adjacent values on all paths. One point is withheld because the astral printable and complete C0 endpoint matrix exist in this review probe rather than checked-in regression cases. |
| Operability, recoverability, and provenance |      15/15 | The pure predicate has no state or partial-application path; recovery is an ordinary revert. Documentation retains the real-transition approval boundary, prior PR provenance and exact test/hash evidence. No copied source, dependency, schema, deployment or external resource needs recovery.                                                                                                                                  |
| **Total**                                   | **99/100** | **Strictly greater than 85; the independent final-validation gate passes.**                                                                                                                                                                                                                                                                                                                                                        |

## Findings

No critical, high, moderate or low implementation defect was found.

The single scored evidence limitation is nonblocking: the checked-in cases at `packages/contracts/test/data-transition.test.ts:99-158` pin newline, DEL, lower/middle/upper C1 and U+007E/U+00A0 behavior, while U+0000, U+001F, U+00A1 and an astral printable value were verified only by this independent adversarial probe. The exact code-point predicate and the wider probe both pass, so this does not undermine the approved acceptance criteria or require remediation before delivery.

## Code and contract inspection

`packages/contracts/src/data-transition.ts:18-29` uses `for...of`, obtains the full code point and rejects `codePoint <= 0x1f` or `0x7f <= codePoint <= 0x9f`. This is the exact Unicode general-category `Cc` set. U+007E, internal U+00A0, U+00A1 and U+1F680 remain accepted; the astral value confirms the loop does not misclassify surrogate halves.

The same `externalIdentityKeySchema` remains applied to export `externalAuthId`, export `legacyOrganizationKey`, account-mapping `externalAuthId` and organization-mapping `legacyOrganizationKey`. The checked-in C1 table at `packages/contracts/test/data-transition.test.ts:67-71` and four-path assertions at lines 115–146 cover U+0080, U+0085 and U+009F. Existing C0/DEL and accepted-boundary assertions remain at lines 99–113 and 148–158.

The pure-package case at `packages/data-transition/test/identity-reconciliation.test.ts:171-192` confirms C1 invalid input becomes `DataTransitionValidationError: Invalid data-transition input`. My independent package probe obtained exactly `{"name":"DataTransitionValidationError"}` from `JSON.stringify(error)`, with no raw identity, Zod input, cause or stack in the serialized public value. `String(error)` also contained no raw identity.

The accepted fixture still canonicalizes to these fixed values:

- source: `sha256:896ac8209a16e9b983ede82aa9a83e118d463fa79f85b74d0aeb9b8403834d12`
- mapping: `sha256:b585df2f7e0e610e1d588a1f3a3ce3dfc8125e5098f9e473ac6b24398020b091`

An additional composed/decomposed Unicode probe retained `synthetic-é-identity` and `synthetic-e◌́-identity` as distinct input strings. No trimming, NFC/NFD normalization or replacement occurred.

## Independent adversarial probe

The built-package probe applied every value below to all four public identity-key paths, for **40 path checks** total:

| Value                    | Expected | Result                                        |
| ------------------------ | -------- | --------------------------------------------- |
| U+0000                   | reject   | rejected on all four paths                    |
| U+001F                   | reject   | rejected on all four paths                    |
| U+007E                   | preserve | accepted and byte-preserved on all four paths |
| U+007F                   | reject   | rejected on all four paths                    |
| U+0080                   | reject   | rejected on all four paths                    |
| U+0085                   | reject   | rejected on all four paths                    |
| U+009F                   | reject   | rejected on all four paths                    |
| internal U+00A0          | preserve | accepted and byte-preserved on all four paths |
| U+00A1                   | preserve | accepted and byte-preserved on all four paths |
| U+1F680 astral printable | preserve | accepted and byte-preserved on all four paths |

The same probe confirmed the constant redacted package error, no normalization and both pinned checksums. It used only synthetic in-memory objects and did not access Firebase, a database, real student data or any external system.

## Isolation and dependency evidence

- The base-to-tree dependency-manifest/lockfile diff is empty. `package.json`, every workspace `package.json` and `pnpm-lock.yaml` are unchanged.
- Source inspection found no filesystem, Firebase, HTTP/fetch, database, environment or persistence access in `packages/data-transition/src` or the changed contract module.
- Runtime import search outside the dedicated contract/package area found no app, service, auth, DB or web consumer of the transition package/subpath.
- Rebuilt normal, demo and service-preview output contained **18 JavaScript/source-map files**. A raw byte scan found zero occurrences of all three transition format strings, `@lessonquest/data-transition`, `PRIVILEGED_ROLE_REQUIRES_REVIEW`, `synthetic-firebase-student-01`, `synthetic-firebase-user-01` or `synthetic-school-01`.
- The preview build repeated the existing PGlite direct-`eval` and large-chunk warnings. Normal and demo builds do not include PGlite, and this candidate changes neither that runtime nor its dependencies.

## Fresh independent command evidence

| Command/check                                                                                                                    | Result                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Frozen SHA-256 verification before review                                                                                        | PASS — 3/3 exact matches                                               |
| contracts build plus two focused files                                                                                           | PASS — 2 files / 48 tests                                              |
| `corepack pnpm check`                                                                                                            | PASS — 39 files / 430 tests; ESLint, Prettier, types and builds passed |
| `corepack pnpm test:integration`                                                                                                 | PASS — 7 files / 52 tests                                              |
| `corepack pnpm test:e2e`                                                                                                         | PASS — 11 files / 77 tests                                             |
| `corepack pnpm test:browser`                                                                                                     | PASS — 12/12 Chromium cases                                            |
| `corepack pnpm test:preview`                                                                                                     | PASS — 33/33 Chromium cases                                            |
| `corepack pnpm audit --prod --audit-level high`                                                                                  | PASS — no known vulnerabilities                                        |
| `git diff --check 79e9dde6a8ff2b1f6bb850b2f94135d355f38a2f`                                                                      | PASS                                                                   |
| Base-to-tree package-manifest/lockfile inspection                                                                                | PASS — unchanged                                                       |
| Normal/demo/preview JavaScript and source-map scan                                                                               | PASS — 18 files / zero marker matches                                  |
| U+0000/U+001F/U+007E/U+007F/U+0080/U+0085/U+009F/U+00A0/U+00A1/U+1F680 four-path probe, normalization, error and checksum checks | PASS — 40/40 path results plus all invariants                          |
| Frozen SHA-256 verification after validation                                                                                     | PASS — 3/3 exact matches                                               |

## Scope and gate outcome

This review accepts the exact synthetic contract hardening candidate. It does not accept or authorize a Firebase exporter, real-data inspection, backup, aggregate validation, file reader, CLI, API, auth adapter, database identity column, dry run, migration, write or rollback rehearsal. Those remain separate gated tasks requiring explicit data-scope authority.

The mandatory independent final-validation gate passes at **99/100 with no critical blocker**. The exact reviewed candidate may proceed to authorized exact-head CI, expected-base merge and the existing Git-linked Vercel delivery workflow.
