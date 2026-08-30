# Phase 1 M5–M6 Plan Review

- Review date: 2026-08-30
- Scope: `docs/superpowers/plans/2026-08-30-phase-1-m5-m6.md`
- Design: `docs/superpowers/specs/2026-08-30-phase-1-m5-m6-design.md`
- Reviewer: Implementing agent self-review (pre-implementation gate)
- Threshold: strictly greater than 85; no critical blocker

## Evidence review

| Category                               |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope coverage        |      25/25 | The plan's requirement traceability maps answer-safe sequential hints, durable usage, exact retries/sequences, one active immutable campaign, authoritative contributions, projection-failure containment, aggregate-only student visibility, protected teacher detail/hint count, append-only audit, and a real Phase 1 boundary to Tasks 1–11. Global constraints and rollback explicitly exclude external AI, Firebase, real data, source/deployment mutation, push, merge, and deploy.                       |
| Architecture and interface quality     |      19/20 | Package/repository/UI ownership, strict contracts, provider port, two-transaction Rasa orchestration, attempt locks, request/job state transitions, campaign binding, separate projection drain, response parsing, and safe error behavior are concrete. One point is retained because real multi-connection PostgreSQL concurrency and a production migration are deliberately outside this local PGlite slice; the plan still names compatible locks and deterministic containment evidence.                   |
| Security, privacy, and tenant safety   |      20/20 | The plan rechecks current database roles and composite tenant ownership, collapses IDOR to safe not-found, forbids client context/correctness/damage/server events, minimizes provider data, leak-checks Korean/English output, renders text only, stores no raw rejection, bounds bodies/fields/jobs, makes evidence append-only, uses synthetic local data, and includes direct SQL abuse probes.                                                                                                              |
| Test and verification quality          |      20/20 | Tasks 1–10 define mutation-sensitive RED observations, focused GREEN commands, and negative cases for coercion, answer leakage, stale roles, cross-tenant IDs, lifecycle drift, exact replay, concurrent sequence allocation, output injection, append-only evidence, job failure/retry, response privacy, and accessibility. Task 11 adds real React→HTTP→Hono→repositories/provider/projector→PGlite E2E, correct-first coverage, one full bundle, audit, credential scan, and a fresh independent final gate. |
| Execution readiness and recoverability |      14/15 | Eleven ordered tasks name exact files, interfaces, commands, commit boundaries, dependencies, observability, provenance, feature-off containment, and branch-local rollback. One point is retained because production adapter/migration rollback cannot be exercised in this explicitly local-only phase; no implementation dependency or missing authority remains for the approved scope.                                                                                                                      |
| **Total**                              | **98/100** | **PASS — implementation may proceed test-first.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Design-to-plan consistency check

- Rasa provider: pure `@lessonquest/rasa`, deterministic local model, 2-second orchestration timeout, bounded token estimates, zero cost, no network or secret input.
- Rasa authority: the server derives context/level/correctness, performs answer-leak rejection, persists terminal states and safe audit data, and creates the first `RASA_OPENED` plus sequential `HINT_USED` events.
- Retry semantics: ambiguous HTTP delivery reuses the exact request/event ID; a received terminal provider 503 retries the same unused level with a new request ID, preserving the approved terminal-state invariant.
- Boss authority: one active class campaign, immutable policy, event-time campaign snapshot, stored authoritative outcome mapping, unique source event, append-only contribution, and independent projection retry.
- Privacy: student boss response/DOM is aggregate only; teacher detail is current-role/class guarded, and hint progress stores a count rather than content.
- M3/M4 hardening: attempt-row locking, authoritative `nextSequence`, exact SDK retry, audit immutability, and `DUPLICATE` outcomes are planned before M5/M6 relies on those boundaries.
- Verification cadence: focused RED/GREEN tests during work, one complete implementer verification, then one fresh independent final review; no repetitive full-suite validation.

## Critical blocker check

- Unresolved authorization, tenant, secret, or student-data risk: **No.** All protected methods repeat current database-backed authority; tests use synthetic local identities; the provider receives no secret/answer/profile data.
- Destructive or irreversible migration without recovery: **No.** Schema changes initialize fresh local PGlite only, with no production database or data conversion.
- Generated content publication without validation/teacher approval: **No.** M3/M4 validation, approval, artifact hash, and assignment lifecycle remain prerequisites and receive regression coverage.
- Untrusted code accessing credentials or protected data: **No.** Rasa returns one parsed text action; no generated code, arbitrary action execution, environment access, or external provider exists.
- Existing source repository or deployment mutation: **No.** The plan is branch-local and carries forward WordQuest provenance without touching the reference repository.
- Unverifiable acceptance criteria: **No.** Every acceptance requirement maps to focused unit/repository/API/UI evidence and the real-boundary E2E.
- Missing credentials, external authority, or user choice: **No.** The user approved the M5/M6 design and this local implementation-planning step; no credential or external mutation is required.

## Decision

The plan scores **98/100 PASS** with no critical blocker. Tasks 1–11 are authorized to proceed sequentially under test-driven development. This score authorizes implementation only; acceptance still requires the planned full implementer verification and a fresh independent non-implementing review scoring at least 86/100 with no critical blocker. Push, PR updates, merge, deployment, Firebase, external AI, and existing-repository mutation remain unauthorized.
