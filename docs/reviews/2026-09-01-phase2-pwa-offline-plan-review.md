# Phase 2 PWA and offline learning-event plan review

Date: 2026-09-01. Candidate plan: `docs/superpowers/plans/2026-09-01-phase2-pwa-offline.md`. Base: `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`.

## Decision

**PASS — 97/100. No critical blocker. Production implementation is authorized after the recorded baseline completes.**

| Category                               |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope coverage        |      25/25 | The design and constraints trace Phase 2 PWA queue, exact event replay, bounded retry, account/organization isolation, session/device policy and resilience. Online-only operations, synthetic preview limitations, later identity/export work and real-data migration are explicit exclusions.                                                                                     |
| Architecture and interface quality     |      19/20 | SDK coordinator, scoped storage port, IndexedDB adapter, host opt-in key, React subscription and static-only worker have clear ownership and failure behavior. The persistent API host needed for a meaningful cross-reload production replay remains outside this synthetic deployment, but the boundary and test strategy are explicit.                                           |
| Security, privacy and tenant safety    |      20/20 | The queue stores no token, correctness, hint/content or profile; strict scope parsing and terminal authorization deletion fail closed. Worker rules exclude authorization/API/cross-origin/error responses. Logout/reset scope clearing, expiry/cap and no Background Sync address shared-device and credential risks.                                                              |
| Test and verification quality          |      19/20 | RED/GREEN unit, real React/API/DB, build and three-width browser cases cover replay, loss timing, isolation, expiry/backoff, terminal authority, worker cache exclusions and offline shell. Browser limitations mean real multi-device persistent-server behavior is modeled through deterministic store instances and server idempotency rather than a production staging backend. |
| Execution readiness and recoverability |      14/15 | File-level tasks, pinned versions, commands, queue/worker rollback, opt-out, provenance, manifest freeze, independent gate, CI and live release evidence are concrete. Exact final test counts and worker asset hashes can only be recorded after implementation.                                                                                                                   |
| **Total**                              | **97/100** | **Strictly greater than 85; implementation gate passes.**                                                                                                                                                                                                                                                                                                                           |

## Blocker check

- Authorization/tenant/secrets/student-data risk: no unresolved blocker. Server revalidates every replay; storage scopes do not grant authority; terminal denials are not moved or retried.
- Destructive migration/rollback: none. IndexedDB and Cache Storage are client-owned, bounded and removable; no server schema change.
- Generated content/sandbox: unchanged. Worker does not cache authenticated content APIs and the existing sandbox policy remains.
- Reference systems/real data: excluded; original LessonQuest implementation only.
- Verifiability/authority: acceptance commands and standing LessonQuest delivery authorization are present; no paid or external resource is required.

## Review notes retained for final validation

The final reviewer should pay particular attention to IndexedDB reads being scope-bound, clearing after the real `lessonquest:session-ended` path, terminal 401/403/404/409 behavior, automatic callback races after remount/scope change, Cache Storage exclusion of `/organizations/` and authorization headers, and the difference between an offline app shell and a persistent operating backend. These are scored implementation risks, not unresolved plan blockers.
