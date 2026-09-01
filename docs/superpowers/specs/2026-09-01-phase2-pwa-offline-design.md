# Phase 2 PWA and offline learning-event design

## Scope

This is the next bounded Phase 2 unit after classrooms and invitations. It adds an installable app shell and a durable, bounded browser queue for client learning events. It does not make the synthetic Vercel preview a production service, cache authenticated API responses, store an auth token, queue Rasa/provider requests, connect Firebase, import real users, or migrate real data.

The controlling requirements are `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md` §§9, 12, 14 and 16, and the mandatory gates in `memory/projects/lessonquest.md`. The server remains authoritative: the browser resends the exact `ClientLearningEvent`; it never invents correctness, damage, a learner identity, or a new event ID during recovery.

## Durable queue boundary

`@lessonquest/experience-sdk` owns a platform-neutral queue coordinator. A storage port persists strict `ClientLearningEvent` envelopes and delivery metadata. The web package supplies an IndexedDB adapter. Production and preview hosts opt in with a stable opaque `lqs_<64 lowercase hex>` account-storage key plus the current organization UUID. The key is not an auth token or a user-facing identifier. Normal hosts that do not supply the key retain the current memory-only behavior.

Each record is scoped by `(accountStorageKey, organizationId, eventId)`. Reads and clears require the exact scope. The adapter never offers an unscoped list API to application code. Queue input is reparsed with the shared event schema and must match the scoped organization. A scope may hold at most 20 events; records expire after 24 hours. Old records are pruned on open and enqueue. The stored value contains the event, created time, attempt count and next retry time. It contains no bearer token, answer correctness, title, hint text, generated content, student profile or diagnostics.

The queue stages the exact event before delivery. On success or an exact server duplicate, it deletes the record and emits the authoritative ingestion result. Network failures and explicitly retryable API failures retain the record and schedule 2, 4, 8, 16, 32 then at most 60 second retries. The browser `online` event wakes due work while the page is open. Non-retryable authorization, tenant, lifecycle, validation or sequence responses delete the rejected record and fail closed; no event is moved to another account or organization. Concurrent tabs may resend the same envelope, which is safe because the server already enforces `(organizationId, eventId)` idempotency. The queue does not use Background Sync because doing so would require durable credentials.

## Player recovery

`StudentPlay` accepts an optional queue. Existing tests and hosts remain compatible when it is absent. With a queue, start/answer/retry/completion events are staged before ingestion. The UI exposes only counts and recovery actions, never the event body. A queued event blocks competing writes for that attempt. A fresh component instance restores that exact pending envelope, and `createExperienceEventSession` validates the restored context and sequence before allowing acknowledgment. A lost response is resolved by replaying the same event ID; the server's duplicate result advances the session once.

Automatic delivery results are applied only when they match the mounted attempt and pending event. Late results after an account, organization, assignment or component change are ignored by that UI. Server state remains the recovery authority on the next attempt resume. An explicit device-clear action removes only the current scope. The host dispatches `lessonquest:session-ended` before removing a login session; the app then clears and disposes the current queue. Preview **data reset** performs the same scope clear. Component unmount and ordinary reload do not clear, because those are recovery cases.

## PWA shell boundary

The web app adds a manifest, same-origin SVG icon and a dependency-free service worker. Registration occurs only for the real session host or the explicit development preview, never the static design demo or an unconfigured normal page. The worker caches the navigation shell and successful same-origin static assets after an online visit. It never caches requests with `Authorization`, non-GET requests, `/organizations/` or `/health` API paths, cross-origin responses, opaque responses, or error responses. Versioned activation removes only LessonQuest-owned old caches.

The shell can reopen offline after one successful online load. The development preview still recreates its in-memory PGlite database on reload, so its offline reload demonstrates shell availability rather than durable server data. Actual queued-event replay across reload requires a persistent API host and a re-established login session. This limit is shown in documentation and is not presented as production offline readiness.

## Acceptance

- Strict unit tests prove scope isolation, exact replay, FIFO order, cap/expiry, deterministic exponential backoff, duplicate-safe delivery, terminal deletion and clear/dispose behavior.
- Event-session tests reject a restored envelope with a different organization, assignment, attempt, experience, version or sequence and acknowledge an exact restored event once.
- Web tests prove IndexedDB shape/scoping without tokens and React recovery across remount, response loss, offline/online wake, authority rejection, account/organization change and explicit session/reset clearing.
- Browser tests prove manifest/icon/worker delivery, no API caching, offline shell reload after first online load, an actual queued answer recovering through IndexedDB, and retained keyboard/layout/theme checks at all configured widths.
- Normal unconfigured and demo builds do not register the worker or load the preview database. No dependency, server schema, persistent database migration, Firebase, real identity/data, reference repository or paid resource changes are permitted.
