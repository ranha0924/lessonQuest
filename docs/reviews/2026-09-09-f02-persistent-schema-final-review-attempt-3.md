# F02 persistent schema independent final review — Attempt 3

2026-09-09. **97/100 PASS. No critical blocker or required correction remains in this bounded local implementation.** This verdict supersedes the failed candidate decisions for acceptance of the corrected code; preserve both failed reports and their evidence. It does not establish live Google login, remote persistent storage, F02 completion or deployment readiness.

## Scope and independence

Reviewer: `/root/f02_persistent_schema_final_v3`, newly assigned under AGENTS.md and not involved in implementation. Applied `engineering:code-review` and `superpowers:verification-before-completion`. Read AGENTS.md, PROJECT_CANON, the memory final-review rubric, the original persistent-schema plan and its authority refinement, both remediation plans and their passing plan reviews, both failed final reviews, the setup runbook and implementation verification record.

Inspected the full tracked diff against `4a0e414` and every new production/test/script file, including the complete immutable migration snapshot. Python SHA-256 independently matched all ten files in `.verification/f02-provisioning-final-manifest.log` before execution and again after the final builds. An independent extraction comparison proved that `initialSchemaSql` exactly matches `schemaSql` from the base commit and its pinned SHA-256 `fe33dd42c4e38abafe3cb92acd09f56a9b7e9d336105eac1effa8e8bbddb1125`. The package change adds a Node-only export; no dependency version or lockfile change is present.

No implementation edits, external service/database connections, credential inspection, real/student data access or deployment occurred. Independent database tests used separate owned disposable PostgreSQL clusters. This review document, ignored verification logs and temporary probe scripts are the reviewer's only additions.

## Findings and corrected boundaries

No actionable blocker was found in the reviewed scope. The findings from Attempts 1 and 2 are corrected in the actual code and independently reproduced refusal tests:

- `packages/db/src/provisioning.ts:59` validates a standalone restricted login role, including REPLICATION and administrative flags, outgoing membership and incoming membership. Incoming membership is permitted only for the already trusted current owner. The check is repeated by the shared grant-validation boundary at line 107, including after fresh grants at line 197. All three prior incoming-delegation bypasses now refuse: fresh migration, repeat migration and bootstrap. INHERIT-disabled SET/ADMIN grants also refuse in the durable PostgreSQL suite.
- The owner exception is functional without superuser privileges. A new independent probe connected as an ordinary CREATEROLE owner, created the runtime role, verified PostgreSQL's automatic owner-only membership, and successfully ran fresh migration, repeat migration and idempotent teacher bootstrap. An additional injected delegation immediately after the ledger insert was caught by the final role check; both the new schema and the same-transaction membership grant rolled back.
- `packages/db/src/provisioning.ts:74` inspects actual schema, relation, column and function ACL entries, object owners, grantors, recipients, privilege names and grantability. The effective privilege matrix at line 107 remains complementary. PUBLIC read exposure, table/column/schema grant options, column-only authority writes, unrelated function grants and owner default grants all refuse. The unrelated role's effective lesson access is explicitly established in the prior-exposure probes before asserting refusal, so these tests do not confuse an ineffective grant with a closed certification path.
- The immutable ledger binds the runtime role and known version/checksum/inventory at lines 33 and 183. Missing/extra objects, ownership drift, a mismatched runtime role and an additional ledger version refuse without automatic repair. Fresh initialization/grant failures roll back atomically. The inventory is intentionally a name/signature check, as the plan and runbook state; it is not semantic attestation against the trusted owner rewriting object bodies and ledger contents.
- `packages/db/src/provisioning.ts:205` remains an operator-only API. Bootstrap validates the owner, version and runtime boundary before registration. Exact active TEACHER identity, owned private organization, single identity mapping and membership population checks at lines 244–280 refuse both previously accepted expanded mappings. Concurrent identical registration returns the same internal IDs, and failed partial registration leaves no user/identity rows. Runtime credentials cannot bootstrap authority.
- `packages/db/src/lesson-input-repository.ts:160` uses transaction advisory serialization to keep authorization tables SELECT-only. The update locks only the lesson row and performs a fresh authorized read after the wait at line 525. Independent real PostgreSQL tests passed duplicate mutation serialization, membership downgrade during the advisory wait and membership disablement during a lesson-row wait, with no unauthorized content/revision change. Restricted pools still save, reload and update F01 across connections while authority, audit history, ledger, deletion and schema mutations are denied.
- `scripts/provision-lessonquest.js:8` allows only the two explicit operator commands. It requires a separate migration URL and exact expected host/database; bootstrap additionally requires the dedicated project and explicit UID/name. The actual adapter validates URL/TLS settings before pool use. Twelve independent CLI probes verified pre-adapter refusal, no application-URL fallback, command routing, generic post-construction errors and closure in `finally`. Those command-routing probes used a transport double plus the real `postgresPoolConfig`; successful real database behavior is established separately by the disposable PostgreSQL tests.

A repository call-site search found provisioning invoked only by the explicit script and its tests. No API/build startup or browser runtime imports the provisioning functions. AI default-deny behavior is unchanged by this diff.

