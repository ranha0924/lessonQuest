# F02 asynchronous authentication boundary — independent final review

Started: 2026-09-08; evidence updated 2026-09-09 KST. Reviewer: independent agent `f02_async_auth_final_review`, which did not implement this change. Review base: `fe20d4b1d93612ec381996bb856b5a38e0e45ae9` on `codex/f02-live-authoring`.

Final status: **99/100 PASS for the bounded asynchronous authentication prerequisite, with no critical blocker.** Finalized 2026-09-09 KST after the unchanged full preview suite passed and the reviewer rechecked the frozen diff, file hashes, and focused tests. The earlier verification holds and their failure evidence are preserved below.

## Scope and independence

This review applies only to the asynchronous authentication prerequisite described in `docs/superpowers/plans/2026-09-08-f02-async-auth-boundary.md`, whose pre-implementation review passed at 96/100. The controlling requirements are `AGENTS.md`, `docs/PROJECT_CANON.md`, and the final-validation rubric in `memory/projects/lessonquest.md`.

The reviewer inspected the actual working-tree diff against the base and read both new code files directly; untracked files were not omitted by relying on `git diff` alone. The reviewed implementation consists of four production files and one test file:

- `packages/auth/src/provider.ts`: structural synchronous/asynchronous provider contract.
- `packages/auth/src/index.ts`: type-only export of that contract.
- `packages/auth/src/local-auth.ts`: explicit interface implementation without behavior changes.
- `services/api/src/app.ts`: provider interface dependency and awaited request-local resolution.
- `services/api/test/async-auth.test.ts`: three real Hono/PGlite behavior tests.

The reviewer did not edit implementation, run competing builds/browser suites, commit, merge, push, deploy, or access Firebase, a remote database, credentials, or student data. Only this report and ignored verification logs were written. Existing F01 work at the base was reviewed for regression context, not recertified from scratch. F02 design/setup documents describe future work and are not evidence of live integration.

## Actual behavior and acceptance trace

| Acceptance criterion                                      | Independent evidence                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deferred authentication precedes tenant writes            | `services/api/src/app.ts:334` awaits the provider before setting the actor or calling the next middleware. The new pending-verification test observes no organization/audit rows. An independent probe additionally verifies that the HTTP promise stays unsettled while verification is unresolved.                             |
| Successful verification supplies the actual owner         | The new deferred-success test traverses Hono and the real repositories/PGlite, returns 201, and checks the stored `created_by` UUID.                                                                                                                                                                                             |
| Rejection is safe and creates no tenant resource          | The new rejection test returns the established safe 401 with a trace ID, no organization/audit rows, and no credential in diagnostics. Independent probes inject secret text into both a generic Error and an AuthenticationError and verify safe 500/401 responses, correlated trace IDs, redacted diagnostics, and no writes.  |
| Reverse-order concurrent verification does not mix actors | Two simultaneous requests resolve second-first and persist their own distinct actor UUIDs. The production actor is assigned to each Hono context, not to a shared mutable slot.                                                                                                                                                  |
| Existing synchronous authentication remains compatible    | Independent focused tests cover the synchronous provider, missing/malformed credentials, copied session actors, constructor validation, and production prohibition along with the existing API suite. A probe confirms health and preflight remain available without another provider call while an authenticated request waits. |
| Current server authorization remains authoritative        | A further real API/PGlite probe disables the DB user during pending verification and then resolves a formerly valid teacher actor. The repository returns 403 and creates no organization.                                                                                                                                       |

No schema, dependency, package-lock, API route, authentication fallback, role mapping, token format, environment configuration, or deployment change is included. Existing safe error mapping and allowlisted diagnostics remain unchanged (`services/api/src/app.ts:143`, `services/api/src/app.ts:173`).

## Findings

No critical or blocking implementation finding was identified in the inspected diff or independent checks.

