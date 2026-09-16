# F02 AI default-deny pre-implementation review

2026-09-09. Reviewed against PROJECT_CANON, memory rubric and explicit user answer “no payment service — AI blocked by default.” This plan adds the real API/UI denial boundary without pretending billing exists. Implementation is additionally contingent on completing the currently frozen PostgreSQL unit.

| Category                       |           Score | Evidence                                                                                                                             |
| ------------------------------ | --------------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| Requirements/scope             |           24/25 | Explicit all-account default deny, saved-input authoring remains available, live/payment completion exclusions.                      |
| Architecture/interfaces        |           19/20 | Reuses Hono authentication and safe errors, strict narrow request, repository authority, no provider/key dependency or allow toggle. |
| Security/privacy/tenant safety |           20/20 | Current tenant/role checks, key presence and client/admin bypass denial, no money/secret/provider mutation.                          |
| Tests/verification             |           19/20 | Behavioral API/UI RED, real HTTP/PGlite negatives, no-network/no-write evidence and full impacted checks plus independent gate.      |
| Execution/recovery             |           15/15 | Exact API/UI/test/docs files, dependency sequencing, no migration/external action, revert remains fail-closed.                       |
| **Total**                      | **97/100 PASS** | **Above85, no critical blocker within this local default-deny scope.**                                                               |

No payment-provider choice or secret is needed because the specified behavior is unconditional denial. This score does not authorize live generation, external deployment, or acceptance before independent final validation.

Body-limit re-review: cache matching must not enlarge the generation request allowance. Separate matching preserves64KiB generation versus256KiB F01 text limits, with a targeted RED/GREEN probe. Same97/100 PASS, no critical blocker.
