# F01 execution clarification review

Date: 2026-09-07. Applies to the approved F01 plan, Task 3. Production implementation of this clarification has not started.

## Evidence and decision

The approved contract accepts 32,768 characters of lesson content and eight 300-character objectives. The existing API defaults to a 65,536-byte JSON body cap (`services/api/src/app.ts`). Maximum-length Korean content alone occupies 98,304 UTF-8 bytes, so a contract-valid request would be rejected before validation. Escaped JSON text can use up to six bytes per UTF-16 code unit.

Task 3 will select a 262,144-byte default for the exact F01 collection/detail path family only. Existing routes retain 65,536 bytes. Explicit `CreateAppOptions.maxBodyBytes` overrides either default and retains its existing positive-integer, at-most-1-MiB validation. Middleware continues enforcing auth, Origin, JSON media type, and safe errors. Requests above the selected cap, including streamed bodies, fail with the existing 413 envelope. The four route adapters do not bypass middleware.

Tests will exercise maximum Korean content/objectives, maximum JSON-escaped text, an oversized F01 body, the unchanged cap on an existing route, and an explicit smaller configured cap. The existing Task 3 regression command and final verification matrix apply unchanged. No dependency, external service, operating database, credentials, or real data is needed. Recovery is reverting this local route-limit selection; the default for unrelated endpoints never changes.

## Pre-implementation score

| Rubric category                        | Evidence                                                                                                               |      Score |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------: |
| Requirements and scope coverage        | Makes the already-approved text bounds reachable through HTTP; no additional product feature                           |      25/25 |
| Architecture and interface quality     | Route-local default; explicit configuration and existing middleware semantics preserved                                |      20/20 |
| Security, privacy, tenant safety       | Bounded 256 KiB below existing 1 MiB ceiling; auth/Origin/validation unchanged; synthetic inputs only                  |      20/20 |
| Test and verification quality          | Concrete positive byte/character boundaries, oversized rejection, configuration precedence, unrelated-route regression |      20/20 |
| Execution readiness and recoverability | Exact affected Task 3 files and commands; reversible default selection, no data migration                              |      14/15 |
| **Total**                              | **PASS; no critical blockers**                                                                                         | **99/100** |

The clarification passes the required score greater than 85. The complete implementation still requires independent final validation before acceptance or delivery.

## Verification housekeeping addendum

The SDD helper creates git-ignored transient agent briefs/reports. `prettier --check .` still discovers that directory because its ignore rule is local Git metadata, so scratch formatting changes the result compared with a clean CI checkout. Task 1 also accidentally force-added its report there. Task 7 will preserve that report's evidence in `docs/reviews/2026-09-07-f01-lesson-inputs-verification.md`, remove only the scratch report from the index while keeping its working copy, and exclude `.superpowers/` through `.prettierignore`. No production, test, or durable review path is excluded. The final full formatter and file manifest will verify containment. Two Task 3 minor evidence gaps will also be closed through direct assertions in its existing tests.

This housekeeping is approved before implementation: requirements 25/25, architecture 19/20, security 20/20, verification 20/20, recoverability 15/15 = **99/100 PASS**, no critical blocker. The affected files and exact containment are specified above; removing the scratch-only ignore line reverses the tooling change, and the untracked working report remains recoverable.
