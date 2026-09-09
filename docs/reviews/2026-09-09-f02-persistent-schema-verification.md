# F02 persistent schema implementation verification

Base4a0e414;2026-09-09. The local candidate provides a dedicated versioned PostgreSQL schema, separate runtime grants, explicit operator-only first-teacher registration and a guarded command. It does not execute remote provisioning or supply the remaining browser/server login session wiring. AI default deny is unchanged. Ten implementation/test/script/config files are frozen in `.verification/f02-provisioning-manifest.log`.

## Test-first evidence

- The first test CLI invocation used unsupported Vitest `--include` and failed before collection; it is not behavior evidence (`f02-provisioning-red.log`). The corrected direct test import failed because provisioning was absent (`f02-provisioning-red-import.log`).
- After only interface/test-harness scaffolding, the owned real PostgreSQL run produced10/10 intended failures (`f02-provisioning-red-behavior.log`, exit1). No service URL was accessed.
- Initial implementation found PostgreSQL's ambiguous concat of the internal relkind type; a test-only proxy recorded the synthetic statement and SQLSTATE42725, without parameters/credentials (`f02-provisioning-debug.log`). Explicit text cast fixed it; the proxy was removed.
- Restricted-role save initially failed on the membership lock; the approved advisory-lock change enabled create. Restricted-role update then exposed the joined FOR UPDATE requirement. Narrowing it to the lesson row reproduced a real stale-authority failure:10 pass/1 fail when membership was revoked during a row wait (`f02-provisioning-rowwait-red.log`). A fresh authorized read after acquiring that row fixes the reproduced update leak.
- CLI absence produced5 failing safe-error assertions (`f02-provisioning-cli-red.log`); the explicit command rejects missing/mismatched configuration before connecting and returns only a generic failure.
- Initial real PostgreSQL17 new+36 existing cases passed (`f02-provisioning-postgres.log`), focused CLI/F01 HTTP/PGlite33 passed (`f02-provisioning-focused.log`). Two routine lint issues (control-regex representation and an explicit Node URL import) were corrected before the final full check. A further deterministic advisory-wait role-downgrade regression was then added.

## Attempt 1 verification and failed independent gate

The candidate passed full `pnpm check`549 tests/50 files and all checks/builds,54 PostgreSQL cases, integration80, E2E80 and preview42. The production audit was clean. These ordinary passing checks did not establish acceptance: the independent reviewer recorded **79/100 FAIL** in `2026-09-09-f02-persistent-schema-final-review.md`. It reproduced PUBLIC lesson exposure and runtime grant delegation escaping the repeat gate, plus expanded identity/private-space membership passing bootstrap repetition. Its own focused23/PostgreSQL54 passed, while four adversarial refusals failed. Original hashes and evidence remain preserved.

## Remediation evidence

The fresh remediation plan review passed99/100 before correction. Seven additional real PostgreSQL scenarios failed against the original candidate (18 pass/7 fail, `.verification/f02-provisioning-remediation-red.log`). The correction validates actual ACL entries, grantor/owner/grantee, grantability and exact allowed privilege names, including column grants and owner defaults, in addition to effective runtime checks. The immutable ledger binds runtime_role, and bootstrap checks the same ACL/role boundary plus exact identity/member cardinality.

During correction, empty PostgreSQL ACL arrays returned SQLSTATE22023 (`ACL arrays must be one-dimensional`); a synthetic test-only proxy identified the statement, and a local PGlite probe confirmed the cause. Empty ACLs are now passed to aclexplode as NULL; the debug proxy was removed. Corrected focused PostgreSQL25/25 passed (`f02-provisioning-remediation-green2.log`). A further MAINTAIN privilege/wrong runtime role regression was added before final verification. New final checks and a different independent review remain pending; this implementation is still unaccepted.

## Tested boundaries and limitations

Tests exercise snapshot hash, transactional migration/grant rollback, unknown/drifted/missing schema, unsafe or inherited runtime role, effective privilege drift, repeat migration, concurrent explicit teacher bootstrap, disabled/inconsistent/invalid registration, incomplete bootstrap rollback, runtime bootstrap refusal, save/reload/update across separate restricted pools, forbidden authority/audit/ledger/schema/deletion operations, duplicate create under delayed insert, and current authority after serialization and lesson-row waits. Public schema inventory remains unchanged. All identities, lessons, roles and credentials are synthetic and owned by the disposable harness.

The object inventory checks names/signatures; it is not semantic attestation against a malicious schema owner. Existing incompatible state is refused and never repaired/dropped by the production code. Future remote use requires verified dedicated target, credentials, preview isolation and a recovery checkpoint as described in `docs/F02_PERSISTENT_STORAGE_SETUP.md`. No real/student data, external OpenAI request, payment or deployment occurred.

## Attempt 2 and second remediation

Attempt2 full check passed549 tests/50 files. Its independent reviewer passed62 PostgreSQL and23 focused tests, verified the six earlier probes, then recorded **84/100 FAIL** after three fresh/repeat/bootstrap operations accepted incoming runtime-role delegation. Preserve `2026-09-09-f02-persistent-schema-final-review-attempt-2.md` and its9-probe log (6 pass/3 fail). No candidate was accepted.

The second remediation plan passed99/100 before editing production. Five new tests failed against Attempt2 (27 pass/5 fail, `.verification/f02-provisioning-remediation2-red.log`), covering incoming INHERIT/SET/ADMIN role delegation and REPLICATION. The shared final grant boundary now revalidates both role-graph directions and administrative flags. Only an incoming membership held by the already trusted current schema owner is permitted, with a positive regression. Corrected PostgreSQL68/68 passed (`.verification/f02-provisioning-remediation2-green.log`). Final full/matrix/artifact checks and a third fresh independent review remain required.

## Final Attempt 3 implementer evidence

All six final commands completed exit0 in `.verification/f02-provisioning-final-status.log`: full check549 tests/50 files with lint/format/root and web typechecks/all builds; PostgreSQL68; integration80; E2E80; preview42; production auditclean. The final10-file source/test/script/config manifest is `.verification/f02-provisioning-final-manifest.log`. Actual Vite browser resolution rejects the Node-only provisioning export (`-final-export.log`), and21 freshly emitted JS/map/HTML assets across normal, normal-check and preview builds contain no provisioning/schema-ledger/Admin/PG-driver/server-secret markers (`-final-bundle.log`). The initial/failing manifests and reports remain preserved. Attempt3 independent validation passed97/100 with no critical blocker in `2026-09-09-f02-persistent-schema-final-review-attempt-3.md`. It independently passed68 PostgreSQL,23 focused,9 prior reprobes,6 supplemental PostgreSQL and12 CLI probes plus21 emitted-artifact checks, and matched all10 hashes. Local acceptance is authorized; remote provisioning and delivery remain separately outstanding.
