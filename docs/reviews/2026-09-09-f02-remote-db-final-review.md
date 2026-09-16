# F02 remote database/configuration — independent final review

Review started 2026-09-09 and resumed 2026-09-15. Reviewer: independent agent `f02_remote_db_final`; no implementation or external configuration changes performed by the reviewer.

**97/100 PASS — no critical blocker within this bounded database/configuration stage.** This report covers only the prepared Neon database and configuration for a later deployment. It does not certify Firebase service-account credentials, a chosen teacher UID, real Google login, save/re-login/reload, main integration, or production deployment.

## Controlling scope and inspected change

Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final-validation rubric in `memory/projects/lessonquest.md`, `docs/F02_PERSISTENT_STORAGE_SETUP.md`, the remote activation plan and its amended 97-point plan review. The existing delivery authorization covers the dedicated resources only.

Implementation baseline remains `0620a14a6c729ae5709ed3191eb65cbf553c9efd`. There is no production-code diff in this bounded activation stage; the pending repository changes are planning/progress records. The actual external mutation program is captured as three nonsecret source logs and a SHA-256 manifest:

| Source                             | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `lessonquest-neon-operator.mjs`    | `081c3770c41a06eaac71c4777d44c08346e3027ebfba8507c07c34e4591c72dd` |
| `lessonquest-vercel-db-env.py`     | `600a53e6fcc61428342e9d2631baa51fc2a0de1a97af90e0ce31607b3fe1f64e` |
| `lessonquest-create-checkpoint.py` | `a2d7aa39c4ef5347698b4c85646ddf57c01f2b7b10f02fd34cf144ef0966417b` |

The three captured sources match the manifest; the September 9 temporary executable copies also matched. Both the preserved copies and restored executable copies were rechecked on September 15. Inspected the accepted migration, exact ACL/role/inventory checks, runtime readiness, server configuration, and unconditional AI denial actually used by these operators.

## Independent checks completed

- Python parse checks and Node syntax check passed for the operator scripts.
- Thirteen independent intercepted CLI/file-operation checks passed without any network call or credential read: exact eight-variable removal; refusal on changed scope, missing restricted configuration, changed OpenAI scope, failed CI or missing grant proof; unrelated metadata change detection; checkpoint creation without compute/secrets; refusal on mismatched CI, missing hosted proof, existing checkpoint or exhausted branch allocation; rejection of a checkpoint with compute.
- The existing provisioning CLI's five refusal tests passed on September 9 and again on September 15, using the already built packages. No shared build was run.
- On September 9, after explicit readiness authorization, independently ran the approved operator's `runtime-smoke` against the dedicated actual target. Exit status was zero. Restricted readiness passed; the owner credential was rejected as a runtime identity. Authority UPDATE, identity UPDATE, lesson DELETE, audit UPDATE, migration-ledger UPDATE and schema CREATE each failed with PostgreSQL permission-denied code 42501 inside a rolled-back transaction. Aggregate users, organizations and lesson-input counts were all zero. No row contents or credential values were exposed.
- Corrected-head CI run `34322965044` has completed/success for the exact baseline SHA and every step. Its preserved full output confirms 577 tests in 60 files, PostgreSQL 71, demo browser 12, service preview 42 and synthetic live browser 4; lint, formatting, type checks, builds and production audit passed. This is September 9 execution evidence, not a claim that CI was rerun on September 15.
- Hosted matching Preview `dpl_F6n4Si4PDvqKaw6UDzCNpPYL3Bea` returned session 503 `SERVER_NOT_READY`, unknown/query routes 404 `RESOURCE_NOT_FOUND`, and `cache-control: no-store`. An intentionally unconfigured Preview passing these checks is not evidence of real login or a fully ready production API.

Evidence: `.verification/f02-remote-db-independent-mocks.log`, `f02-remote-db-independent-cli.log`, `f02-remote-db-independent-cli-resumed.log`, `f02-neon-runtime-independent.log`, `f02-corrected-ci.log`, `f02-corrected-ci-full.log`, `f02-vercel-esm-hosted-api.log` and `f02-vercel-esm-hosted-headers.log`.

## Applied state already evidenced before interruption

The main and Preview endpoints belong to distinct branch IDs. Recovery branch `br-bold-dust-aufk4kqx` (`f02-pre-activation-20260909`) was created from main `br-patient-frog-aufc0v84` without compute and confirmed ready before DDL. September 15 branch metadata still reports it ready. The standalone `lessonquest_runtime` role was created with all planned administrative/inheritance flags disabled and no outgoing or untrusted incoming membership. The accepted migration reported applied version 1. Production received one sensitive `LESSONQUEST_DATABASE_URL`. The September 15 preflight still shows that Production-only variable and the eight owner-secret names awaiting removal.

