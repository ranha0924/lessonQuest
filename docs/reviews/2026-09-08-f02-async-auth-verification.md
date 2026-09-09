# F02 asynchronous authentication verification

Implementation began 2026-09-08; verification continued after host resume on 2026-09-09 KST. Base `fe20d4b1d93612ec381996bb856b5a38e0e45ae9`, branch `codex/f02-live-authoring`. Scope is the async-auth compatibility prerequisite, not the full F02 or live Firebase/PostgreSQL/OpenAI connection.

## Change and TDD evidence

The auth package now exports a structural `AuthProvider` that can return a synchronous Actor or Promise<Actor>. LocalAuthProvider implements it without behavior changes. Hono awaits resolution before setting its request-scoped actor and invoking protected operations.

The new real HTTP/PGlite suite observes a pending verifier without writes, successful resolved ownership, a safe rejected-verifier 401 without writes, and reverse-order concurrent verification with distinct owners.

- Clean F01 baseline: 44 files / **473 tests PASS** (`/tmp/lessonquest-f02-baseline.log`).
- RED, before production edits: **3 tests FAIL**; expected 201/401 became 400 because the repository received a Promise as actor (`.verification/f02-async-auth-red.log`).
- Initial GREEN exposed an incorrect new cache-header expectation on `/organizations`; the existing no-store middleware only applies to F01 routes. The unrelated assertion was removed as explained in the plan review, without changing caching behavior.
- Focused GREEN: auth, API and new async-auth suites **25 tests PASS**, exit 0 (`.verification/f02-async-auth-green.log`).
- Full lint initially caught `expect.any(String)`'s untyped assignment in the new test. The assertion now uses the real response trace header and verifies trace correlation. Production behavior did not change.

## Implementer checks

| Command                                             | Result                                                     | Evidence                                               |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `corepack pnpm check`                               | Exit 0: lint, formatting, types, **476 tests**, all builds | `.verification/f02-check.log`                          |
| `corepack pnpm test:integration`                    | Exit 0: **80 tests**                                       | `.verification/f02-test-integration.log`               |
| `corepack pnpm test:e2e`                            | Exit 0: **80 tests**                                       | `.verification/f02-test-e2e.log`                       |
| `corepack pnpm test:browser`                        | Exit 0: **12 tests**                                       | `.verification/f02-test-browser.log`                   |
| Initial `corepack pnpm test:preview`                | Exit 1: **34 passed / 8 timed out** during host sleep      | `.verification/f02-test-preview.log`                   |
| Rerun `caffeinate -i corepack pnpm test:preview`    | Exit 1: **40 passed / 2 timed out**; host slept again      | `.verification/f02-test-preview-awake-rerun.log`       |
| Resumed `caffeinate -di corepack pnpm test:preview` | Exit 0: **42 passed (1.7m)** on 2026-09-09                 | `.verification/f02-test-preview-resume-2026-09-09.log` |
| `corepack pnpm audit --prod`                        | Exit 0: no known vulnerabilities                           | `.verification/f02-audit.log`                          |
| `git diff --check` and changed-doc Prettier check   | Exit 0                                                     | Controller command output                              |

The failed initial preview run is preserved, not reclassified as a pass. The independent reviewer found host `Clamshell Sleep` beginning 2026-09-08 14:03:25 KST, followed by intermittent short DarkWake cycles during that run. A 60-second test could span 16–17 minutes of wall time. Evidence: `.verification/f02-async-auth-independent-host-sleep.log`, plus the preserved initial failure copy `.verification/f02-async-auth-independent-preview-initial-failure.log`. The new run uses identical test code and timeouts with command-scoped idle-sleep prevention; it does not bypass lid sleep or alter persistent system settings.

The second run also overlapped host sleep: 2026-09-09 00:26:16–00:31:16 (300 seconds) and 00:32:04–00:48:11 (967 seconds), matching the two failed test intervals. The independent reviewer preserved this in `.verification/f02-async-auth-independent-host-sleep-rerun.log`. Both runs remain failures as executed. After the user resumed work on 2026-09-09, the third run passed all 42 tests in 1.7 minutes, exit 0, with command-scoped display/idle-sleep prevention. No runtime code, test code, or timeout changed between runs. The independent reviewer must reassess this new evidence before assigning acceptance.

## Frozen runtime/test manifest

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `packages/auth/src/provider.ts`        | `17ce05022e90c9a0e58c93a1613093e1122bbbcf71f3022886ff098adc491d01` |
| `packages/auth/src/index.ts`           | `87ed6e728e1c1c057cdd4a5b1dcb2333cd1558e9718db7d828b8e3b55ea74926` |
| `packages/auth/src/local-auth.ts`      | `5eb89f2265cad80507d4d56c2d5b3bf1b39de0e8a476ec6276bb8487a65bcea6` |
| `services/api/src/app.ts`              | `113b07508d918dc5657987741e7b29b71d4a6eba01735de485085745e4adca44` |
| `services/api/test/async-auth.test.ts` | `de6a73e2797146ae3ccbeff5cc92643df5f1cb06a56adcf4a7132e57bff194a3` |

No dependency, lockfile, DB schema, migration, frontend behavior, environment configuration or deployment file was changed. All implementation is original LessonQuest code.

## Independent gate and delivery status

Fresh non-implementing reviewer `f02_async_auth_final_review` independently inspected the real diff and manifest, reran focused 25 tests and added four adversarial runtime probes: generic async error redaction, authentication error redaction, public health/preflight independence from a pending verifier, and current-user disablement while verification waits. Results and score belong to `docs/reviews/2026-09-08-f02-async-auth-final-review.md`. The required preview rerun passed, and the independent final review subsequently scored **99/100 PASS with no critical blocker** for this bounded prerequisite.

No external Firebase/Neon data was accessed, no key was acquired, and no remote resource/configuration was mutated. Firebase `lessonquest-df4b0` and Neon/Vercel connection remain user-reported; both Codex browser tabs reach sign-in screens. Google and Vercel sign-in, actual server configuration, remaining F02 implementation and live verification are outstanding. Nothing has been pushed, merged, or deployed for F02.
