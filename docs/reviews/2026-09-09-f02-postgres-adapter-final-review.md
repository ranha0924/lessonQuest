# F02 PostgreSQL adapter independent final validation

2026-09-09. Reviewer: `/root/f02_postgres_final_review`, newly assigned and independent of implementation. Reviewed branch `codex/f02-live-authoring` against base `20b3672` in the F02 worktree. The reviewer did not change implementation, tests, configuration, or dependencies. Only this report was written; independent executable probes remain under `/tmp` and their evidence under `.verification/*.log`.

**Final decision: 98/100 PASS. No critical blocker or unresolved correctness/security finding in this local adapter unit.** This accepts the corrected PostgreSQL building block only. It does not certify live F02, remote migrations, Firebase UI/runtime integration, paid AI enforcement, main integration, CI release, or deployment.

## Controlling scope and actual diff

Read `docs/PROJECT_CANON.md`, `memory/projects/lessonquest.md`, the PostgreSQL adapter plan, its passing pre-implementation review and refinements, and the implementer verification report. Inspected the entire tracked diff and new adapter, SQL interfaces, tests, harness and Vitest configuration; reviewed exact dependency/catalog/lock changes, version-specific native build approvals, node-only package export, schema type-only changes, repository type substitutions, and the bounded lesson-input mutation serialization change. The later AI default-deny plan/review documents are outside this acceptance.

The final 22 source/config/test/dependency hashes in `.verification/f02-postgres-manifest.log` were checked with Node SHA-256 before acceptance. The helper/dependency correction changed the approved manifest; the corrected manifest was checked again. Runtime SQL schema content is unchanged. Only lesson-input write serialization adds SQL behavior: a tenant-and-actor membership row is locked before current authority and mutation-ledger decisions.

## Independent checks

- Real PostgreSQL suite: **36/36 PASS**, exit 0, before correction and again against the corrected helper. Logs: `.verification/f02-postgres-independent-suite.log` and `.verification/f02-postgres-independent-corrected-suite.log`. Each invocation owned a fresh loopback-only synthetic cluster.
- Focused existing PGlite lesson-input and Firebase-identity repository regression: **23/23 PASS**, exit 0. Log: `.verification/f02-postgres-independent-pglite.log`.
- Seven additional real PostgreSQL probes passed: explicit configuration withstands ambient PG settings; standalone driver errors retain no private parameter/query/cause; detached successful writes drain before commit; domain exceptions roll back detached queued writes; close waits for an active transaction while rejecting new work; pool exhaustion fails within its configured connection bound and subsequently recovers; membership revocation while a write is demonstrably waiting for the membership lock is rechecked before writing. Log: `.verification/f02-postgres-independent-probes.log`.
- Actual Vite browser resolution rejected `@lessonquest/db/postgres` under browser/import conditions. All **21** emitted normal/demo/preview JS, map and HTML artifacts lacked pg driver, adapter and test-credential markers. Log: `.verification/f02-postgres-independent-browser.log`; the implementer's separately supplied boundary evidence agrees.
- Independently reran production audit, corrected-helper ESLint and diff whitespace checks: exit 0; audit reported no known vulnerabilities.
- Inspected both pinned Darwin ARM64 and Linux x64 native symlink hydration scripts and manifests. Operations remain package-local; no account, service, network or blanket build-script authorization was introduced. Inspected the public `async-exit-hook` implementation used by the corrected helper; its exact 2.0.1 dependency is development-only and was already transitive.

## Finding discovered and corrected before scoring

The original helper's signal handling raced the embedded package's own asynchronous exit hook. Sending SIGTERM during setup exited 143 but left one invocation-owned directory. This was reproduced independently and reported immediately; its RED evidence is preserved in `.verification/f02-postgres-independent-interrupt.log`. The reviewer removed only that probe's newly created directory. No final acceptance score was issued for that candidate.

The implementer passed a written remediation refinement, added the exact already-transitive development dependency, removed only the upstream SIGHUP/SIGINT/SIGTERM hook handlers in this owned test process, and placed setup and cleanup under the helper's lifecycle. The reviewer inspected the corrected source and lockfile without editing them.

Independent corrected-candidate probes sent SIGTERM at 200 ms and 700 ms, and SIGINT at 1200 ms. They exited **143, 143 and 130**, respectively, with **zero remaining cluster directories**. In the last probe the PostgreSQL backend PID was observed before interruption and verified gone afterward. Each probe used its own `/tmp` parent directory to avoid another agent's test clusters. Log: `.verification/f02-postgres-independent-interrupt-green.log`. The implementer's separate active-test SIGTERM probe also passed. The original finding is resolved.

## Implementer evidence examined

The preserved RED logs demonstrate absent persistence/configuration behavior, the real duplicate-create race, checked-out connection termination errors, and false success after a detached failed query. The initial harness's incorrect zero exit and the earlier accidental race pass are explicitly documented as insufficient evidence; the later nonzero RED reproductions and final GREEN runs supersede them.

The full `pnpm check` log records **528 tests / 48 files**, lint, formatting, root/web type checks, workspace builds and Vite build, all passing. The complete matrix status records exit 0 for PostgreSQL **36**, integration **80**, E2E **80**, demo browser **12**, and preview browser **42**. After the helper-only correction, the implementer repeated frozen install, affected lint/format, production audit, PostgreSQL suite and interruption checks. Production adapter/repository/test code stayed unchanged, so the full production regression evidence remains applicable. No broader completion claim is inferred from these local checks.

## Rubric

| Category                                   |           Score | Evidence                                                                                                                                                                                                |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           25/25 | Structural PGlite compatibility, real PostgreSQL persistence and transaction behavior, bounded race refinement, mandatory CI command and corrected owned-cluster lifecycle satisfy the local plan.      |
| Correctness and code quality               |           20/20 | One checked-out client per transaction, pending-query drain, safe rollback/release, no ambiguous replay, close semantics and authoritative mutation serialization pass actual multi-pool probes.        |
| Security, privacy and tenant isolation     |           20/20 | Explicit strict production TLS and credentials, unsupported required channel binding fails closed, sanitized errors, browser exclusion, current tenant/role checks and no external/student data access. |
| Test and verification evidence             |           19/20 | Real RED/GREEN evidence, independent engine/probe/boundary checks and full regression matrix; signal regression probes are currently recorded local scripts rather than a versioned automated CI test.  |
| Operability, recoverability and provenance |           14/15 | Exact attributable dependencies, narrow inspected native scripts, owned process/path cleanup and documented revert; Linux x64 native execution still requires the existing mandatory CI run.            |
| **Total**                                  | **98/100 PASS** | **Above 85; no critical blocker.**                                                                                                                                                                      |

A small nonblocking maintenance follow-up is to retain the signal-cleanup regression as a versioned automated test when extending the harness. Before any release, verify the required CI on the integrated commit, including the Linux PostgreSQL command. Remote credentials, migrations/application roles, environment isolation, bootstrap, server/frontend wiring and AI/payment controls remain explicitly outside this unit. The user's no-payment-service choice still requires external AI to remain default-denied in subsequent generation work.