No teacher was bootstrapped. The earlier direct TLS probe recorded an authorized TLS 1.3 client socket; database-side `pg_stat_ssl` across the Neon proxy was not treated as client encryption evidence.

## Resumed-run failure and fresh passing evidence

The implementer's first September 15 runtime-smoke attempt returned exit 1 with the safe generic operator error before stdout readiness evidence. Its stdout log is empty; the exit/error was reported from the tool result. Direct verified-TLS connections, target/schema metadata and separate version, safe-role and runtime-grant checks then passed. The approved explicit query configuration had already been applied, so the failure must not be attributed to a channel-binding conversion, cold start, TLS or another unproven cause. No source, password, ledger or ACL change was made to obtain the unchanged retry's exit-0 result.

After that retry, the independent reviewer ran the actual original `runtime-smoke` again on September 15. It also exited 0 with restricted readiness, owner refusal, all six distinct permission-denied probes and zero users/organizations/lesson inputs. This resolves the current readiness gate on fresh direct evidence while preserving the initial failure as a diagnostic limitation. Evidence: `.verification/f02-neon-runtime-smoke-resume-retry-20260915.log` and `.verification/f02-neon-runtime-independent-resume-20260915.log`.

The reviewed environment-removal operator subsequently exited 0. Independently parsed the actual September 15 before/after metadata: 26 variables became 18; exactly the eight named sensitive owner credentials disappeared; every other name/type/scope/configuration ID remained equal. `LESSONQUEST_DATABASE_URL` and unchanged `OPENAI_API_KEY` remain sensitive Production-only variables. No Firebase service-account JSON variable exists yet. Values were never read or compared. Evidence: `.verification/f02-owner-env-removal-20260915.log`, `f02-vercel-env-resume-20260915.log`, `f02-vercel-env-after-owner-removal.log` and `f02-vercel-env-independent-comparison-20260915.log`. The resumed production dependency audit also reports no known vulnerabilities.

## Findings and remaining delivery conditions

No current correctness, authorization, tenant-isolation or secret-handling defect was found in the applied bounded change. Two nonblocking operational limitations remain:

1. The temporary operator's generic catch suppresses the failing stage as well as secret details. The first resumed exit-1 attempt cannot be diagnosed retrospectively. Before expanding operator use, add only nonsecret stage labels through the normal plan/review gate; never print connection strings or raw database errors. The unchanged passing retry and independent actual repeat establish present readiness, not a proven explanation for the first attempt.
2. The checkpoint's identity, parent, ready state and lack of compute are evidenced, but no restore exercise was performed. Preserve the checkpoint and previous deployment; do not describe recovery as restore-tested or perform destructive repair on that basis.

Inspected the corrected September 15 progress document; it now distinguishes completed DB/configuration work from pending activation. The plan's post-deployment owner-variable re-injection check remains mandatory because modifying project variables does not rewrite historical deployment snapshots. Firebase server credentials, explicit teacher UID, actual login/save verification, merged-result CI and deployed-SHA verification remain outstanding. This bounded pass must not be used as a full activation or release-completion claim.

## Final rubric and decision

| Category                                   |           Score | Evidence                                                                                                                                                                                                                                               |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance  |           25/25 | Dedicated targets, prerequisite CI/checkpoint, restricted role, exact eight-variable removal and no unauthorized teacher/student/AI expansion.                                                                                                         |
| Correctness and code quality               |           20/20 | Frozen operator source and accepted migration are used unchanged; actual ledger/inventory/ACL readiness and exact metadata comparison pass.                                                                                                            |
| Security, privacy and tenant isolation     |           20/20 | Verified TLS configuration; owner/runtime separation; six real permission-denied cases; Production-only app secret; unchanged blocked AI; no secret values or real student rows exposed.                                                               |
| Test and verification evidence             |           19/20 | Independent CLI 5, intercepted operator cases 13, actual September 9 and September 15 restricted smoke, and fresh metadata comparison pass; exact-head full CI/audit evidence is inspected. The first resumed failure has only generic error evidence. |
| Operability, recoverability and provenance |           13/15 | Source/hash records survived temporary-file loss; free checkpoint and retained rollback target are documented; current progress is accurate. Safe stage diagnostics and an actual recovery exercise remain limitations.                                |
| **Total**                                  | **97/100 PASS** | **Strictly greater than 85, with no critical blocker for the bounded database/new-deployment configuration result.**                                                                                                                                   |

The reviewer edited only this review document and independent verification artifacts. No implementation, grants, credentials, environment variables or production deployments were changed by the reviewer. Final formatting and diff checks passed.
