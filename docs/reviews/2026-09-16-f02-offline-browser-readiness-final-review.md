# F02 offline browser readiness — independent final review

**97/100 PASS. No critical blocker remains for this bounded test-only correction.**

Reviewer: independent agent `f02_offline_readiness_final`, assigned after implementation and uninvolved in the changed assertion or its original diagnostic probes. Reviewed base HEAD is `b1cbf363c7d7579e9e6049e21e7d5f790ff01e48` plus the pending test/documentation diff. The only executable tracked change is two added lines in `tests/browser/service-preview.spec.ts`: a comment and `toBeEnabled()` for the first answer button before disconnecting the browser context.

This review permits accepting that test correction and proceeding to fresh exact-head CI. It does not authorize bypassing a failed CI run, certify production delivery, or complete real Google login, explicit UID bootstrap, persistent lesson save/re-login, or the broader F02 activation. Required changed-head and merged-result CI, existing expected-head release protections and hosted verification remain mandatory.

## Scope and actual diff

Read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final rubric in `memory/projects/lessonquest.md`, the September 16 offline-readiness plan and its 97-point pre-implementation review. Inspected the complete pending tracked diff, the unchanged preview configuration and workflow, the affected test and its fixture/helper, `StudentPlay` startup and disabled-control logic, frozen diagnostic sources, original CI failure, canceled diagnostic retry, and parent verification logs.

The precondition matches the test's purpose. `enterStudent` previously established visibility only. In `apps/web/src/components/student-play.tsx`, the offline-capable flow exposes the specification before awaiting `sendPreparedEvent` for `EXPERIENCE_STARTED`; a pending event disables answer controls until server acknowledgement. Waiting for an enabled answer before taking the connection offline ensures this scenario queues a question answer, as its existing assertions require. No arbitrary sleep, forced click or application state mutation was added.

The existing checks remain intact: one queued `QUESTION_ANSWERED` record with tenant/account scope, no credentials or client correctness in storage, disabled controls after player remount, successful reconnection and delivery, queue removal, completion, and preservation of a foreign account's record during current-account reset. The unchanged configuration retains all three viewports, one worker, zero retries, `forbidOnly`, the 60-second test limit and 10-second assertion limit. No production code, dependency, authentication, database, schema, credential, deployment setting, timeout or CI policy changed.

## Independently executed checks

- Scoped ESLint, root TypeScript `--noEmit`, Prettier for the changed test, and `git diff --check` all passed. The root TypeScript configuration includes browser tests.
- Ran the actual changed test with the unchanged `playwright.preview.config.ts`, three repetitions per desktop/tablet/mobile viewport: **9/9 passed**, exit 0, 32.4 seconds. No retries or timeout overrides were used.
- Copied the frozen RED and GREEN sources into a separate private loopback probe directory, verified byte equality and preserved the implementer's artifacts. Both probes differ from the tracked test only by an absolute measurement-helper import, the same test-only 1,500 ms initial-start IndexedDB completion-notification delay, and the same shorter 3-second diagnostic first-click limit. Their only difference from each other is the reviewed comment/assertion.
- Independently ran the frozen old-precondition RED: **all 3 viewports failed as expected**, exit 1. Every failure was the first answer click waiting on a disabled button, not test cleanup or an unrelated setup error.
- Independently ran the frozen corrected GREEN three times per viewport: **9/9 passed**, exit 0, 47.8 seconds, including the full existing answer/remount/reconnect/record assertions under the same injected boundary delay.
- Inspected the implementer's changed-source full preview matrix: **42/42 passed**, exit 0, 1.7 minutes. The independent focused and controlled-boundary executions supplement that full run; the full matrix was not redundantly rerun by this reviewer.

Independent evidence is `.verification/f02-offline-readiness-independent-{lint,typecheck,format,focused,boundary-red,boundary-green,manifest}.log`. Parent evidence includes `f02-offline-readiness-full-preview-green.log`, `f02-offline-start-race-diagnostic.log`, `f02-offline-start-readiness-{red,green}.log`, the frozen probe sources, `f02-final-head-ci-failed.log`, and `f02-final-head-ci-retry-disposition.log`.

Reviewed changed test SHA-256: `400c2106d5ea4431358447f20b94e60ea16c4e03599c7ada8f23d650d389bb76`. Unchanged preview configuration SHA-256: `1bd95e2b4a19795b16792ffec96c30783a9d53cb2388e08c3b4f969ad693abac`. Frozen RED/GREEN SHA-256 values are respectively `b3bf50bf1ab838a2185e415889b000b90036e411e30d9ccc2a242593afddac09` and `7ce9e50c8d563786130d5feaf06e1ce2fe05c86b9c54aeb2822c6ce5f23e490b`; independent copies match.

## Findings and limits

No actionable correctness, security or scope finding was identified in the bounded diff. All independent browser runs used the guarded synthetic loopback preview; no external application configuration, Firebase credentials, real student data, teacher bootstrap or OpenAI invocation was accessed by this review.

The original CI failure remains only partly attributable: CI35038847962 attempt 1 passed 40/42 preview cases, while the tablet/mobile offline cases hit the 60-second limit and the `finally` cleanup obscured the initially blocked operation. The workflow did not preserve downloadable trace artifacts. The independently reproduced startup race is consistent with that failure, but does not conclusively reconstruct its original blocked action. Both the plan and progress document preserve this distinction. The same-head diagnostic attempt 2 was canceled as superseded; it does not count as acceptance of the changed source.

This scope needs no runtime/database suite rerun locally because the executable diff is confined to a browser-test precondition. Fresh changed-head and merged-result CI must nevertheless run every required job. A later inconsistent failure requires investigation rather than skips, retries, timeout increases or release-gate bypass. Reverting the two test lines restores the former test behavior without changing runtime or saved data.

## Rubric

| Category                                   |           Score | Evidence                                                                                                                                                                                    |
| ------------------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance  |           25/25 | Exact one-case readiness precondition and documentation; approved boundaries retained.                                                                                                      |
| Correctness and code quality               |           20/20 | Enabled control reflects completed startup authority; all offline answer assertions remain; no timing guess or production change.                                                           |
| Security, privacy and tenant isolation     |           20/20 | Guarded loopback synthetic runs only; existing account/tenant/storage checks retained and passed.                                                                                           |
| Test and verification evidence             |           18/20 | Independent focused 9/9, controlled RED 3/3 expected failures and GREEN 9/9, static checks, parent full 42/42; original CI blocked action remains uncertain and fresh CI is still required. |
| Operability, recoverability and provenance |           14/15 | Preserved failure, canceled-retry and source-hash evidence; explicit release conditions and trivial test-only rollback; original CI trace unavailable.                                      |
| **Total**                                  | **97/100 PASS** | **No critical blocker in this bounded test correction.**                                                                                                                                    |
