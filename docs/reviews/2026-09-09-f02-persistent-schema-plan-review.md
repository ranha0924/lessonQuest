# F02 persistent schema plan review

2026-09-09;base4a0e414. Reviewed PROJECT_CANON, the F02 design and `2026-09-09-f02-persistent-schema.md` against memory/projects/lessonquest.md before production edits.

| Category                 |           Score | Evidence                                                                                                                                                                                    |
| ------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements/scope       |           24/25 | Versioned durable schema and explicit approved teacher registration directly enable the requested login/storage; AI default deny is preserved, live configuration remains separately gated. |
| Architecture/interfaces  |           19/20 | Node-only provisioning, dedicated schema, immutable version/hash, separate existing migration/runtime roles, explicit CLI target and repeat semantics; no startup DDL.                      |
| Security/privacy/tenants |           20/20 | Runtime authorization tables read-only, effective-role checks, strict identifiers, no auto-admin/email linking, private organization, parameterized UID, no secrets/logs/remote reads.      |
| Test/verification        |           19/20 | Real PostgreSQL privilege and concurrency negatives, rollback/drift/repetition coverage, PGlite regressions, browser export containment and independent final gate.                         |
| Readiness/recoverability |           14/15 | File-level order, existing pinned driver/harness, transactional DDL and refusal to repair incompatible state, explicit no-destructive-rollback and future remote checkpoint requirements.   |
| **Total**                | **96/100 PASS** | No critical blocker for local implementation.                                                                                                                                               |

The outstanding external credential/Neon isolation/initial uid facts block remote provisioning, not the explicitly local synthetic implementation and tests authorized by the F02 design. This review does not authorize remote schema execution. Advisory locking replaces the membership row lock solely to enable least-privilege runtime grants; current authority is still checked after waiting. Any failure in those concurrency tests requires correction before final validation. No external package addition is needed.

Read-only-authority refinement reviewed before implementation:97/100 PASS (architecture20/20; other categories unchanged). Narrowing the joined row lock to the actual lesson row is necessary for the approved grant set. A fresh full authorized read after that wait closes stale-join authorization, with a deterministic real PostgreSQL revocation test required. No external authority or scope is added.
