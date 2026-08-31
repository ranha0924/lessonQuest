# Phase 1 Closeout — Independent Final Review, Attempt 2

Date: 2026-08-31. Reviewer: newly assigned independent agent `/root/phase1_closeout_final_validation_2`, not an implementer or the Attempt 1 reviewer.

**Verdict: 85/100 FAIL.** The required score is strictly greater than 85, and a blocking recovery defect remains. Do not accept, commit for delivery, merge, push or deploy this candidate. Preserve the original **82/100 FAIL** in `2026-08-31-phase1-closeout-final-review.md` and this separate verdict.

## Candidate and review scope

- Worktree: `.worktrees/phase1-closeout`; branch `codex/phase1-closeout`.
- Base: `fe206c1f9f69e10dbc15a7abc656d0b1636ad93d`; planning HEAD: `4913f808306fee68d2b63411bd37dde020c217ea` plus the tracked and untracked candidate.
- Frozen runtime/test/tooling manifest: **41 files**, digest `c9edc4ecd97b5f18e8250e38b21a43edcd805687c13375816d9e5f3f7c2f5776`, recorded in `/tmp/lessonquest-closeout-candidate-2-manifest.json`. All 41 file hashes matched before and after independent execution.
- Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the project-memory final rubric, the closeout and development-preview plans/reviews, the 99-point uncertain-hint replay remediation plan/review, Attempt 1, and implementation evidence. Inspected the complete base diff and every new untracked runtime/test/configuration file, including dependencies, CI, documentation, crypto, assets, runtime lifecycle, HTTP transport, client locks and Rasa audit/status handling.
- Scope remains the actual teacher/student components → HTTP client → Hono → repositories → synthetic PGlite and deterministic Rasa. The preview executes those components and services in one browser tab under browser-owner control; operating authentication, server persistence, external AI, real students and Firebase remain excluded.
- No implementation was changed by this reviewer. Temporary test copies were removed after execution; probe sources remain under `/tmp`. Later planning-only documents do not change this frozen candidate or certify a proposed correction.

## Blocking finding

### P1 — Student remount or preview role switch discards an unresolved hint and exposes stale writes

Locations:

- `apps/web/src/components/student-play.tsx:37–47`: uncertainty, request identity and write locks live only in the component.
- `apps/web/src/components/student-play.tsx:80–118`: resume creates a new session from the returned sequence and committed hint list without reconciling an outstanding hint.
- `apps/web/src/dev-preview/development-preview.tsx:63–65`: switching away from the student unmounts that component; returning creates a fresh one.
- `packages/db/src/learning-repository.ts:917–924` and `:311–330`: an existing attempt is resumed without pending-hint containment; the hint query includes only `SUCCEEDED` requests.

Two independent real-boundary probes reproduced the defect, one with a direct StudentPlay remount and one using the actual DevelopmentPreview teacher/student role buttons. Both use real API clients, Hono, authorization, repositories and PGlite. The deterministic provider is held behind a controlled promise, and the transport disconnects after provider work begins; no repository result or HTTP error is fabricated.

Reproduction:

1. Start the assignment and submit an incorrect answer. Request a hint and detach its response while the provider continues; the persisted request is `RUNNING`. The first StudentPlay correctly disables answer writes.
2. Remount StudentPlay, or select **교사 화면 → 학생 화면**, then select **이어하기** before releasing the provider.
3. The real resume succeeds while the hint is still `RUNNING`. The new component enables **질량 2 kg 선택** and accepts `ANSWER_RETRIED` at sequence 2.
4. Release the original provider. It succeeds and appends `RASA_OPENED` at sequence 3 and `HINT_USED` at sequence 4. Its original disconnected/unmounted component cannot synchronize the new session.
5. **탐험 완료** sends stale sequence 3 and receives `409`; **기록 다시 전송** repeats the same stale event and receives `409` again. No completion is stored.

Both probes observed exactly:

```text
EXPERIENCE_STARTED:0
QUESTION_ANSWERED:1
ANSWER_RETRIED:2
RASA_OPENED:3
HINT_USED:4
completion statuses: [409, 409]
requests/actions/usage/HINT_USED/RASA_OPENED: 1/1/1/1/1
```

Evidence: `/tmp/lessonquest-independent-attempt2-remount-probe.test.tsx` and `/tmp/lessonquest-independent-attempt2-probes.log`. The probe asserts the safe lock and then continues through the incorrectly enabled control to establish the practical failure. Both fail on the unlocked answer and missing completion, not on harness setup.

The approved closeout promises serialized writes, safe ambiguous-delivery recovery and server-owned resume. The new preview makes the relevant unmount available through an ordinary role control. The new durable RUNNING replay cases keep the original component mounted (`apps/web/test/phase1-recovery.test.tsx:63–115`); they therefore do not cover this lifecycle. Existing successful remount tests wait for hint completion first.

Required correction: retain a safe server-owned boundary when resuming an attempt with an unresolved hint, or reconcile its exact pending identity before exposing player writes. Resume rejection until the operation reaches a terminal state is a possible bounded approach, but it requires a separately approved plan and executable proof. Keep authority checks first, preserve tenant scope, do not guess sequence or claim cancellation, and prove both eventual success and terminal-failure recovery. A stranded `RUNNING` row after storage failure must remain fail-closed rather than being assumed complete. No proposed fix is accepted by this review.

