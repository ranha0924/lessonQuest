# F02 persistent schema independent final review — Attempt 1

2026-09-09. **79/100 FAIL. A critical privilege-isolation blocker remains. Do not accept, merge, deploy or remotely provision this candidate.** Preserve this review; remediation requires a reviewed plan, new tests and a different independent final reviewer.

## Scope and independence

Reviewer: `/root/f02_persistent_schema_final`, assigned under AGENTS.md and not involved in implementation. Applied `engineering:code-review`. Read PROJECT_CANON, the memory final-review rubric, the approved persistent-schema plan and96/97-point plan reviews, verification draft and storage setup runbook. Inspected the actual tracked diff from base4a0e414 and every new production/test/script file, including the immutable migration snapshot. All ten implementation fingerprints in `.verification/f02-provisioning-manifest.log` matched at review time. No implementation edits, external connection, credential inspection, real/student data or deployment occurred.

## Findings

### P1 — Repeat migration certifies newly public lesson access

`packages/db/src/provisioning.ts:65`–113 checks only the designated runtime role's effective privilege booleans. The repeat branch at129–133 therefore accepts additional PUBLIC grants whenever the runtime already has those privileges. On an owned disposable PostgreSQL cluster, after a healthy migration, the reviewer executed:

```sql
GRANT USAGE ON SCHEMA lessonquest TO PUBLIC;
GRANT SELECT ON lessonquest.lesson_inputs TO PUBLIC;
```

An unrelated ordinary role then had both schema USAGE and table SELECT, while `migrateLessonQuest(db, 'lq_runtime')` still returned `unchanged`. Such a role can read lessons across organizations without the application authorization boundary. This contradicts the approved no-public-grants and fail-closed isolation requirements. Initial REVOKE statements are correct but do not protect repeat validation from grant drift. Validate actual ACL recipients as well as effective privileges, including PUBLIC and column ACLs, and refuse unexpected state without repair. Preserve a durable negative test with a separate unrelated role.

### P2 — Grant delegation is accepted as the same narrow runtime privilege

At `packages/db/src/provisioning.ts:94`–104, the ordinary privilege checks do not inspect grant options. Independently applying `GRANT UPDATE ON lessonquest.lesson_inputs TO lq_runtime WITH GRANT OPTION` still produced an accepted repeat migration. The app role can now delegate that write privilege to other database roles. This is broader authority than the reviewed grant set and is not represented in the setup document. Reject grant options on the schema, relations and columns; include this in the privilege-isolation remediation.

### P2 — Bootstrap repetition accepts expanded identity/private-space state

`packages/db/src/provisioning.ts:189`–226 counts only mappings matching the supplied project/UID and memberships belonging to the teacher. It does not count all identity mappings for the internal user or all members of the purported private organization. Independent probes added either a second project's identity mapping to the same internal user, or another teacher membership in that organization. Both repetitions returned `unchanged`, despite the plan/runbook promising refusal of expanded mappings and exact private registration. The function does not itself add these privileges, but falsely certifies inconsistent operator setup. Require exactly the intended identity and private membership population, or explicitly revise the approved contract before implementation; retain negative cases for each population change.

Bootstrap currently checks owner/version but does not revalidate runtime role/grants. The remediation should retain the selected runtime identity in reviewed migration metadata and revalidate the same isolation boundary before bootstrap can certify setup, as proposed by the implementing agent. This is a requested remediation design, not a claim that the current ledger already records a role.

## Independent verification

- `pnpm exec vitest run tests/provisioning-cli.test.ts packages/db/test/lesson-input-repository.test.ts`:23/23 PASS, exit0; `.verification/f02-provisioning-independent-focused.log`.
- `node scripts/test-postgres.js`:54/54 PASS (18 provisioning and36 adapter cases), exit0; `.verification/f02-provisioning-independent-postgres.log`. This run used its own local disposable cluster and performed no package rebuild.
- `/tmp/lessonquest-provisioning-independent-probes.mjs` runs six additional checks against a separate owned disposable cluster. Four expected-refusal assertions fail: PUBLIC access, runtime grant option, expanded organization membership and second project mapping. Column-only authority UPDATE and an extra schema object are correctly refused. The first diagnostic runner logged failures but exited0; it is not a passing test result. The subsequent corrected runner propagates failure through exit1; output is preserved in `.verification/f02-provisioning-independent-probes-red.log`. No URLs, passwords or UID values are logged.
- Inspected implementer full-check evidence:549/549 tests across50 files plus lint, formatting, type checks and all builds, `.verification/f02-provisioning-check.log`; PostgreSQL54/54 in `.verification/f02-provisioning-postgres-final.log`; production audit clean in `.verification/f02-provisioning-audit.log`.
- The independent hash check used Python SHA-256 and matched all ten frozen files. A first `shasum` attempt failed because the host Perl locale could not initialize, so that command is not hash evidence.
- Browser-export/artifact containment and the final integration/E2E/preview matrix were not finalized for this failed candidate. Their pending status cannot override the reproduced blocker. A future passing attempt must collect fresh completed evidence after remediation. Native Linux harness CI remains a separate release requirement.

The restricted role successfully saves, reloads and updates F01 across pools while authority/ledger/audit-history/schema mutations are denied in the existing tests. Both deterministic authority changes during advisory serialization and lesson-row waits pass independently. The immutable snapshot hash, unknown-schema refusal, object-inventory drift and transaction rollback behavior also pass. These working boundaries do not compensate for a gate that accepts publicly readable lesson tables.

## Score

| Final rubric category                      |           Score | Evidence                                                                                                                                                                           |
| ------------------------------------------ | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           22/25 | Dedicated schema, explicit teacher-only bootstrap and no startup DDL are delivered; repeated setup does not satisfy exact ACL/private-registration promises.                       |
| Correctness and code quality               |           17/20 | Atomic operations, safe failure and current-authority waits work; several negative-state checks are incomplete.                                                                    |
| Security, privacy and tenant isolation     |           10/20 | Initial grants and runtime restrictions work, but repeat validation accepts cross-role lesson exposure and grant delegation. Critical blocker.                                     |
| Test and verification evidence             |           17/20 | Independent23 and54 cases pass with strong rollback/concurrency coverage; four added adversarial assertions expose missing durable negatives, and final browser matrix is pending. |
| Operability, recoverability and provenance |           13/15 | Pinned original schema provenance, explicit target CLI and non-destructive refusal are documented; repeated/bootstrap readiness certification needs correction.                    |
| **Total**                                  | **79/100 FAIL** | **Fresh remediation and independent review required.**                                                                                                                             |

This decision covers only the bounded local persistent-schema unit. It does not claim live Google login, server storage, AI generation, F02 completion or deployment readiness.
