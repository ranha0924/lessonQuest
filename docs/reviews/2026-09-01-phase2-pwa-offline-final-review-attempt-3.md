# Phase 2 PWA and offline learning-event final review — Attempt 3

Date: 2026-09-01
Reviewer: fresh independent non-implementing agent
Base: `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`
Candidate: uncommitted tree on `codex/phase2-offline-queue`, identified by `/tmp/lq-phase2-offline-implementation-hashes.json`

## Decision

**FAIL — 80/100. Critical session-end privacy/recoverability blocker remains. Do not commit, merge or deploy this candidate.**

Attempt 3 fixes the two concrete Attempt 2 findings once an event has reached `attemptDelivery`: late success, terminal and retryable outcomes no longer recreate a cleared record, and IndexedDB deletes a malformed current-scope primary key by the actual returned key while preserving another scope. The Attempt 1 cache and organization-containment findings also remain fixed. Fresh ordinary checks passed 379 tests, 29 focused queue/session/React cases, integration, E2E and both browser matrices.

The reviewed lifecycle protection starts too late, however. `enqueue()` performs its reload and initial durable `put()` outside the delivery generation guard. If the host completes session-end clear/dispose while either operation is unresolved, the old enqueue resumes and stores the learning event after the clear promise has completed. Two independent deterministic probes reproduced this through the actual `bindOfflineQueueSessionLifecycle` path. A separate probe also showed two online enqueues delivering concurrently and out of global FIFO order. The shared-device session-end failure is critical regardless of the numerical score.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      20/25 | Manifest, exact replay, bounded retention/backoff, strict restoration, terminal deletion, PWA containment and preview limitations match the approved plan. Session end does not cover the complete enqueue pipeline, and concurrent online enqueue bypasses the approved global FIFO behavior.                                                                                                     |
| Correctness and code quality                |      14/20 | The SDK, store and web boundaries are generally clear, and both prior primary-key and in-delivery generation defects are repaired. Queue mutation is not serialized: reload/staging can cross clear, direct enqueue bypasses the `flushing` gate, and the shared `sending`/`lastAttemptAt` fields cannot describe two concurrent deliveries correctly.                                             |
| Security, privacy, and tenant isolation     |      15/20 | API/authenticated navigation bodies, redirected cross-origin responses, foreign embedded organizations and malformed active-scope keys now fail closed. Stored records still contain assignment, attempt, step and answer-option learning data after a completed session-end clear in the reproduced pre-delivery races, so the documented shared-device privacy boundary remains broken.          |
| Test and verification evidence              |      18/20 | Fresh full, focused, integration, E2E, demo and 33-case service-preview matrices passed; all 26 hashes matched. Existing late-outcome tests cover success, terminal and retryable delivery after staging, and ordinary dispose retention passes. They do not delay reload or the first store write, nor do they issue concurrent online enqueues; three disposable adversarial cases failed there. |
| Operability, recoverability, and provenance |      13/15 | Dependency, audit, diff, provenance and synthetic-preview containment evidence is clean. Current named-cache reads/writes and active-scope IndexedDB cleanup work. Logout/reset is documented as the recovery action on a shared device but remains unreliable until every older enqueue operation is excluded from writing after clear completion.                                                |
| **Total**                                   | **80/100** | **Fails the required score and critical-blocker gate.**                                                                                                                                                                                                                                                                                                                                            |

## Findings

### 1. Critical — session-end clear can be crossed by pre-delivery reload and staging writes

`packages/experience-sdk/src/offline-event-queue.ts:265-299` checks `disposed` before `reload()`, then awaits reload and `store.put()` without capturing or rechecking a lifecycle/clear generation. The generation guard begins only inside `attemptDelivery()` at lines 179-186, after the record is already staged. `clear()` at lines 324-330 invalidates delivery completions and clears current storage, but it neither cancels nor drains an older enqueue's reload/staging work. The real host binding at `apps/web/src/offline/browser-event-queue.ts:14-25` calls `clear().finally(dispose)`, so it inherits this gap.

This is reachable with the web adapter rather than being limited to an artificial store: `apps/web/src/offline/indexeddb-event-store.ts:128-143` awaits database opening before creating and committing the write transaction. Session-end clear may therefore complete while an earlier `put()` is still before its transaction or otherwise unresolved.

Two disposable jsdom/Vitest probes used strict synthetic events, the actual host lifecycle binding and a scoped `OfflineEventStore`:

1. The first held the initial `store.put`, dispatched `lessonquest:session-ended`, waited for the store's clear and queue disposal, confirmed zero records, then released the put. `enqueue()` resolved `QUEUED` and the exact event reappeared with `attempts: 0`.
2. The second held the `list()` used by enqueue's reload, completed the same session-end sequence, then released the list. The old enqueue continued through `store.put`; the exact event again remained after the completed clear.

Both probes expected an empty final scope and failed with one strict record containing organization, assignment, attempt, step and `payload.optionId`. Delivery did not begin after disposal, so stale result events were suppressed; suppressing UI output does not remove the persisted shared-device data.

The durable Attempt 2 remediation cases at `packages/experience-sdk/test/offline-event-queue.test.ts:300-369` and `apps/web/test/offline-queue-e2e.test.tsx:274-345` all wait until delivery has started. They validate success, terminal and retryable completion races correctly, but their first `put()` has already completed before session end and cannot detect either reproduced gap.

Required remediation:

