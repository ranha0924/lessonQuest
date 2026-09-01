# Phase 2 PWA and offline learning-event final review — Attempt 2

Date: 2026-09-01
Reviewer: fresh independent non-implementing agent
Base: `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`
Candidate: uncommitted tree on `codex/phase2-offline-queue`, identified by `/tmp/lq-phase2-offline-implementation-hashes.json`

## Decision

**FAIL — 82/100. Critical session-end privacy/recoverability blocker remains. Do not commit, merge or deploy this candidate.**

The Attempt 1 cache-safety and embedded-organization findings are fixed and have durable coverage. Fresh checks passed all 372 tests, focused queue/session/React coverage, both browser matrices, E2E, integration, audit and diff validation. The reviewed queue can nevertheless recreate a learning-event record after the host has completed the documented session-end clear. A retryable delivery that settles after `clear()` and `dispose()` writes the event back to durable storage. This violates the shared-device logout boundary and the approved requirement that session end clears the exact account/organization scope. An additional corrupted-primary-key probe shows that the IndexedDB adapter can retain and repeatedly recreate a malformed current-scope record. The critical session-end failure blocks acceptance regardless of the numerical score.

## Rubric

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Manifest, opt-in durable queue, exact replay, bounded retention/backoff, restoration, terminal deletion, PWA containment and preview limitations match the approved design. Session-end clearing is not durable when a retryable send is already in flight, and malformed primary-key tuples are not rejected on read.                                                                                                                                  |
| Correctness and code quality                |      15/20 | SDK/store/web boundaries, strict event parsing, FIFO behavior, subscriber isolation and Attempt 1 remediation are clear. `attemptDelivery` can persist after a concurrent clear/dispose, and adapter read validation omits the canonical primary-key relationship, allowing one corrupt input to become two durable records.                                                                                                                            |
| Security, privacy, and tenant isolation     |      15/20 | API/authenticated navigation bodies, redirected cross-origin responses and embedded foreign-organization events now fail closed. Tokens, correctness, content, hints and profiles are not stored; unrelated scopes remain isolated. The reproduced post-session re-persistence leaves assignment, attempt and answer-option learning data on a device after the host has declared the session ended, so the shared-device privacy boundary still fails. |
| Test and verification evidence              |      18/20 | Fresh full, focused, integration, E2E, demo and 33-case service-preview matrices all passed. The three Attempt 1 regressions are durable and effective. Existing session-end coverage clears only an idle queued record and does not overlap clear/dispose with an unresolved send; IndexedDB corruption coverage checks the embedded organization but not the canonical primary key.                                                                   |
| Operability, recoverability, and provenance |      13/15 | Rollback is client-contained, normal/demo hosts remain contained, dependency/audit/diff/provenance evidence is clean and synthetic-preview limits are candid. Logout/reset is documented as a reliable device-clear recovery action, but that action is not reliable during an in-flight failure; malformed keys can also cause repeated replay across starts until an explicit scope clear.                                                            |
| **Total**                                   | **82/100** | **Fails the required score and critical-blocker gate.**                                                                                                                                                                                                                                                                                                                                                                                                 |

## Findings

### 1. Critical — an in-flight retryable failure can re-persist an event after session-end clearing

`packages/experience-sdk/src/offline-event-queue.ts:185-205` awaits delivery and unconditionally calls `store.put` for a retryable failure. `clear()` at lines 308-312 clears storage and local records without invalidating an in-flight delivery. `dispose()` at lines 314-320 prevents future scheduling and notifications, but the catch path does not recheck `disposed` or whether a clear generation changed before writing. The real host lifecycle at `apps/web/src/offline/browser-event-queue.ts:14-20` calls `queue.clear().finally(() => queue.dispose())`, so it has this exact race.

A fresh disposable SDK probe against the reviewed build performed this sequence:

1. enqueue one strict current-scope event while online and hold `deliver` unresolved;
2. wait until `queue.getState().sending` is true;
3. await `queue.clear()`, call `queue.dispose()`, and confirm the store is empty;
4. reject the held delivery with a retryable network error and await `enqueue`.

Observed output:

```text
after-clear 0
enqueue-result { status: 'QUEUED' }
after-reject 1 018f72a4-cc52-7c5a-a6f9-8b21aa27c201
```

The recreated strict event contains organization, assignment, attempt, step and answer option data. It has no bearer token, but retaining it after logout contradicts the documented shared-device clear policy and can expose one learner's pending record to the next session on that device.

Required remediation:

