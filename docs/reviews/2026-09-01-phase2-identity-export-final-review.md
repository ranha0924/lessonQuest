# Phase 2 identity export readiness — independent final validation

Date: 2026-09-01  
Reviewer: fresh independent non-implementing agent `phase2_identity_export_final_validation_1`  
Base: `0b87f0ab95ea232dfd8971800517c8826ffc214f`  
Branch: `codex/phase2-identity-export`  
Candidate: committed branch through `ece0e39ca46bb9ecdaa5f7e492c82f4c8dbaa301` plus the inspected uncommitted candidate files, frozen by `/tmp/lq-phase2-identity-export-implementation-hashes.json`

## Decision

**PASS — 94/100. No critical blocker remains.**

The candidate satisfies the approved synthetic, side-effect-free identity export readiness scope. It defines strict versioned export, explicit account and organization mapping, deterministic canonical SHA-256 checksums, complete redacted blocker reporting and fail-closed handling for source checksum/count ambiguity, duplicate/collision/missing mappings and `MASTER`. No source role or legacy organization key grants LessonQuest authority. The package has no filesystem, Firebase, network, database, environment, auth, API, web or browser operation, and no operating runtime imports it.

One nonblocking contract defect was reproduced independently: the opaque-identifier validator rejects C0 controls and DEL but accepts the C1 control range U+0080–U+009F. This falls short of the approved “no control characters” rule. The current unit performs no I/O, authorization or migration, so the defect does not create a present tenant, privilege or student-data bypass. It should be corrected with durable tests before a real exporter or real-data transition consumes this contract.

## Independence and candidate integrity

- I did not implement this change and did not modify any implementation, test, script, package or lockfile. My only repository change is this report.
- I read `AGENTS.md`, `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md`, the approved design and plan, the **98/100** plan review, the project rubric and the implementer verification record.
- I inspected the complete diff from the stated base, including the untracked verification record and the uncommitted contract-subpath containment changes. The candidate contains 19 base-to-tree files: contracts/package code, the new pure package and tests, local build/lock wiring, design/plan/review and status/provenance documentation.
- The five design/plan commits precede implementation. The reviewed containment revision preserves the approved scope and removes the transition schema from the existing contracts root barrel after the emitted-asset RED finding.
- Before validation, all **13/13** implementation/test/script SHA-256 values exactly matched `/tmp/lq-phase2-identity-export-implementation-hashes.json`. The same **13/13** values matched after all checks and after writing this report.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      23/25 | Versioned strict inputs/reports, explicit one-to-one mappings, all 13 findings, bound checksums, redaction, synthetic-only scope and deferred migration/I/O match the approved plan. `packages/contracts/src/data-transition.ts:18-33` does not reject C1 controls, so exact identifier handling is not fully conformant.                                                                  |
| Correctness and code quality                |      18/20 | Canonical object and domain-array ordering is locale independent; multi-pass indexing blocks ambiguous source records; global source mismatch zeroes readiness; final report invariants are parsed before return. The C1 gap permits operationally unsafe opaque values despite the schema message promising all control characters are rejected.                                          |
| Security, privacy, and tenant isolation     |      19/20 | Unknown PII/credential/authority fields fail strict parsing; errors are constant and reports contain fingerprints rather than source identifiers; `MASTER` blocks without `ORG_ADMIN`/`SUPER_ADMIN`; organization keys never authorize; no runtime/data access exists. C1 controls could create ambiguous identifiers in a later exporter, but no present authority or data bypass exists. |
| Test and verification evidence              |      19/20 | Fresh focused/full/integration/E2E/browser suites passed at all expected counts; audit, diff, asset byte scan, subpath and 13-code probes passed. Checked-in tests cover C0/DEL behavior but omit the independently failing C1 range, so the otherwise strong negative suite does not fully enforce the written identifier contract.                                                       |
| Operability, recoverability, and provenance |      15/15 | The package is private, pure and removable; lockfile wiring is local-only; no stored/external state or schema exists; invalid inputs fail without partial application; future exporter, backup, dry-run, rollback and real-data work are explicitly deferred. Documentation records original LessonQuest provenance and no WordQuest code/data copy.                                       |
| **Total**                                   | **94/100** | **Strictly greater than 85 with no critical blocker; the independent final-validation gate passes.**                                                                                                                                                                                                                                                                                       |

