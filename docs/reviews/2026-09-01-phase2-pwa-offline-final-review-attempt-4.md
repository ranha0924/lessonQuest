# Phase 2 PWA and offline learning-event final review — Attempt 4

Date: 2026-09-01
Reviewer: fresh independent non-implementing agent
Base: `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`
Candidate: uncommitted tree on `codex/phase2-offline-queue`, identified by `/tmp/lq-phase2-offline-implementation-hashes.json`

## Decision

**PASS — 91/100. No critical blocker remains.**

Attempt 4 independently verified the complete candidate and every blocker preserved in Attempts 1–3. Clear plus dispose now invalidates stale work across initial start/list, enqueue prune, initial staging put, retry metadata put and unresolved success/terminal/retryable delivery. The exact scope remained empty in memory and storage after each operation settled, no stale delivery/rejection result was emitted, and ordinary dispose retained the exact staged envelope. Simultaneous online enqueues staged in invocation order, held one active delivery, retried the FIFO head before the next record, and kept attempt time/backoff state tied to the active reservation.

The cache, tenant and storage-corruption findings from prior attempts also remain fixed. API/authenticated navigation bodies, redirected cross-origin responses and unsafe warming inputs did not enter the LessonQuest named cache. The actual IndexedDB adapter deleted both an embedded-organization mismatch and a malformed active-scope primary key by the returned key, delivered neither, and preserved an unrelated account/organization record.

Two additional edge probes found noncritical cleanup/backoff gaps described below. They do not weaken server authority, scope clearing, exact replay, data minimization or the current synthetic release boundary, but they should be fixed before relying on the queue under persistent browser-storage faults.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      23/25 | Installable same-origin shell, opt-in exact replay, strict account/organization scope, 20-record/24-hour bounds, deterministic retry, terminal deletion, restoration, session/reset clear and synthetic-preview exclusions conform to the approved plan. A retry metadata storage failure is surfaced to the caller but still schedules the unchanged due head immediately, falling short of the plan's safe storage-error behavior. |
| Correctness and code quality                |      16/20 | Lifecycle and clear generations now cover every planned asynchronous phase; staging and delivery are single-flight FIFO with per-reservation attempt time. Actual response/session restoration behavior is coherent. Two disposable edge probes found a 0 ms reschedule after retry `put` failure and one reentrant dispose path that installs an online listener after disposal.                                                    |
| Security, privacy, and tenant isolation     |      19/20 | Server authority remains mandatory; no token, correctness, hint/content or profile enters IndexedDB; malformed scope/key records fail closed; API/auth/cross-origin cache writes are blocked; session-end races leave the exact scope empty. The reentrant listener retains an inert disposed queue closure until page teardown, although disposed guards prevent delivery and no cross-tenant or authorization bypass was found.    |
| Test and verification evidence              |      20/20 | Fresh full, focused, integration, E2E, demo and three-width service-preview suites all passed at the expected counts. Eight additional lifecycle/FIFO probes and a corrected warming/runtime cache probe passed. The two extra edge probes intentionally failed with concrete findings. Hashes, audit and diff checks passed, and the failed probes were deleted.                                                                    |
| Operability, recoverability, and provenance |      13/15 | Queue opt-out, scoped device clear, worker/cache rollback, no schema/dependency change, original LessonQuest provenance and candid synthetic-preview limits are actionable. Persistent retry-metadata storage failure needs a nonzero in-memory backoff or scheduling stop, and start should recheck disposal before installing its online listener.                                                                                 |
| **Total**                                   | **91/100** | **Strictly greater than 85 with no critical blocker; the independent final-validation gate passes.**                                                                                                                                                                                                                                                                                                                                 |

## Attempt 3 remediation verified

### 1. Every pre-delivery await is lifecycle-aware

`packages/experience-sdk/src/offline-event-queue.ts:192-209` checks the captured lifecycle generation after prune and list before accepting loaded records. `enqueue()` captures lifecycle and clear generations before its first await at lines 328-331, performs prune and initial put inside the invocation-ordered staging lock, and rechecks the lifecycle after both awaits at lines 332-361. A put that crossed clear is removed by the exact event ID before the stale enqueue returns.

A disposable eight-case Vitest probe independently held each relevant phase:

- start returned a stale list snapshot after clear plus dispose;
- enqueue paused in prune and in the initial put;
- a retryable delivery paused in the retry metadata put;
- success, terminal and retryable deliveries remained unresolved until after clear plus dispose;
- ordinary dispose crossed an unresolved retryable delivery;
- two online enqueues were issued together and their deliveries were held individually.

All clear cases finished with zero stored records, `pendingCount: 0`, `sending: false`, no `DELIVERED`/`REJECTED` emission and no delivery after stale start. Ordinary dispose preserved the original record at `attempts: 0`. The checked-in actual lifecycle cases also passed for initial staging and pre-staging prune through `bindOfflineQueueSessionLifecycle`.

### 2. Concurrent enqueues are globally FIFO and single-flight

`withStagingLock` at `packages/experience-sdk/src/offline-event-queue.ts:175-191` serializes staging in invocation order. `reserveDelivery` at lines 212-224 permits only one active record and captures its own `attemptedAt`. A later enqueue can stage while the head is in flight, but lines 366-374 return it as queued rather than starting another delivery. The flush loop at lines 279-297 advances only after head settlement.

The disposable probe observed initial puts in event-1/event-2 invocation order, one active delivery and `lastAttemptAt: 1000`. Event 1 failed retryably and persisted `attempts: 1, nextAttemptAt: 3000`, derived from its reservation rather than the later clock. Forced retry at time 5000 delivered event 1 again; only after its success did event 2 reserve delivery at time 7000. Maximum concurrent delivery remained one and final storage was empty.