The required initial `test:preview` run caused a blocking verification hold: `.verification/f02-test-preview.log` ends with 8 failures, 34 passes, and exit 1. Failures include initial PGlite readiness and later UI interactions across viewport projects. The report records 60-second test timeouts with individual elapsed durations of approximately 16–17 minutes and an overall 2.3 hours. An independent read of `pmset -g log` confirms that the host entered Clamshell Sleep at 2026-09-08 14:03:25 KST and repeatedly slept for approximately 970–1046 seconds between brief DarkWake periods during the suite. The narrowly filtered evidence is preserved in `.verification/f02-async-auth-independent-host-sleep.log`; the initial failing suite log is also preserved as `.verification/f02-async-auth-independent-preview-initial-failure.log`. This established that the first run did not have a continuously awake execution environment; it did not substitute for a fresh passing required run. The reviewer requested an unchanged full preview run on an awake host before issuing any PASS. No assertion, timeout, or implementation change was made by the reviewer to hide these failures.

The controller reran the unchanged full preview suite beginning around 2026-09-09 00:24 KST with `caffeinate -i` scoped to the command. That rerun also failed: `.verification/f02-test-preview-awake-rerun.log` reports 40 passed / 2 failed, exit 1, and 23.1 minutes elapsed. Independent `pmset` evidence confirms Maintenance Sleep from 00:26:16 to 00:31:16 (300 seconds) and from 00:32:04 to 00:48:11 (967 seconds), matching the two reported failure durations of 5.1 and 16.1 minutes. The filtered evidence is `.verification/f02-async-auth-independent-host-sleep-rerun.log`. Despite its filename, this rerun was not continuously awake. All five reviewed file hashes remained unchanged, and the reviewer continued withholding the final score because a valid required run was still missing.

The third complete required preview run, `.verification/f02-test-preview-resume-2026-09-09.log`, passed **42/42 in 1.7 minutes**, with the controller collecting final exit 0. The reviewer read the new output and implementer verification record, checked that the complete runtime/test diff and all five SHA-256 hashes still match the inspected candidate, and independently reran the focused suite: **25/25 passed**, exit 0. Browser test code, timeout settings, and production code were unchanged. This new passing full run resolves the verification hold; it does not relabel either earlier run as a pass.

One nonblocking test-quality follow-up remains: `services/api/test/async-auth.test.ts:99` rejects only an unmodified, fixed-message AuthenticationError. Preserve the independent secret-message/generic-rejection probes as durable tests when adding the real provider adapter, so a future error-mapping change cannot silently expose an upstream error. The current implementation passed those probes; this is a coverage durability gap, not a reproduced disclosure.

The setup/design documents initially retained statements that the dedicated resources did not exist despite the user's creation report. The reviewer reported that inconsistency; the controller corrected it to distinguish user-reported creation from unverified configuration/credentials. Those documentation edits do not change the reviewed implementation manifest.

## Independent checks

- `corepack pnpm exec vitest run services/api/test/async-auth.test.ts packages/auth/test/local-auth.test.ts services/api/test/app.test.ts`: exit 0, 3 files / 25 tests passed. Output: `.verification/f02-async-auth-independent-focused.log`.
- Inline Node probes using the built actual API, authentication error class, repositories, and fresh PGlite: exit 0; secret-bearing generic rejection, secret-bearing authentication rejection, pending-request/health/preflight isolation, and user disablement during pending verification passed. Output: `.verification/f02-async-auth-independent-probes.log`.
- `git diff --check`: exit 0 during inspection.
- Initial SHA-256 manifest captured after the independent checks: `.verification/f02-async-auth-independent-manifest.log`.
- Resumed independent focused run on 2026-09-09 at 10:43 KST: the same 3 files / 25 tests passed in 10.14 seconds, exit 0. Output: `.verification/f02-async-auth-independent-resume-focused.log`. All five hashes and the base commit were rechecked successfully immediately afterward.

## Implementer evidence inspected