## Finding

### F1 — Moderate, nonblocking: C1 control characters pass the exact identifier schema

`packages/contracts/src/data-transition.ts:18-23` treats only code points U+0000–U+001F and U+007F as controls. Unicode C1 controls U+0080–U+009F are also control characters, and U+0085 is additionally Unicode whitespace, but all three independent samples U+0080, U+0085 and U+009F passed `externalIdentityKeySchema`.

The probe result was:

```text
C1_CONTROL_ACCEPTANCE [[128,true],[133,true],[159,true]]
```

This contradicts the design and schema error text at lines 30–33. Such values remain byte-preserved and checksum-bound, so the current pure validator does not merge identities or grant authority. Their presence can still confuse later transport, display, audit or operator tooling. Before connecting a real exporter, reject the complete intended control set and preserve regression cases for at least U+0080, U+0085 and U+009F. This review does not implement that fix.

## Semantic and security inspection

### Strict contracts and safe failures

- `WordQuestIdentityExportV1`, `IdentityMappingPlanV1`, findings and reports use strict objects, fixed format/version/source/role/status discriminators, safe integer counts, UUID/hash formats, 100,000-record input caps and bounded finding indexes.
- Injected display name, email, token, organization label and target/platform role fields are rejected. Leading/trailing ECMAScript whitespace, C0 controls, DEL, empty and oversized identifiers are rejected without trimming.
- Parse failures become only `DataTransitionValidationError: Invalid data-transition input`, with no input dump or attached cause. An independent injected `token: "probe-secret"` and `targetRole: "SUPER_ADMIN"` probe confirmed neither value appeared in the error.
- The report schema rejects a ready flag inconsistent with findings, nonmonotonic source/mapped/ready counts and proposed role totals above ready accounts.

### Canonicalization and checksums

- `packages/data-transition/src/canonical-json.ts` accepts parsed JSON values, orders plain-object keys and compares strings with ECMAScript UTF-16 code-unit order. Domain canonicalizers sort complete stable account/mapping records before hashing with built-in `node:crypto`.
- The pinned source checksum is `sha256:896ac8209a16e9b983ede82aa9a83e118d463fa79f85b74d0aeb9b8403834d12`; the pinned mapping checksum is `sha256:b585df2f7e0e610e1d588a1f3a3ce3dfc8125e5098f9e473ac6b24398020b091`.
- Independent reversal of source accounts and account mappings preserved both checksums and the ready report. Independent `z-source`/`ä-source` inspection confirmed locale-independent ordering.
- All versioned metadata, counts, identifiers and mappings remain in the relevant canonical form. No normalization, inference or name/email matching occurs.

### All 13 blocker paths and fail-closed counts

An independent built-package probe produced every specified code with no missing path:

```text
ALL_CODES 13 MISSING []
```

The cases covered `SOURCE_CHECKSUM_MISMATCH`, `SOURCE_USER_COUNT_MISMATCH`, identical and conflicting source duplicates, duplicate account/organization mappings, canonical user/organization collisions, missing account/organization mappings, unused account/organization mappings and `PRIVILEGED_ROLE_REQUIRES_REVIEW`.

- Source checksum and user-count mismatches produced `ready: false`, `readyAccounts: 0` and zero proposed roles.
- Duplicate and canonical-collision cases blocked every affected source record. Unaffected records could remain individually ready while the overall report stayed `ready: false`, preserving the report’s distinction between per-account readiness and plan readiness.
- Missing mappings blocked the relevant source records. Unused mappings blocked the overall plan without inventing a source account.
- A conflicting duplicate containing a second legacy organization and `MASTER` emitted all three applicable blockers: conflict, unmapped organization and privilege review.
- `MASTER` produced `ready: false`, excluded that account from proposed student/teacher totals and emitted no `ORG_ADMIN` or `SUPER_ADMIN` value. Mapping records contain UUID pairs only, so no source role or organization key can grant authority.
- Every independently serialized semantic report omitted the raw external account and legacy organization keys and retained only indexes, SHA-256 fingerprints and permitted canonical UUIDs.

