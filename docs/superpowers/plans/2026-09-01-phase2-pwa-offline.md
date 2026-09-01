# Phase 2 PWA and offline learning-event implementation plan

> Execute with `superpowers:executing-plans`. Production edits begin only after the recorded plan score is at least 86/100. Use test-first development and a separate non-implementing agent for the final gate.

**Goal:** Add a safe installable shell and exact, account/organization-scoped offline learning-event replay without storing credentials or weakening server authority.

**Design:** `docs/superpowers/specs/2026-09-01-phase2-pwa-offline-design.md`

**Baseline:** `main` at `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`; Node 24.13.0, pnpm 11.24.0, TypeScript 6.0.3, Zod 4.5.2, React, Vite and Playwright already pinned. No dependency change.

## Constraints and exclusions

- Follow `PROJECT_CANON.md`, `INTEGRATION_PLAN_V2.md` §§9/12/14/16, and both mandatory 86-point gates.
- Synthetic data only. Do not access Firebase, a reference repository/deployment, real student data or a persistent production database.
- Queue only strict `ClientLearningEvent` envelopes. Rasa requests, attempt creation, assignment/player reads, invites, content, tokens and server projections stay online/server-owned.
- PWA shell caching never caches authenticated API responses. No Background Sync, credential persistence, push notifications, analytics, new service or paid resource.
- Preserve existing hosts by making durable queue opt-in through a non-secret opaque account-storage key. Preview remains per-tab synthetic PGlite and says so.

## Task 1 — strict queue coordinator and session restoration

Files: create `packages/experience-sdk/src/offline-event-queue.ts` and `packages/experience-sdk/test/offline-event-queue.test.ts`; modify `packages/experience-sdk/src/event-session.ts`, its tests and package export.

- [x] Write queue contract tests first. RED must show the missing module. Cover strict scope key/organization parsing; mismatched event rejection; exact body/event ID retention; FIFO; one pending event per attempt; 20-record cap; 24-hour expiry; 2→4→8→16→32→60 second retry ceiling; no retry before due time; network/retryable retention; terminal removal; success/duplicate removal; subscriber isolation; per-scope clear; dispose cancelling timers/listeners; no mutation of frozen input.
- [x] Define a minimal `OfflineEventStore` port whose methods always take the parsed scope. Define a coordinator that accepts injected `deliver`, `classifyFailure`, `now`, timer and online-listener ports so unit tests are deterministic and browser globals stay out of the SDK.
- [x] Extend `ExperienceEventSessionOptions` with one strict restored pending event. Validate all authority context fields and exact sequence, freeze the restored copy, reuse it for the matching action and reject competing actions. Preserve the existing public method list and hosts without restoration.
- [x] Run the focused SDK tests GREEN and build contracts/SDK.

## Task 2 — IndexedDB adapter and React delivery recovery

Files: create `apps/web/src/offline/indexeddb-event-store.ts`, `apps/web/src/offline/browser-event-queue.ts`, `apps/web/src/components/offline-event-status.tsx` and focused tests; modify `student-play.tsx`, `app.tsx`, standard session bootstrap and preview runtime/mount.

- [x] Write web RED tests with an injected store/queue around real React→HTTP→Hono→PGlite flow. Cover pre-commit and post-commit answer/completion loss, automatic online wake, remount restoration, exact duplicate response, blocked competing writes, stale result after scope/component change, non-retryable permission/lifecycle rejection, current-scope-only clear and preview reset clearing.
- [x] Implement IndexedDB database `lessonquest-offline-v1`, one versioned object store and scoped compound indexes. Parse on write and read, clone values, prune expired records within the exact scope, expose no unscoped application list, and surface safe storage-unavailable/full errors without falling back to localStorage.
- [x] Add `offlineQueueKey?: lqs_<64 hex>` to the host session boundary and `offlineQueue?: OfflineEventQueue` to `StudentPlay`. Standard `App` memoizes one queue per exact key+organization; preview uses a documented synthetic key. The queue uses the current in-memory API authorization only at send time.
- [x] Stage before every start/answer/retry/completion ingestion. Restore the exact queued event on resume, subscribe to matching outcomes, and render an accessible status with pending count, retry action and **이 기기의 대기 기록 지우기**. Never render an event body or option ID. Keep hints online-only.
- [x] Listen for `online` and `lessonquest:session-ended`; the latter clears then disposes the exact current scope. Preview data reset awaits the same clear. Ordinary unmount/reload disposes listeners without clearing records.
- [x] Run focused web/SDK/API tests GREEN, including every existing Phase 1 recovery case.