This is a blocking correctness and approved-plan failure. No additional critical authorization, tenant isolation, secret or real-student-data exposure was found in the reviewed scope.

## Independent execution evidence

| Check                                           | Fresh independent result                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                           | Exit 0; **31 files / 336 tests**, ESLint, Prettier, root/web type checks and all workspace/normal web builds passed. Test duration 58.47 s. `/tmp/lessonquest-independent-attempt2-check.log`.                                                                                                                                                                                           |
| Attempt 1 probes, unmodified                    | **4/4 passed**. The earlier real 409/404/500 replay locks and original-request single-effect recovery are repaired. Source `/tmp/lessonquest-independent-running-hint-probe.test.tsx`; combined output `/tmp/lessonquest-independent-attempt2-probes.log`.                                                                                                                               |
| New terminal-outcome probes                     | **3/3 passed**. A previously disconnected request's exact replay correctly resolves `REJECTED`, `TIMED_OUT` and finalization `FAILED`; controls recover, immutable terminal evidence remains, and a fresh UUID obtains the same-level hint once. `/tmp/lessonquest-independent-attempt2-terminal-probe.test.tsx`; combined log above.                                                    |
| New lifecycle probes                            | **2/2 failed**, direct remount and actual preview role switch; both produce `[409,409]` completion failures as described above. Combined probe run: **7 passed / 2 failed**, 3 files, 6.33 s.                                                                                                                                                                                            |
| `corepack pnpm test:preview`                    | Exit 0; **10 Chromium cases**, desktop/mobile, **20.2 s**. Real authoring/approval/sandbox/assignment/student/teacher flow, first-correct 7 versus retry 8, same-origin WASM/data checks, reset/reload, startup failure recovery, reset during write and normal-build exclusion passed with the checked-in Vercel response headers. `/tmp/lessonquest-independent-attempt2-preview.log`. |
| `corepack pnpm audit --prod --audit-level high` | Exit 0, **no known vulnerabilities found**. `/tmp/lessonquest-independent-attempt2-audit.log`.                                                                                                                                                                                                                                                                                           |
| Containment and whitespace                      | All 41 runtime/test/tooling hashes unchanged; temporary workspace probes removed; full-base whitespace check clean. Heuristic private-key/cloud-token scan of the 41 files found no matches. `/tmp/lessonquest-independent-attempt2-secret-scan.json`.                                                                                                                                   |

The root's remediated standalone integration and E2E logs were inspected: **39 tests / 5 files** and **60 tests / 8 files**. These files are included in my independent full-check run; I did not count them as separate independent commands. The root's remediated **12-case demo Chromium pass** and Attempt 1 reviewer's independent 12-case demo pass were inspected, but this reviewer did not rerun the unchanged demo suite. jsdom real-boundary probes are distinguished from Chromium acceptance.

Unaffected controls supported by code inspection and the passing checks include exact answer/completion retries, same-mounted-component uncertain hint locking, finite terminal-code recovery, retained boss-end identities, accurate generic finalization failure versus actual revocation, transactional rollback and allowlisted diagnostics, teacher validation/approval and fixed hint rendering, fixed synthetic role clients, strict preview transport origin, preview-only crypto alias and SHA-256/UTF-8 compatibility, memory-only runtime and pending transport/projection drain, startup asset failure recovery, normal-build exclusion, and a CSP permitting same-origin assets/WebAssembly without general unsafe-eval. The large initial asset download and lack of operating-service security/storage are disclosed. Reference repositories, Firebase and real student data were not used.

Chromium-only browser coverage, local PGlite concurrency, and synthetic fault injection remain explicit limits. Merged-tree verification, exact-head remote CI, deployed SHA/status, public assets and a live deployed interaction are **not certified** here; delivery remains blocked by this failed local gate.

## Final rubric

| Category                                   |      Score | Evidence and deductions                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |  **22/25** | The approved synthetic vertical slice and requested real-UI preview are present; the first replay defect is fixed. Deduct for the remaining unresolved-hint resume/role-switch violation of serialized-write and recoverability requirements.                                   |
| Correctness and code quality               |  **13/20** | Main interfaces, failure classification and retained-request behavior are coherent. Component-local uncertainty does not survive the exposed lifecycle, and the resume boundary allows a new session to race an existing hint into repeated stale completion conflicts.         |
| Security, privacy and tenant isolation     |  **20/20** | No new critical exposure found; actual authorization checks, synthetic-owner warning, memory isolation, fixed rendering, narrow preview crypto/network policy and normal-build exclusion remain intact within scope.                                                            |
| Test and verification evidence             |  **17/20** | Full checks, audit and preview Chromium independently pass; original adversarial failures and all terminal codes now recover. Two additional realistic lifecycle cases fail, revealing a missing durable acceptance path. Browser-engine and local-storage limits are explicit. |
| Operability, recoverability and provenance |  **13/15** | Clear synthetic startup/reset/containment, pinned dependencies, CI and original fixture provenance; no migration. In-place completion retry cannot recover from the reproduced role-switch sequence race, so the recovery claim remains incomplete.                             |
| **Total**                                  | **85/100** | **FAIL: not strictly greater than 85; blocking finding remains.**                                                                                                                                                                                                               |

The reviewer has not changed the implementation. Fixes require the new plan gate, TDD and another independent final validation of the complete resulting candidate. Keep both failed review attempts and their evidence.