## Independent verification

All commands below completed with exit 0:

| Check                                                                                | Result                                                                                                                     | Evidence                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `node scripts/test-postgres.js`                                                      | 68/68 PASS: 32 provisioning and 36 existing adapter cases                                                                  | `.verification/f02-provisioning-attempt3-independent-postgres.log`                         |
| Focused CLI and F01 repository Vitest run                                            | 23/23 PASS                                                                                                                 | `.verification/f02-provisioning-attempt3-independent-focused.log`                          |
| Preserved nine-probe Attempt 2 runner, executed unchanged against final emitted code | 9/9 PASS, including all earlier PUBLIC/grant-option/private-mapping/incoming-membership findings                           | `.verification/f02-provisioning-attempt3-independent-reprobes.log`                         |
| New ordinary-owner, catalog, ledger and final-boundary PostgreSQL probes             | 6/6 PASS                                                                                                                   | `.verification/f02-provisioning-attempt3-independent-supplemental.log`                     |
| New CLI pre-connection/routing/error/cleanup probes                                  | 12/12 PASS                                                                                                                 | `.verification/f02-provisioning-attempt3-independent-cli-probes.log`                       |
| Fresh normal, normal-check and preview JS/map/HTML scan                              | 21/21 artifacts free of provisioning, schema-ledger, Admin SDK, PG driver and credential markers; artifact hashes recorded | `.verification/f02-provisioning-attempt3-independent-artifacts.log`                        |
| Frozen implementation hashes, base-snapshot comparison and `git diff --check`        | PASS                                                                                                                       | Hash comparison repeated after final builds; artifact log records the final manifest check |

The supplemental scripts remain in `/tmp/lessonquest-provisioning-attempt3-supplemental-probes.mjs` and `/tmp/lessonquest-provisioning-attempt3-cli-probes.mjs`; the latter uses `/tmp/lessonquest-provisioning-attempt3-cli-loader.mjs`. The preserved prior runner is `/tmp/lessonquest-provisioning-attempt2-independent-probes.mjs`. The reviewer did not rebuild packages during the implementer's sequential matrix.

## Completed implementer evidence inspected

The final `.verification/f02-provisioning-final-status.log` records all six commands at exit 0. Read their completed logs before scoring:

- `final-check.log`: 549/549 tests in 50 files, lint, formatting, type checks and all workspace/normal Vite builds.
- `final-postgres.log`: 68/68 tests in two files.
- `final-integration.log`: 80/80 tests in nine files.
- `final-e2e.log`: 80/80 tests in twelve files.
- `final-preview.log`: 42/42 Playwright cases across desktop, tablet and mobile, including F01 save/reopen/update and normal-build containment. The unchanged preview PGlite dependency emits existing eval/chunk-size warnings; the command succeeds.
- `final-audit.log`: no known production dependency vulnerabilities.

All these filenames use the prefix `.verification/f02-provisioning-`. The actual Vite browser-resolution probe in `final-export.log` rejects `@lessonquest/db/provisioning` under browser/import conditions, and `final-bundle.log` records the implementer's fresh 21-artifact scan. The reviewer independently repeated the artifact scan, with file hashes, after those outputs were emitted.

Test-first evidence is preserved rather than overwritten. Inspected the second-remediation RED log showing five intended resolved-instead-of-rejected failures with 27 passing cases, followed by GREEN at 68/68. The prior failure reports, remediation RED/GREEN records and row-wait regression evidence remain attributable in the implementation verification record. Ordinary passing tests from failed candidates are not used as the final acceptance evidence.

## Score and acceptance boundary

| Final rubric category                      |           Score | Evidence                                                                                                                                                                                                                 |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance  |           25/25 | Dedicated versioned schema, narrow runtime access, explicit teacher-only bootstrap, target containment and all reviewed remediations are delivered within the local scope.                                               |
| Correctness and code quality               |           19/20 | Atomic migration/bootstrap, idempotency, current authority after both waits, ledger validation and catalog refusal paths pass. The explicit privilege matrix must continue to be maintained with future schema versions. |
| Security, privacy and tenant isolation     |           20/20 | Previous cross-principal access certifications now refuse; role graph, exact ACLs, owner/grant options and exact private registration are exercised independently without real data or secrets.                          |
| Test and verification evidence             |           19/20 | Fresh full matrix plus independent PostgreSQL, focused, adversarial, CLI and artifact evidence pass. Native Linux CI remains a release check beyond this local run.                                                      |
| Operability, recoverability and provenance |           14/15 | Separate operator command, safe failures, immutable attributable snapshot and transactional no-repair containment are documented. Remote target/isolation/checkpoint validation is explicitly outstanding.               |
| **Total**                                  | **97/100 PASS** | **Strictly greater than 85; no critical blocker in the bounded local implementation.**                                                                                                                                   |

This passes the independent final-validation gate for the local schema/bootstrap prerequisite. It is not permission to bypass required merged-result/CI checks or to run remote migration without the documented target, preview-isolation and recovery prerequisites. Browser Google login/session/runtime wiring and actual server storage delivery remain subsequent work; AI stays blocked.
