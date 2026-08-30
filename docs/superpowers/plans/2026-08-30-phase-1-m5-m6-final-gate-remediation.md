# Phase 1 M5/M6 Final-Gate Remediation Plan

## Scope and controlling evidence

This plan remediates every blocker and scored gap in `docs/reviews/2026-08-30-phase-1-m5-m6-final-review.md`. It remains governed by `docs/PROJECT_CANON.md`, the approved M5/M6 design, and the original M5/M6 plan. The slice stays local and synthetic: no Firebase, external AI provider, real student data, push, merge, or deployment.

Acceptance requires a fresh independent reviewer, who did not implement or perform the first review, to score the complete result above 85 with no critical blocker.

## Root causes and interfaces

1. `RasaRepository.requestHint` performs completed-request replay before current authorization and performs finalization with an attempt-only query. Both paths must use one shared fail-closed eligibility query covering current user/tenant/class membership, class and assignment lifecycle/window, attempt ownership/status, enabled policy, and published artifact. Replay remains idempotent only after authorization and exact request binding pass.
2. The provider timeout aborts cooperatively but does not own completion. Race provider execution against a rejecting timer, abort on timeout, durably transition the request to `TIMED_OUT`, and ignore late provider settlement.
3. The output guard detects identifiers/labels but not direct positional or letter-choice imperatives. Extend Korean and English answer-instruction detection while retaining deterministic local output validation.
4. Status checks exist without database transition enforcement. Add triggers that make Rasa semantic fields and terminal requests immutable, campaigns immutable except `ACTIVE -> ENDED` end metadata, and projection jobs follow only claim/retry/terminal transitions.
5. Projection workers read then claim non-atomically. Claim each eligible job with a conditional `UPDATE ... RETURNING` inside a transaction before projection; only the winner processes it. Preserve contribution uniqueness and failure containment.
6. Trace IDs are parsed but several operations omit evidence. Emit the allowlisted requested/delivered-or-rejected/duplicate, progress/detail read, and projection processed audits without exposing individual student data to student responses.
7. Teacher UI stores only a newly created weekly campaign. Load current detail, support WEEKLY/SPECIAL creation, end the active campaign, and permit replacement only after end.
8. Existing HTTP happy-path tests do not prove the required browser boundary. Add a synthetic React -> web API client -> Hono -> repositories/provider/projector -> PGlite fixture and cover exact event/hint retry, reload, correct-first contribution, terminal 503, audit evidence, campaign end/replacement, and authorization/lifecycle negatives.

## Ordered test-driven tasks

### Task 1: Rasa authorization, timeout, and answer safety

- Add repository tests that first fail for unknown-actor completed replay and membership revocation during provider work.
- Add provider tests that first fail when an implementation ignores `AbortSignal` past the deadline and assert durable `TIMED_OUT` plus retryable error.
- Add output-policy tests that first fail for `2번을 고르세요.`, `Choose option B.`, and `두 번째 선택지가 맞아요.` alongside safe-hint controls.
- Implement a shared eligibility helper, authorize before replay, revalidate under the final transaction, and enforce `Promise.race` timeout ownership.

### Task 2: Database lifecycle invariants

- Add direct-SQL schema tests that first fail for terminal Rasa rewrites, campaign reactivation/policy mutation, and terminal/job-invalid transitions.
- Add narrowly scoped trigger functions and triggers. Preserve the repository's legal transitions and immutable append-only evidence.
- Verify transaction rollback and tenant-scoped composite relationships remain intact.

### Task 3: Atomic projection and audit evidence

- Add a concurrent-drain regression test that first shows two workers process one job; assert one reported process and one attempt after remediation.
- Add literal trace-correlated audit tests for Rasa requested/duplicate, boss progress/detail reads, and projection processed/failed.
- Implement conditional atomic claim and audit writes. Projection failures must still leave learning events committed and jobs retryable.

### Task 4: Teacher lifecycle UI

- Add component tests that first fail for loading an existing campaign, ending it, selecting SPECIAL, and creating a replacement after end.
- Extend the API-driven panel without trusting local state for campaign authority.

### Task 5: Real-boundary M5/M6 E2E

- Add `tests/helpers/m5-m6-fixture.ts` using only synthetic PGlite data and the deterministic local provider.
- Add `apps/web/test/m5-m6-e2e.test.tsx` exercising React, the real web client, Hono, repositories, provider/projector, and PGlite.
- Cover exact retry after ambiguous delivery, reload, correct-first damage, timeout 503 with exact request retry, safe aggregate response keys, literal audits, and end/replacement.
- Ensure the root E2E script executes this file.

## Verification and containment

Run targeted RED tests before each implementation step, then targeted GREEN tests. Finish with:

- `corepack pnpm check`
- `corepack pnpm test:integration`
- `corepack pnpm test:e2e`
- `corepack pnpm audit --prod`
- `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD`
- changed-file credential/private-key/external-provider scan

If a migration or concurrency behavior cannot be made deterministic in PGlite, stop and preserve the failing evidence; do not weaken the invariant. Rollback is branch-level because nothing is deployed. Schema changes are additive trigger definitions and can be contained by reverting the remediation commits. A new independent agent must inspect the actual full diff, rerun relevant checks and adversarial probes, and record a new review attempt above 85 with no blocker.
