# F02 persistent schema independent final review — Attempt 2

2026-09-09. **84/100 FAIL. A critical role-membership isolation blocker remains. Do not accept, merge, deploy or remotely provision this candidate.** Preserve Attempt 1 and this report. A reviewed correction, new regression evidence and a different independent reviewer are required.

## Scope and independence

Reviewer: `/root/f02_persistent_schema_final_v2`, newly assigned under AGENTS.md and not involved in implementation. Applied `engineering:code-review` and `superpowers:verification-before-completion`. Read PROJECT_CANON, the memory rubric, the original persistent-schema plan and reviews, the remediation plan and99-point review, failed Attempt 1, implementation verification and storage setup runbook. Inspected the complete tracked diff against4a0e414 and the new production/test/script files. All ten fingerprints in `.verification/f02-provisioning-remediated-manifest.log` matched before independent execution. The initial SQL snapshot exactly matches `schemaSql` from base4a0e414 and its pinned SHA-256.

No implementation edits, external databases, credential inspection, real/student data or deployment occurred. Independent PostgreSQL checks used separate owned disposable clusters. Only this review document was added to the repository by the reviewer.

## P1 — Incoming runtime-role membership bypasses the isolation gate

`packages/db/src/provisioning.ts:63`–66 rejects administrative flags and roles that the runtime role itself belongs to. Its `pg_auth_members` predicate checks `member = r.oid`, but does not check other principals whose `roleid = r.oid`. The exact object ACL checks at72–102 then accept privileges granted only to the designated runtime role even when another principal inherits those privileges through role membership.

The independent probe performed the following on a healthy synthetic disposable database:

```sql
GRANT lq_runtime TO lq_unrelated;
SELECT has_schema_privilege('lq_unrelated', 'lessonquest', 'USAGE')
   AND has_table_privilege('lq_unrelated', 'lessonquest.lesson_inputs', 'SELECT');
```

The privilege expression returned true. Despite that unrelated principal gaining lesson-read authority outside application tenant authorization, all three required-refusal probes failed:

1. Repeat `migrateLessonQuest(db, 'lq_runtime')` returned successfully.
2. `bootstrapTeacher` accepted a new explicit teacher while the exposure existed.
3. A fresh migration also succeeded when the runtime membership had been granted before schema creation.

This is the same material cross-principal access risk that the no-public/third-party-grants requirement is intended to prevent. It does not require altering the schema snapshot or ledger. The operator command must refuse an unsafe role graph as well as unsafe object ACLs. Check incoming memberships, including membership variants that permit inheritance, role switching or delegation. Any exception for the already trusted schema owner must be explicit, narrow and tested; a non-superuser role creator may have an owner-only administrative membership. Do not revoke or repair unrelated roles automatically.

The independent nine-probe runner is `/tmp/lessonquest-provisioning-attempt2-independent-probes.mjs`; its output is `.verification/f02-provisioning-attempt2-independent-probes.log`, **6 PASS / 3 FAIL, exit1**. The three failures are expected-refusal assertions resolving successfully, not harness setup failures. No password, URL or UID value is printed.

## Remediation that independently passed

The six existing adversarial checks from Attempt 1 now pass: unexpected PUBLIC access, runtime table grant options, column-only authority escalation, an extra schema object, an expanded private organization and a second project identity mapping. Actual catalog ACL validation covers owners, grantors, recipients, privilege names and grantability. The ledger binds the designated runtime role, and bootstrap validates that role and the object grant boundary before registration. Exact identity/member cardinality now rejects the reproduced expanded setup without repair.

The independent62-test PostgreSQL suite additionally confirms narrow app-role save/reload/update across pools, forbidden authority/audit-history/ledger/schema changes, transactional rollback, unsafe outgoing role membership, column grant options, owner-default grants, owner drift, MAINTAIN privilege, mismatched ledger role, duplicate mutations and current authority after advisory/lesson-row waits. These working controls do not compensate for the incoming-role exposure.

## Verification evidence

- `node scripts/test-postgres.js`: **62/62 PASS**, exit0, `.verification/f02-provisioning-attempt2-independent-postgres.log`. No overlapping package build or service database was used.
- `pnpm exec vitest run tests/provisioning-cli.test.ts packages/db/test/lesson-input-repository.test.ts`: **23/23 PASS**, exit0, `.verification/f02-provisioning-attempt2-independent-focused.log`.
- Independent adversarial runner: **6 PASS / 3 FAIL**, exit1, as described above.
- Python SHA-256 check matched all ten remediated frozen files. A separate corrected extraction check proved snapshot equality to the base source and pinned checksum. An earlier extraction attempt assumed an exported declaration and failed before comparison; it is not evidence.
- Inspected implementer remediation evidence:7 intended RED failures with18 passes, followed by25/25 focused GREEN. The completed full-check log shows549 tests across50 files plus lint, formatting, type checks and builds (`.verification/f02-provisioning-remediated-check.log`).
- `git diff --check` passed independently. The final remediation integration/E2E/preview/audit/browser-artifact matrix was not finalized for this failing review; it cannot override the reproduced blocker. A future passing attempt needs fresh completed evidence. Linux native harness CI remains a separate release requirement.

The parent requested this failed verdict immediately after the reproduced blocker, before the rest of the candidate matrix completed. No passing result from the first candidate or an incomplete remediation matrix is used as acceptance evidence.

## Score

| Final rubric category                      |           Score | Evidence                                                                                                                                                               |
| ------------------------------------------ | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           24/25 | The original four failures are corrected; standalone runtime-role isolation remains incomplete.                                                                        |
| Correctness and code quality               |           18/20 | Transactional migration/bootstrap, immutable snapshot and current-authority waits work; role graph validation checks only one direction.                               |
| Security, privacy and tenant isolation     |           11/20 | Actual ACL/default/owner/grant-option checks pass, but an unrelated member inherits cross-tenant lesson authority while setup is certified. Critical blocker.          |
| Test and verification evidence             |           18/20 | Independent62 and23 cases pass, with preserved RED/GREEN; the new incoming-membership probes expose three missing durable refusals and the final matrix is incomplete. |
| Operability, recoverability and provenance |           13/15 | Safe commands, immutable source attribution and no-repair containment are documented; runtime setup certification still admits an unsafe role graph.                   |
| **Total**                                  | **84/100 FAIL** | **Do not accept; obtain a fresh independent review after correction.**                                                                                                 |

This decision covers only the local persistent-schema prerequisite. It does not claim real Google login, live server storage, AI generation, F02 completion or deployment readiness.
