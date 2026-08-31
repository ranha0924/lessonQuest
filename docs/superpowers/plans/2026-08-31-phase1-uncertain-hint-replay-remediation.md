# Phase 1 Uncertain Hint Replay Remediation

Status: independently reproduced; pre-implementation plan review99/100 PASS. Implement only after the first reviewer releases the frozen candidate and preserves its failed verdict.

Evidence: `/tmp/lessonquest-independent-running-hint-probe.log`, two independent failing real-boundary probes. The first permits a stale-sequence completion after the original hint later commits; both completion and its exact retry receive409. The second discards the pending UUID and creates a second hint, leaving two requests/actions/usage/HINT_USED effects instead of one. The first candidate remains unaccepted and undeployed.

## Problem and boundary

A lost transport response does not cancel an in-progress provider operation. A later exact retry may receive a409 while the original request remains RUNNING. A temporary authority or storage failure can likewise produce404/500 without certifying the original request's final state. These responses alone must not clear a previously uncertain hint UUID or unlock competing answer/completion writes. An eventual successful exact replay supplies the authoritative next sequence; finite terminal Rasa errors certify that no hint will later commit for that request.

Retain the original closeout and Vercel preview scope. No API, repository, policy, schema, sandbox, dependency, deployment or authorization change is needed. Only `apps/web/src/components/student-play.tsx` and `apps/web/test/phase1-recovery.test.tsx` may change, plus evidence/review/completion documents.

## Ordered TDD work

1. Preserve the independent failed review and its real-boundary reproduction. Add a controlled provider gate to the existing real React→HTTP→Hono→PGlite fixture. Start a hint, detach its client response while retaining/awaiting the server promise, then retry before releasing the provider. Observe actual409 and the persisted RUNNING row. Require the same request ID and disabled answer/completion controls. Release the provider, retry exactly, and require one request/action/usage/hint effect and correct subsequent answer sequence.
2. Cover temporary404 during that uncertain window by disabling then reactivating the synthetic class membership before the original provider finishes. Cover500 by temporarily rejecting the replay's preparation audit, then removing only that synthetic trigger before original completion. Neither transient response proves the original operation ended. Ensure all detached work is awaited in cleanup.
3. Cover the contrasting terminal outcome: detached provider operation ultimately fails, the real exact replay returns finite `RASA_PROVIDER_FAILED`, and the UI may again answer or explicitly request a new hint while preserving immutable failed evidence. Existing timeout/rejection/finalization and normal known-error cases remain regression checks.
4. Observe RED before component correction. In the hint catch handler, preserve prior uncertainty unless the response is a successful replay or a finite terminal Rasa code (`RASA_OUTPUT_REJECTED`, `RASA_PROVIDER_FAILED`, `RASA_PROVIDER_TIMEOUT`, `RASA_FINALIZATION_FAILED`). Never discard the retained request ID on a nonterminal error while uncertain. Keep `새 힌트 요청` available only for established retryable terminal failures. Do not speculate about event sequences or invent a new request on ambiguous delivery.
5. Run focused recovery/negative/API suites, full `pnpm check`, both Chromium suites and required integration/E2E commands. Recompute the code/test/tooling manifest and obtain a fresh independent final review of the complete base-to-candidate diff. Any score≤85 or critical blocker requires another fix/review. Git/Vercel delivery remains blocked until the final gate passes.

## Acceptance and recovery

All three nonterminal replay cases retain the same UUID and prevent stale-sequence writes until reconciliation; each eventual success persists one hint only. Terminal failure allows recovery without mutating the failed request. No secrets/real data/network provider is used. A reviewed code revert is sufficient; no data migration exists. The development preview remains browser-local, synthetic and reset on refresh.