## Isolation, dependency and emitted-asset evidence

- Production source imports only `@lessonquest/contracts/data-transition`, local modules, Zod through contracts and built-in `node:crypto`. Source inspection found no `node:fs`, Firebase, HTTP/fetch, database, environment, auth, API, web, browser storage or operating-service reach.
- The new package has exactly one dependency: local `@lessonquest/contracts: workspace:*`. The lockfile diff adds only the `packages/data-transition` importer and `link:../contracts`; it changes no external package or version.
- Runtime import inspection returned `root_has_transition false` and `subpath_has_transition true`. The existing contracts root barrel stays free of transition exports.
- A raw byte scan covered all **37 files** under rebuilt `apps/web/dist`, `apps/web/dist-normal-check` and `apps/web/dist-preview`, including JavaScript and source maps. It found zero occurrences of the three format strings, `@lessonquest/data-transition`, `PRIVILEGED_ROLE_REQUIRES_REVIEW` or the pinned synthetic student identifier.
- No app, service, auth, DB, schema, migration, Vercel configuration or reference repository file changed. No Firebase, external network, persistent database, real student data, credential or paid resource was accessed.

## Fresh independent command evidence

| Command/check                                                                                                                                 | Result                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Manifest SHA-256 verification before review                                                                                                   | PASS — 13/13 exact matches                                             |
| `corepack pnpm exec vitest run packages/contracts/test/data-transition.test.ts packages/data-transition/test/identity-reconciliation.test.ts` | PASS — 2 files / 41 tests                                              |
| `corepack pnpm check`                                                                                                                         | PASS — 39 files / 423 tests; ESLint, Prettier, types and builds passed |
| `corepack pnpm test:integration`                                                                                                              | PASS — 7 files / 52 tests                                              |
| `corepack pnpm test:e2e`                                                                                                                      | PASS — 11 files / 77 tests                                             |
| `corepack pnpm test:browser`                                                                                                                  | PASS — 12/12 Chromium cases                                            |
| `corepack pnpm test:preview`                                                                                                                  | PASS — 33/33 Chromium cases                                            |
| `corepack pnpm audit --prod --audit-level high`                                                                                               | PASS — no known vulnerabilities                                        |
| `git diff --check 0b87f0ab95ea232dfd8971800517c8826ffc214f`                                                                                   | PASS                                                                   |
| Normal/demo/preview byte scan                                                                                                                 | PASS — 37 files, zero transition/fixture marker hits                   |
| Contracts root/subpath runtime import probe                                                                                                   | PASS — root absent, dedicated subpath present                          |
| Lockfile exact-added-line inspection                                                                                                          | PASS — local workspace importer only                                   |
| Independent reconciliation/adversarial probe                                                                                                  | PASS for 13/13 codes, redaction, MASTER, checksum/count, invariants    |
| C1 exact-identifier adversarial probe                                                                                                         | Finding reproduced — U+0080/U+0085/U+009F incorrectly accepted         |
| Manifest SHA-256 verification after review/report                                                                                             | PASS — 13/13 exact matches                                             |

The preview build repeated the existing PGlite direct-`eval` and large-chunk warnings. The normal and demo builds do not contain PGlite. The candidate adds neither warning nor external dependency.

## Scope and gate outcome

This review accepts a synthetic readiness validator, not a Firebase exporter, file reader, CLI, API, auth adapter, database schema, membership creator, migration, real-data dry run or write path. Future real transition work still requires a separately reviewed plan, explicit data authority, read-only export tooling, backup, user and learning aggregate checksums, dry-run evidence and rollback rehearsal.

The mandatory independent final-validation gate passes at **94/100 with no critical blocker**. The exact reviewed candidate may proceed to the authorized exact-head CI, expected-head merge and existing Git-linked Vercel delivery workflow. F1 should remain tracked and be fixed before this contract is used with a real exporter or real identity data.