## Prior blocker verification

- **API/auth navigation isolation:** the checked-in three-width case navigated to `/health` and a cookie-authorized `/organizations/private/report`; neither sentinel body replaced cached `/`, and offline root remained the real shell. Navigation request gating is at `apps/web/public/service-worker.js:14-18,71-85`.
- **Redirect/precache/runtime/warming safety:** `canCacheResponse` at `apps/web/public/service-worker.js:30-38` rechecks final response origin and API path for precache, navigation, static runtime and warming writes. The checked-in redirected CORS runtime case passed at all widths. A disposable warming probe sent the worker `/redirect-static.js`, `/health`, `/organizations/private/report` and a direct cross-origin URL, then issued Authorization and POST static requests. The single current LessonQuest cache retained the real shell and none of those request bodies/URLs. The probe's first run used an incorrect expected Korean heading and timed out before exercising the worker; correcting only the disposable locator produced the valid passing run.
- **Named-cache containment:** runtime reads and writes open only `lessonquest-shell-2026-09-01-v2`; activation deletes only stale `lessonquest-shell-*` names. The foreign-cache sentinel case passed, and no foreign cache was consulted.
- **Organization mismatch:** SDK reload removes a stored event whose embedded organization differs from the parsed scope before delivery at `packages/experience-sdk/src/offline-event-queue.ts:192-204`.
- **Canonical IndexedDB key and unrelated scope:** `apps/web/src/offline/indexeddb-event-store.ts:86-127` reads values with actual primary keys, compares metadata, embedded organization and canonical scope/event key, and deletes invalid records by the returned primary key. The three-width browser case at `tests/browser/service-preview.spec.ts:497-631` proved zero active/foreign delivery, deletion of both malformed active-scope records and preservation of the unrelated valid record.
- **Scope-only prune/clear:** IndexedDB list, clear and prune use the exact compound `scope` index. Browser reset removed only the active queue record and preserved the foreign account/organization fixture.

## Nonblocking findings

### 1. Major — retry metadata storage failure leaves an immediate retry scheduled

On a retryable delivery, `packages/experience-sdk/src/offline-event-queue.ts:254-260` computes the backoff record and awaits `store.put`. If that put rejects, the in-memory record still has its original due time. The `finally` block at lines 272-275 calls `schedule()`, which computes delay from the unchanged head at lines 161-170.

A disposable store allowed the initial staging put, rejected the delivery, then rejected only the `attempts: 1` metadata put. `enqueue()` correctly surfaced `storage failed`, but the captured timer delays were `[0]`. With real timers and a continuing network/storage fault, this can enter an immediate retry cycle and produce unhandled rejected flush promises. It does not erase or move the exact staged event, and server idempotency still protects duplicate commits, so it is an availability/operability defect rather than a critical authority or privacy blocker.

Recommended follow-up: update in-memory retry state before or despite persistence failure and retain the computed backoff, or stop automatic scheduling after the storage error until an explicit online/retry action. Timer callbacks should also consume/recover flush rejections.

### 2. Minor — synchronous dispose from reload's state callback can install one inert online listener

`reload()` assigns records and synchronously emits state at `packages/experience-sdk/src/offline-event-queue.ts:205-209`. If that subscriber calls `dispose()` synchronously, `reload()` still returns `true`; `start()` at lines 304-311 then sets `started` and invokes `onOnline` after disposal. The later listener remover was not available when dispose ran.

A disposable probe armed a subscriber only for reload's state update and counted the listener port. It observed `{ installed: 1, removed: 0 }`. The callback is inert because every flush path checks `disposed`, and normal session-end crossing an asynchronous list is already stopped by the lifecycle check, so this is not a stale delivery or clear failure. It can retain the disposed queue/API closure until page teardown.

Recommended follow-up: recheck the captured lifecycle immediately after `reload()` and before/after installing the online listener; remove a just-installed listener if disposal occurred reentrantly.

## Fresh independent verification evidence

- Hash manifest before checks: **26/26 implementation/test/script files matched**, zero mismatches; branch and merge base matched the manifest.
- Focused queue/session/React run: **3 files / 32 tests PASS** (`13 + 9 + 10`).
- `corepack pnpm check`: **PASS** — ESLint, Prettier, root/web TypeScript, every workspace build and **37 files / 382 tests**.
- `corepack pnpm test:integration`: **7 files / 52 tests PASS**.
- `corepack pnpm test:e2e`: **11 files / 77 tests PASS**.
- `corepack pnpm test:browser`: **12/12 Chromium cases PASS** at 1440×900, 768×1024 and 375×812.
- `corepack pnpm test:preview`: **33/33 Chromium cases PASS** across the same widths.
- `corepack pnpm audit --prod --audit-level high`: **PASS**, no known vulnerabilities.
- `git diff --check d85b10841c333de3bd578f8fdaa2eae0bb117ae4`: **PASS**.
- Post-probe hash manifest: **26/26 matched** after deleting all disposable probe files. `pnpm-lock.yaml` and dependency declarations remain unchanged; root `package.json` only adds the checked-in offline E2E file to the existing script.
- No Firebase, real student data, reference repository/deployment, persistent external database or paid resource was accessed. No production code was modified by the reviewer.

The inherited PGlite direct-eval and large preview-chunk warnings remain limited to the documented synthetic development preview. They do not affect this gate decision.

## Gate outcome

Attempt 4 passes the mandatory independent final-validation gate at **91/100 with no critical blocker**. Attempts 1–3 remain preserved as failed historical reviews. The exact reviewed candidate may proceed to the authorized commit, exact-head CI, expected-head merge and existing Git-linked Vercel delivery workflow. The two nonblocking findings above should remain tracked and be resolved before a production persistent-backend rollout.
