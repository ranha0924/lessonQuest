# PostgreSQL adapter pre-implementation review

2026-09-09; base20b3672. Scope and controlling requirements: `docs/superpowers/plans/2026-09-09-f02-postgres-adapter.md`, PROJECT_CANON and project-memory rubric. Reviewed before production changes.

| Category                       |           Score | Evidence                                                                                                                                             |
| ------------------------------ | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements/scope             |           24/25 | Real persistent SQL adapter, restart/concurrency/tenant evidence; explicit synthetic local target and remaining live migration/runtime dependencies. |
| Architecture/interfaces        |           19/20 | Minimal structural SQL types, one-client transactions, close/rollback/release rules, node-only export and no browser pg dependency.                  |
| Security/privacy/tenant safety |           20/20 | Explicit credentials/TLS validation, safe errors, loopback-only disposable test guard, current DB authorization, no real data/remote migration.      |
| Tests/verification             |           19/20 | Real-PG RED/GREEN, two-pool races, rollback/authority negatives, full existing checks and mandatory independent final review.                        |
| Execution/recovery             |           14/15 | Exact dependency versions/files/harness lifecycle, no OS account/service change, bounded local cleanup, provenance and revert.                       |
| **Total**                      | **96/100 PASS** | **Above85; no critical blocker within the local adapter scope.**                                                                                     |

The missing Neon email activation and server credentials prevent remote rollout, not this invocation-owned local cluster. No external authority is inferred from the package documentation. Package postinstall decisions require script inspection; no blanket approval is authorized. The final check must not silently skip PostgreSQL tests or claim PGlite alone verifies concurrency.

Readiness re-review before adapter implementation: CI/tsconfig/script extension and exact inspected platform postinstalls are now explicit. No new external target or authority. Same rubric24+19+20+19+14=96/100 PASS; no critical blocker.

Driver-source refinement: fail closed on unsupported required channel binding, keep strict TLS; explicitly check harness exit status. Revised scope remains96/100 PASS before adapter implementation.

Concurrency re-review before SQL changes: `.verification/f02-postgres-race-red.log` reproduces one failing duplicate-create assertion (31 other checks pass). Existing membership-row serialization is tenant+actor bounded, followed by fresh authority checks; no new schema or uncontrolled retry. Added exact-update replay and connection-termination checks cover the refined change. Rubric24+19+20+19+14=96/100 PASS, no critical blocker. This supersedes the earlier type-only/no-SQL-change restriction solely for the documented F01 write serialization.

Lifecycle re-review: draining transaction-issued queries closes a reproduced false-success path without retries or authority changes. Same96/100 PASS, no blocker; add RED/GREEN evidence for detached failure.

Independent-review cleanup remediation precheck: observed local SIGTERM artifact, inspected public upstream unhookEvent semantics, exact already-transitive dev dependency and single-process signal ownership. Revised plan96/100 PASS before helper/dependency edits; no external service/process authority expansion. Existing runtime verification remains applicable; new hashes and affected helper checks required before independent final scoring.
