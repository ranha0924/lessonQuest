# Phase 1 Closeout and Development Preview — Independent Final Review

Date: 2026-08-31. Decision: **82/100 FAIL**. Do not accept, commit the implementation for delivery, merge, push or deploy this candidate. The required score is strictly greater than 85, with no blocking finding. Fix the finding under the implementation gate and obtain a fresh review from another independent agent.

## Independence and reviewed candidate

Reviewer: `/root/phase1_closeout_final_validation`, newly assigned after implementation and not an implementer of this change. I inspected the actual tracked diff from `fe206c1f9f69e10dbc15a7abc656d0b1636ad93d`, every untracked implementation/test/configuration file, the controlling canon and final-review rubric, both approved implementation plans and their pre-implementation reviews, dependency changes and the implementers' evidence. Worktree: `.worktrees/phase1-closeout`; branch: `codex/phase1-closeout`; planning HEAD: `4913f808306fee68d2b63411bd37dde020c217ea` plus its frozen working-tree candidate.

The reviewed 41-file runtime/test/configuration manifest is `dd2bd20bd272baebe22f15cd7e5b13934d2e297359f83d8d186c846db52f0540`. I independently checked every listed file hash before and after verification: **41 matched, zero mismatches**. Documentation changes made by the root during this review do not change that candidate. The later uncertain-hint remediation plan is not implemented in, or credited to, this verdict.

I made no implementation edits, commits, remote changes or deployments. Four temporary adversarial tests used synthetic fixtures and the real React → HTTP client → Hono → repository → PGlite boundary. Their source was preserved at `/tmp/lessonquest-independent-running-hint-probe.test.tsx`, then removed from the worktree. Only this review document is my durable addition.

The user's approved Vercel development-preview expansion is controlling: actual teacher/student components and existing business logic may run inside a browser-controlled, synthetic, memory-only database. This review does not require production authentication, a shared server database or external AI, and does not mistake the browser's synthetic authorization checks for a real security boundary.

## Blocking finding

### P1 — A failed replay does not establish that an earlier disconnected hint finished

Location: `apps/web/src/components/student-play.tsx:246–256`, especially `setHintUncertain(!known)` and clearing the request ID for every nonretryable `LessonQuestApiError`. The repository returns a real `409` for a request that still has `RUNNING` status (`packages/db/src/rasa-repository.ts:151–156`). That response describes the replay, not a terminal outcome of the original provider call.

Reproduction uses no mocked repository results:

1. Start the real student attempt and submit one wrong answer.
2. Forward the hint request into the real Hono app. Wait until the provider is entered, proving preparation committed the `RUNNING` request. Hold the provider on a gate and simulate a disconnected transport while the original server promise continues.
3. The initial unknown error correctly locks answer writes. Click the normal hint retry with the exact request body. The real repository responds `409`; its original row is still `RUNNING`.
4. The catch branch now clears uncertainty and the request ID. The correct-answer button becomes enabled, although the earlier hint can still append learning events.

Two independently reproduced consequences:

- **Completion becomes stuck.** Answering while that control is incorrectly enabled stores `ANSWER_RETRIED` at sequence 2. Releasing the original provider stores `RASA_OPENED` and `HINT_USED` at sequences 3 and 4, without synchronizing the disconnected client. Completion then submits stale sequence 3. Both completion and its exact retry return `409`; no completion is stored. The observed event list was `STARTED:0, QUESTION_ANSWERED:1, ANSWER_RETRIED:2, RASA_OPENED:3, HINT_USED:4`.
- **Retry consumes an extra hint.** If the learner instead waits for the original provider to finish and clicks hint retry, the request body contains a new UUID. The database ends with **2 requests, 2 actions, 2 usage rows and 2 HINT_USED events** instead of one. The first committed hint was never rendered; the subsequent request advances to another level.

Two additional real-boundary cases fail the same required lock assertion. Temporarily disabling membership makes the replay return `404` while the original provider is pending; reactivating it before finalization permits that original request to finish. A database trigger rejecting the replay's conflict audit produces a safe `500` while the original request remains `RUNNING`. Both responses incorrectly unlock answers. These are actual Hono/repository responses, not injected error envelopes.

Required correction: preserve an earlier uncertain request's identity and write lock across responses that do not establish its terminal outcome. A successful exact replay can synchronize sequence and clear it. The explicitly modeled terminal Rasa failure codes can establish a no-hint outcome and retain the separate fresh-request recovery behavior. Add durable tests for `409`, authorization-denied and storage-failure replays while the original request continues, plus terminal-failure replay and successful recovery. Do not solve this by guessing server sequence or discarding a pending learning event.

The current recovery tests at `apps/web/test/phase1-recovery.test.tsx:166–175` wait for `forward()` to finish before dropping a post-commit response. They therefore omit a disconnected response while provider work is still executing. Their passing result does not cover this scenario.