## Task 3 — installable shell with fail-closed caching

Files: add `apps/web/public/manifest.webmanifest`, `apps/web/public/pwa-icon.svg`, `apps/web/public/service-worker.js`, `apps/web/src/pwa.ts` and tests; modify `index.html`, `main.tsx`, `vercel.json`, preview browser tests and styles as needed.

- [x] Write browser/build RED checks for missing manifest/worker and absent offline reload. Preserve the demo/unconfigured normal-build containment assertions.
- [x] Add Korean manifest metadata, standalone display, theme/background colors and same-origin icon. Register only for configured real sessions and explicit preview. Add explicit `worker-src 'self'` and `manifest-src 'self'` CSP directives.
- [x] Implement a versioned worker: network-first navigation with cached-shell fallback; cache successful same-origin static destinations/runtime assets; reject caching for authorization headers, API paths, non-GET, cross-origin, opaque or non-OK responses; delete only old `lessonquest-shell-*` caches.
- [x] Update Playwright harness to expect exactly the controlled LessonQuest worker in preview. Test online install/controller, manifest/icon MIME, offline reload after warming, static asset recovery, no API response in Cache Storage, real IndexedDB queue recovery offline→online, explicit reset clear, three widths, empty error log and no cross-origin request.
- [x] Confirm normal unconfigured and demo builds do not register a worker. Normal build still excludes PGlite/preview runtime assets.

## Task 4 — verification, independent gate and delivery

Files: update `README.md`, `docs/PHASE2_PROGRESS.md`, `docs/SOURCE_PROVENANCE.md`, `memory/projects/lessonquest.md`, root test scripts and new review records.

- [x] Record original implementation/provenance; no WordQuest file is copied. Document first-visit requirement, 20-event/24-hour bounds, token/content exclusions, logout/reset clearing, online-only operations, preview server-memory limit and recovery actions.
- [x] Run `corepack pnpm check`, focused SDK/web tests, integration, E2E, production dependency audit, legacy demo browser, service preview browser and `git diff --check`. Record exact counts, existing build warnings and any sandbox-only failures separately.
- [x] Freeze the complete implementation/test/script file manifest. Assign a fresh independent agent that did not implement this change to inspect the actual diff and evidence, run relevant checks and score the implementation. Attempt 4 passed at 91/100 with no critical blocker after matching all 26 reviewed files and rerunning the complete verification matrix.
- [ ] After a passing independent gate, commit the exact reviewed tree, push, open a PR, require exact-head CI, confirm main did not move unexpectedly, merge only the passing candidate, synchronize local main, and verify exact-merge main CI plus the existing Git-linked Vercel deployment.
- [ ] On the public URL verify worker/manifest, first online load, offline shell reload, queued synthetic event recovery, session/reset clearing and browser errors. Record exact SHA, CI, deployment and live evidence in the PR body. Do not create a duplicate manual deployment.

## Recovery and completion trace

- Queue failure: disable durable queue for the affected host by omitting its opt-in key; existing in-memory manual retry remains. Clear the current scope from the UI or session-ended event. Records self-expire after 24 hours.
- Worker failure: unregister the LessonQuest worker and remove only `lessonquest-shell-*` caches; revert the delivery to the previous reviewed commit. Server state and schemas are unchanged.
- Lost response: exact event ID/body replay → server accepted/duplicate result → one local acknowledgment. Terminal authority/lifecycle failure → remove local record, show safe re-auth/re-enter guidance, never replay under another scope.
- Requirements trace: event idempotency and bounded exponential retry → Tasks 1–2; account/org/device/session policy → Tasks 1–2; installable/offline shell and cache safety → Task 3; synthetic/no-real-data/provenance/gates/release → Task 4.