1. Make `clear()` invalidate pending delivery completions before or atomically with storage clearing. A retryable catch from an older generation must never call `put` after the clear has completed.
2. Define and test the completion semantics of `clear()` and session end while success, terminal failure and retryable failure are each unresolved. After the clear promise resolves, every case must leave the exact scope empty and must not emit a stale result into a later session.
3. Add the same overlap through `bindOfflineQueueSessionLifecycle`, not only a coordinator-only unit case.

### 2. Major — IndexedDB read validation does not enforce the canonical primary key

`apps/web/src/offline/indexeddb-event-store.ts:93-109` reads values and primary keys together, but validation checks only the stored account key, stored organization and embedded event organization. It never requires the primary key to equal `key(scope, record.event.eventId)`. Later `remove()` at lines 146-152 deletes only that computed canonical key.

A fresh disposable Chromium probe seeded one otherwise strict current-scope record whose primary key was `corrupt-primary-key`, then started a configured queue. The retry path accepted the record and wrote the canonical key while leaving the corrupt source intact. The database contained:

```json
[
  { "key": "corrupt-primary-key", "attempts": 0 },
  {
    "key": "lqs_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff:018f72a4-cc52-7c5a-a6f9-8b21aa27c101:018f72a4-cc52-7c5a-a6f9-8b21aa27c201",
    "attempts": 1
  }
]
```

This does not cross an organization boundary, and an exact-scope clear deletes both records through the index. It does allow corrupted same-origin storage to trigger repeated duplicate delivery and record growth across starts, contrary to the declared `(accountStorageKey, organizationId, eventId)` record boundary.

Required remediation:

1. Compare every returned primary key with the canonical key derived from the parsed scope and embedded event ID; delete a mismatch by its actual primary key without delivery.
2. Add a real IndexedDB regression proving malformed primary keys are removed, no delivery occurs and unrelated valid scopes remain untouched.

## Attempt 1 remediation verified

- `apps/web/public/service-worker.js:14-38` applies method, authorization, same-origin and API-path checks to navigation/static requests and validates the final response URL before install, runtime or warming writes.
- The current named cache is used for reads and writes; activation removes only stale `lessonquest-shell-*` caches.
- The durable three-width browser case passed for `/health`, cookie-authenticated `/organizations/private/report`, a same-origin static redirect to the CORS test origin, and the preserved offline root shell.
- `packages/experience-sdk/src/offline-event-queue.ts:161-170` removes an embedded foreign-organization record before delivery.
- `apps/web/src/offline/indexeddb-event-store.ts:86-120` deletes malformed or embedded-organization-mismatched active-scope records by their actual returned primary keys. The real browser case passed with zero foreign delivery and an empty active scope.
- Storage inspection and static review found no bearer token, authorization value, correctness, title, hint, generated content or student profile in durable records. The only credential-pattern scan match was the intentionally synthetic `dev_...` authorization in a browser test fixture.

## Independent verification evidence

- Hash manifest: **26/26 reviewed implementation/test/script files matched**, with the expected base and branch and zero mismatches before and after verification.
- `corepack pnpm check`: **PASS** — ESLint, Prettier, root/web type checks, every workspace build and **37 test files / 372 tests**.
- Focused queue/session/React run: **3 files / 22 tests PASS**.
- `corepack pnpm test:integration`: **7 files / 52 tests PASS**.
- `corepack pnpm test:e2e`: **11 files / 72 tests PASS**.
- `corepack pnpm test:preview`: **33/33 Chromium cases PASS** at 1440×900, 768×1024 and 375×812, including the Attempt 1 cache and organization-corruption remediations.
- `corepack pnpm test:browser`: **12/12 Chromium cases PASS** across the same widths.
- `corepack pnpm audit --prod --audit-level high`: **PASS**, no known vulnerabilities.
- `git diff --check d85b10841c333de3bd578f8fdaa2eae0bb117ae4`: **PASS**.
- `pnpm-lock.yaml` and dependency declarations are unchanged; `package.json` only adds the checked-in offline E2E file to the root E2E script.
- The two additional probes used synthetic UUIDs/data and disposable local processes only. The preview-server process was terminated, no repository implementation file was changed, and no Firebase, real student data, reference repository/deployment, persistent external database or paid resource was accessed.

Inherited PGlite direct-eval and preview chunk-size build warnings remain limited to the documented synthetic development preview and are not the cause of this verdict.

## Gate outcome

Attempt 2 is **FAIL** and must remain preserved. Fix both findings test-first, rerun the full implementer verification, regenerate the 26-file implementation/test/script manifest, and assign another fresh independent non-implementing reviewer. Delivery remains blocked.