1. Treat reload, capacity/attempt checks, initial staging and delivery as one serialized lifecycle-aware operation. Capture the clear generation before asynchronous work and prevent every stale pre-delivery continuation from writing or reloading local records.
2. Make completion of `clear()` a real barrier: after it resolves, no operation that began in an older generation may persist a record. If an older write can cross the barrier, remove it by exact event ID after that write finishes or drain it before the final scope clear.
3. Add deterministic tests that hold `prune`, `list` and the first `put` in turn, then run direct clear and the actual `lessonquest:session-ended` binding. Verify empty durable scope, no stale result/state emission, no listener resurrection and preservation of unrelated scopes. Retain the existing ordinary-dispose case, where unmount without session end keeps the exact staged record.

### 2. Major — concurrent online enqueue bypasses FIFO and corrupts queue state semantics

The approved design and Task 1 require FIFO delivery. `flush()` serializes work through `flushing` at `packages/experience-sdk/src/offline-event-queue.ts:234-249`, but online `enqueue()` bypasses that gate and calls `attemptDelivery(record, true)` directly at line 299.

A disposable probe started the queue, enqueued event 1 and held its delivery unresolved, then enqueued a different attempt. Before event 1 settled, the observed delivery calls were:

```text
018f72a4-cc52-7c5a-a6f9-8b21aa27c201
018f72a4-cc52-7c5a-a6f9-8b21aa27c202
```

The expected call list at that point contained only the first event. This is global FIFO failure. It also makes state inaccurate: both `attemptDelivery` calls set the single `sending` flag at lines 187 and 228, so whichever settles first sets `sending: false` while the other is still active. Both write the shared `lastAttemptAt`, and retry calculation at line 213 uses that shared value rather than the delivery's own start time.

Required remediation:

1. Route online enqueue through the same single-flight FIFO loop as retry and timer work. An enqueue may await the outcome for its own record, but it must not start delivery except when that record is the current sorted head.
2. Make enqueue/reload/cap/one-pending checks atomic within the coordinator so concurrent calls cannot overwrite `records` or bypass queue invariants.
3. Add concurrent distinct-attempt and same-attempt cases. Hold the head unresolved; prove the later event is not delivered, `sending` stays true, `lastAttemptAt` and backoff belong to the correct delivery, and the per-attempt/cap rules remain intact.

## Prior blocker verification

- **API/auth navigation cache isolation:** the three-width service-preview case passed for `/health` and a cookie-authorized `/organizations/private/report`; neither body replaced `/`. Static inspection confirms navigation method/authorization/origin/API gating at `apps/web/public/service-worker.js:14-18,71-85`.
- **Redirected response safety:** runtime redirect containment passed at all widths. `canCacheResponse` checks the final URL's origin and API path at `apps/web/public/service-worker.js:30-38`, and the same function gates precache, runtime and warming writes at lines 40-49, 71-110. A separate warming probe messaged `CACHE_STATIC_URLS` with `/redirect-static.js`; the current named cache remained without that entry (`warmedRedirectBody: null`) and retained the real HTML root.
- **Named-cache isolation:** the worker consistently opens `lessonquest-shell-2026-09-01-v2`; the foreign-cache sentinel case passed, and activation removes only old `lessonquest-shell-*` names.
- **Embedded organization mismatch:** the SDK removes a foreign embedded organization before delivery at `packages/experience-sdk/src/offline-event-queue.ts:163-173`; the focused SDK case passed.
- **Canonical IndexedDB primary key:** `apps/web/src/offline/indexeddb-event-store.ts:93-121` reads values plus actual primary keys, compares each returned key with the canonical scope/event key, and deletes a mismatch by the actual key. The three-width configured-session case passed with zero active/foreign delivery, deletion of both corrupt active-scope records and preservation of the unrelated valid scope.
- **Delivery-completion clear/dispose races:** all six durable success/terminal/retryable cases passed through direct clear and the actual host binding once delivery was unresolved. The ordinary dispose regression also passed and retained the original staged event. The critical finding above concerns earlier asynchronous phases that those tests do not enter.

## Independent verification evidence

- Hash manifest: **26/26 implementation/test/script files matched** before and after verification; manifest base and branch matched the actual checkout.
- `corepack pnpm check`: **PASS** — ESLint, Prettier, root/web type checks, every workspace build and **37 test files / 379 tests**.
- Focused SDK queue/session/React run: **3 files / 29 tests PASS**.
- `corepack pnpm test:integration`: **7 files / 52 tests PASS**.
- `corepack pnpm test:e2e`: **11 files / 75 tests PASS**.
- `corepack pnpm test:preview`: **33/33 Chromium cases PASS** at 1440×900, 768×1024 and 375×812.
- `corepack pnpm test:browser`: **12/12 Chromium cases PASS** across the same widths.
- `corepack pnpm audit --prod --audit-level high`: **PASS**, no known vulnerabilities.
- `git diff --check d85b10841c333de3bd578f8fdaa2eae0bb117ae4`: **PASS**.
- `pnpm-lock.yaml` and dependency declarations are unchanged. Root `package.json` only adds the checked-in offline React boundary file to `test:e2e`.
- Disposable probe summary: **3/3 adversarial cases failed as findings** — concurrent FIFO, session-end during first put and session-end during enqueue reload. The temporary test was deleted. The separate warming probe passed. Local preview processes were terminated, no production file was changed by the reviewer, and no Firebase, real student data, reference repository/deployment, persistent external database or paid resource was accessed.

Inherited PGlite direct-eval and preview chunk-size warnings remain limited to the documented synthetic development preview and are not the cause of this verdict.

## Gate outcome

Attempt 3 is **FAIL** and must remain preserved. Fix both findings test-first, rerun the full implementer bundle, regenerate the implementation/test/script hash manifest and assign another fresh independent non-implementing reviewer. Delivery remains blocked.