This is a blocking correctness and approved-plan acceptance failure. No separate critical authorization, tenant isolation, secrets or real-student-data exposure was identified in the reviewed scope.

## Independent execution evidence

| Check                                 | Fresh independent result                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                 | Exit 0; **31 files / 332 tests**, lint, formatting, root/web type checks and all workspace/normal web builds passed. Log: `/tmp/lessonquest-independent-closeout-check.log`.                                                                                                                                                                       |
| Four adversarial real-boundary probes | **4 failed / 4**, expected-lock and same-request/single-effect failures described above. Log: `/tmp/lessonquest-independent-running-hint-probe.log`; source preserved under `/tmp` as noted above.                                                                                                                                                 |
| `corepack pnpm test:preview`          | Exit 0; **10 Chromium tests**, desktop and mobile, **20.7 s**. Includes actual Vercel response headers, same-origin WASM/data loading, full authoring and student flow, role switching, correct-first 7 versus retry 8, reset/reload, asset-failure recovery and normal-build exclusion. Log: `/tmp/lessonquest-independent-closeout-preview.log`. |
| `corepack pnpm test:browser`          | Exit 0; **12 Chromium tests**, desktop/tablet/mobile, **20.7 s**. Geometry, critical text contrast, dark surfaces, keyboard focus, fragment links, reduced motion and controlled-fault detection passed. Log: `/tmp/lessonquest-independent-closeout-demo-browser.log`.                                                                            |
| Production dependency audit           | `corepack pnpm audit --prod --audit-level high`, exit 0, **no known vulnerabilities found**. Log: `/tmp/lessonquest-independent-closeout-audit.log`.                                                                                                                                                                                               |
| Candidate containment                 | All **41 file hashes unchanged** after the review; reviewer temporary test removed; `git diff --check fe206c1` exit 0; heuristic private-key/API-token scan of the 41 files found no matches. Log: `/tmp/lessonquest-independent-closeout-secret-scan.json`.                                                                                       |

The root's additional standalone integration and scripted E2E evidence was inspected: **39 tests / 5 files** and **56 tests / 8 files**, respectively. I did not count those as separate independent command executions; their test files are also included in my full 332-test run. jsdom boundary tests and Chromium browser tests are explicitly distinct.

Code inspection and executable evidence support these unaffected controls: exact answer/completion retry bodies, synchronized write refs, immutable boss end request IDs, Rasa generic finalization failure versus actual revocation classification, no false finalization DENIED/CONFLICT audit, fixed hint output, preview-only crypto alias, hash compatibility and UTF-8 limits, default HTTP transport compatibility, immutable synthetic role clients, memory-only runtime with pending-request/projection drain on close, ordinary-build exclusion, and CSP limited to same-origin assets plus WebAssembly without generic unsafe-eval. The preview's large first download and lack of operating authentication/storage/external AI are disclosed. Reference repositories, Firebase and real student data were not used.

Browser acceptance is Chromium-only. Public Vercel assets, deployed SHA, exact-head CI and merged-result verification are deliberately not certified here; delivery must remain blocked by this failed local final gate.

## Final rubric

| Category                                   |      Score | Evidence and deductions                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |  **21/25** | The real synthetic vertical slice and authorized preview expansion are present. Deduct for failure of the explicit uncertain-hint retry, serialized-write and single-effect requirements while a provider is still running.                                                                           |
| Correctness and code quality               |  **12/20** | Most interfaces and recovery paths are coherent; finalization classification is corrected. The replay catch branch conflates a received error with a terminal original request, causing unrecoverable-in-place completion conflict and extra hint consumption.                                        |
| Security, privacy and tenant isolation     |  **20/20** | No new critical exposure identified. Synthetic browser-owner control is explicit; normal builds exclude the development runtime; authorization, fixed rendering, memory isolation and restrictive asset/network policy remain intact within the approved scope.                                       |
| Test and verification evidence             |  **16/20** | Full checks, audit and both Chromium suites independently pass. Four realistic adversarial tests fail because the committed delivery matrix omits an in-progress original request. Chromium and local PGlite limits are accurately stated.                                                            |
| Operability, recoverability and provenance |  **13/15** | Reversible delivery/configuration, memory reset, clear startup failure, pinned dependencies and original synthetic-fixture provenance are present. The reproduced error promises retry while the same in-place completion retry cannot progress; the uncertainty recovery guarantee needs correction. |
| **Total**                                  | **82/100** | **FAIL; not strictly greater than 85. Blocking finding remains.**                                                                                                                                                                                                                                     |

Preserve this failed verdict. A subsequent fix and another independent final review may supersede acceptance status, but must not erase the candidate or failure evidence recorded here.
