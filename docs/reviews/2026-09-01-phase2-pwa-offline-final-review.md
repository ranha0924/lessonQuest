# Phase 2 PWA and offline learning-event final review — Attempt 1

Date: 2026-09-01
Reviewer: independent non-implementing agent
Base: `d85b10841c333de3bd578f8fdaa2eae0bb117ae4`
Candidate: uncommitted tree on `codex/phase2-offline-queue`, identified by `/tmp/lq-phase2-offline-implementation-hashes.json`

## Decision

**FAIL — 80/100. Critical cache-safety/privacy blocker remains. Do not commit, merge or deploy this candidate.**

The durable event queue, exact replay path, session/reset containment and ordinary regression suite are strong. However, the service worker caches responses that the approved design explicitly excludes. A same-origin API navigation can replace the cached application shell with an API body, and a same-origin static request that redirects to another origin can persist that cross-origin response. The first probe also demonstrated an authenticated organization response being exposed as the offline root document. This violates the approved fail-closed cache boundary and is a critical blocker regardless of the numeric score.

## Rubric

| Category                               |      Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements and scope coverage        |      20/25 | The manifest, opt-in queue, exact event replay, bounded retention/backoff, online-only exclusions and preview limitation match the approved scope. The worker does not satisfy the explicit requirements to exclude `/health`, `/organizations/` and cross-origin responses in every fetch mode.                                                                                                               |
| Architecture and interface quality     |      16/20 | SDK/store/web boundaries are clear, the current named cache is used consistently, and configured-session asset warming is present. Cache eligibility is split so the navigation path bypasses API-path checks and response eligibility does not verify origin. Reloaded durable records are also trusted without rechecking the event organization against the queue scope.                                    |
| Security, privacy and tenant safety    |      12/20 | Tokens are not written to IndexedDB, scope keys are opaque, terminal authority failures are deleted, and server authority remains intact. The reproduced API-body cache disclosure is a critical privacy/integrity failure. A malformed scoped durable record can also cause a foreign-organization envelope to be submitted, although server authorization still prevents an unauthorized cross-tenant write. |
| Test and verification quality          |      18/20 | Test-first evidence is credible and fresh independent runs passed 371 tests, 21 focused cases, 72 E2E cases and 30 Chromium preview cases. Existing cache assertions inspect request URLs and ordinary assets but do not exercise API navigations, authenticated navigation bodies or same-origin-to-cross-origin redirects, so they miss the blocker.                                                         |
| Execution readiness and recoverability |      14/15 | The plan, provenance, rollback boundary, preview limitations, no-dependency result and 26-file hash manifest are actionable. Release readiness is withheld until the critical paths have durable RED/GREEN coverage, fresh hashes and a new independent review.                                                                                                                                                |
| **Total**                              | **80/100** | **Fails the required score and critical-blocker gate.**                                                                                                                                                                                                                                                                                                                                                        |

## Findings

### 1. Critical — API and cross-origin responses can enter the LessonQuest shell cache

`apps/web/public/service-worker.js:8` defines the API-path exclusion, but the navigation branch at `apps/web/public/service-worker.js:52` checks only the authorization header and request method. It never calls `isApiPath` or `canCacheRequest`; every successful navigation response is written under the cache key `/` at line 60. `canCacheResponse` at line 24 checks status/type but not `response.url` origin, so the static branch at lines 68–78 also accepts a CORS response reached through a same-origin redirect.

Fresh disposable Chromium probes against the exact reviewed worker reproduced all of the following:

- Navigate to same-origin `/health` returning `SENSITIVE HEALTH SENTINEL`: the current `lessonquest-shell-2026-09-01-v1` cache entry for `/` became that sentinel, and offline navigation to `/` returned it.
- Set a same-origin session cookie, then navigate to `/organizations/private/report` returning `{"student":"private"}`: the cached `/` body and later offline root both returned that organization response.
- Fetch same-origin `/foo.js` that redirects to a CORS-enabled external origin: `/foo.js` was cached with body `CROSS_ORIGIN_STATIC`, final response URL on the external origin, and response type `cors`.

The checked-in test at `tests/browser/service-preview.spec.ts:123` proves current-cache isolation and ordinary offline reload, while its API assertion at line 178 only checks cached request URL paths. Because the navigation branch stores the API body under `/`, that assertion passes despite the disclosure. These results directly contradict the design statement that the worker never caches `/health`, `/organizations/`, API or cross-origin responses.

Required fix:

1. Apply the API/authorization/same-origin request gate before the navigation branch can cache or serve a fallback. API paths must remain network-only and must never replace `/`.
2. Require the final response URL to remain on `self.location.origin` before any cache write, including redirects and warming.
3. Add durable browser RED/GREEN cases for `/health`, an authenticated `/organizations/...` navigation, and a same-origin static URL redirected to a CORS-enabled external origin. Assert both body absence and that offline `/` remains the real shell.

### 2. Major — reloaded durable records do not fail closed on organization mismatch

`apps/web/src/offline/indexeddb-event-store.ts:64` strips storage metadata and validates only the event record schema; the scoped list at lines 77–89 does not compare `record.event.organizationId` with the requested scope. The coordinator reload at `packages/experience-sdk/src/offline-event-queue.ts:161` reparses the record but likewise does not enforce that equality before scheduling delivery.

A fresh platform-level probe supplied a strict stored record indexed under organization `018f72a4-cc52-7c5a-a6f9-8b21aa27c101` whose event organization was `018f72a4-cc52-7c5a-a6f9-8b21aa27c999`. `queue.start()` submitted the foreign organization envelope. Normal writes prevent this mismatch and the server still reauthorizes it, so this did not demonstrate an authorization bypass. It does violate the approved fail-closed rule that records are never moved or replayed across an account/organization scope and leaves corrupted or same-origin-tampered IndexedDB data trusted too far.

Required fix:

1. Revalidate every loaded event against the coordinator scope before delivery; fail closed by removing or rejecting a mismatched current-scope record without calling `deliver`.
2. Keep the adapter-level metadata/event comparison as defense in depth.
3. Add a real IndexedDB test whose index metadata matches the active scope but whose embedded event organization differs; prove zero delivery and preservation of unrelated valid scopes.

## Independent verification evidence

- Hash manifest: **26/26 files matched**, zero mismatches; base and branch fields matched the reviewed candidate.
- `corepack pnpm check`: **PASS** — lint, formatting, type checks, all workspace builds, **37 test files / 371 tests**.
- Focused SDK/session/React queue run: **3 files / 21 tests PASS**.
- `corepack pnpm test:e2e`: **11 files / 72 tests PASS**, including the real React → HTTP → Hono → PGlite queue boundary.
- `corepack pnpm test:preview`: **30/30 Chromium tests PASS** at 1440×900, 768×1024 and 375×812, including named-cache isolation and configured-session asset warming.
- `corepack pnpm audit --prod --audit-level high`: **PASS**, no known vulnerabilities.
- `git diff --check d85b10841c333de3bd578f8fdaa2eae0bb117ae4`: **PASS**.
- Dependency lockfile and package dependency declarations are unchanged; the root package script only adds the new checked-in E2E file. No Firebase, real student data, reference repository, schema/migration or paid resource was accessed.

The direct PGlite `eval` and large preview-chunk build warnings are inherited and remain limited to the explicitly synthetic development preview. They did not cause this verdict.

## Gate outcome

Attempt 1 remains preserved as **FAIL**. Fix both findings test-first, regenerate the complete implementation/test/script hash manifest, rerun the full verification bundle and assign a fresh independent reviewer. The current candidate cannot proceed to delivery.