| Check                        | Observed result                                                                   | Log                                                    |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| RED async behavior tests     | Three expected behavioral failures: pre-await API returned 400 instead of 201/401 | `.verification/f02-async-auth-red.log`                 |
| Focused GREEN                | 25 tests passed                                                                   | `.verification/f02-async-auth-green.log`               |
| Full check                   | 476 tests passed; lint, format, typecheck, and all builds completed               | `.verification/f02-check.log`                          |
| Integration                  | 80 tests passed                                                                   | `.verification/f02-test-integration.log`               |
| Scripted E2E                 | 80 tests passed                                                                   | `.verification/f02-test-e2e.log`                       |
| Demo browser                 | 12 tests passed                                                                   | `.verification/f02-test-browser.log`                   |
| Initial service preview      | 34 passed / 8 failed; exit 1; preserved interrupted run                           | `.verification/f02-test-preview.log`                   |
| Service preview rerun        | 40 passed / 2 failed; exit 1; independently confirmed further host sleep          | `.verification/f02-test-preview-awake-rerun.log`       |
| Production dependency audit  | No known vulnerabilities                                                          | `.verification/f02-audit.log`                          |
| Resumed full service preview | 42 passed in 1.7 minutes; exit 0; unchanged code and tests                        | `.verification/f02-test-preview-resume-2026-09-09.log` |

## Manifest

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `packages/auth/src/provider.ts`        | `17ce05022e90c9a0e58c93a1613093e1122bbbcf71f3022886ff098adc491d01` |
| `packages/auth/src/index.ts`           | `87ed6e728e1c1c057cdd4a5b1dcb2333cd1558e9718db7d828b8e3b55ea74926` |
| `packages/auth/src/local-auth.ts`      | `5eb89f2265cad80507d4d56c2d5b3bf1b39de0e8a476ec6276bb8487a65bcea6` |
| `services/api/src/app.ts`              | `113b07508d918dc5657987741e7b29b71d4a6eba01735de485085745e4adca44` |
| `services/api/test/async-auth.test.ts` | `de6a73e2797146ae3ccbeff5cc92643df5f1cb06a56adcf4a7132e57bff194a3` |

## Final rubric and decision

| Category                                    |      Score | Concrete evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | All five approved acceptance criteria are satisfied through the actual API/repository boundary. The four-file production change stays within the locally testable prerequisite; no external integration is claimed.                                                                                                                                                                                                           |
| Correctness and code quality                |      20/20 | The structural union return contract preserves synchronous compatibility, and one awaited request-context assignment correctly handles success, rejection, and reverse-order concurrent verification. No shared identity state or unnecessary runtime machinery was introduced.                                                                                                                                               |
| Security, privacy, and tenant isolation     |      20/20 | Pending verification performs no tenant write; rejected verification stays safe; secret-bearing error probes pass; and a DB user disabled during verification is denied. Existing local-auth production prohibition and repository authority remain unchanged.                                                                                                                                                                |
| Test and verification evidence              |      19/20 | Behavioral RED/GREEN, independent focused tests and four probes, full 476-test check, integration/E2E 80 each, demo browser 12, final service preview 42, and clean audit support acceptance. One point is withheld because upstream secret-message/generic-rejection probes are not yet durable committed tests. Both interrupted failures are preserved and the missing full run was obtained without weakening assertions. |
| Operability, recoverability, and provenance |      15/15 | Safe diagnostics and trace correlation remain intact. The approved plan provides a bounded revert with no migration/data rollback, all code is original LessonQuest, dependencies are unchanged, and the reviewed artifact is pinned by five hashes. Live-provider/runtime concerns remain explicit subsequent work.                                                                                                          |
| Total                                       | **99/100** | **PASS: strictly greater than 85, with no critical blocker for this prerequisite.**                                                                                                                                                                                                                                                                                                                                           |

The asynchronous authentication prerequisite may be accepted. Required CI and delivery checks are separate, and this score does not authorize calling the remaining F02 implementation or any live service complete.

## Explicit certification boundary

This bounded review does not certify Firebase sign-in or token verification, teacher registration, live Google login, persistent PostgreSQL/server storage, migrations, OpenAI access or generation, deployment/CI, or F02 completion. Authentication timeout/cancellation and full authenticated-response cache policy remain requirements for their separately planned live-adapter/API work. External configuration and credentials are unnecessary for this local prerequisite but remain unverified dependencies of live delivery. No acceptance of broader runtime changes or external operations follows from this report.
