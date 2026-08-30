# Phase 1 M5/M6 Independent Final Review

- Date: 2026-08-30
- Reviewer: independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `9a82c69fa5970016e8c752211ecf3141d3df6e0d`
- Scope: complete base-to-head diff, approved M5/M6 design and plan, full verification bundle, and independent adversarial probes
- Decision: **FAIL — 52/100, with critical blockers**

## Verdict

The candidate must not be accepted, merged, deployed, or described as complete. The standard repository commands pass, and the implementation has useful foundations: strict request/response contracts, server-derived answer outcomes and boss damage, aggregate-only student boss responses, exact learning-event replay, append-only action/usage/contribution/audit evidence, and projection-failure containment. Those strengths do not clear the final gate because the independent probes reproduced authorization and answer-safety violations, mutable campaign/request/job state, ineffective provider timeout enforcement, concurrent duplicate job processing, and substantial gaps against the approved UI and real-boundary test plan.

## Critical blockers

### 1. Completed hint replay bypasses current actor ownership and authorization

`RasaRepository.requestHint` looks up an existing request by organization/request ID and returns its stored action before checking that the current actor owns the attempt or still has active user, organization, class, assignment, and attempt authority. The replay branch only compares the caller-supplied attempt and step identifiers. See `packages/db/src/rasa-repository.ts:59-93`.

An actor that was never inserted into the database successfully replayed another student's hint when given the request ID, attempt ID, and step ID:

```text
PROBE unknown actor replays another student hint: { duplicate: true, sameAction: true }
```

This violates the approved fail-closed/current-role boundary and is an unresolved authorization and student-data risk, which is a critical blocker regardless of score.

### 2. Hint finalization does not revalidate membership or assignment/class lifecycle

The second Rasa transaction checks only that the attempt is still `IN_PROGRESS`; it does not repeat the organization/user/class membership, class/assignment status, assignment window, published artifact, or enabled policy checks performed before the provider call. See `packages/db/src/rasa-repository.ts:258-267`.

The probe revoked the student's class membership inside the provider call. The repository still persisted and returned the next hint:

```text
PROBE hint finalizes after class membership revoked during provider call: { level: 2, nextSequence: 5 }
```

This is a second fail-closed authorization blocker and directly contradicts design sections 7.4 and 9.

### 3. The answer-safety guard accepts direct choice instructions

The output policy blocks a small marker list and exact option ID/label matches, but it does not reject common direct-answer instructions that name a choice by position or letter. See `packages/rasa/src/output-policy.ts:10-47`.

All three adversarial outputs passed validation:

```text
PROBE direct-answer wording accepted: 2번을 고르세요.
PROBE direct-answer wording accepted: Choose option B.
PROBE direct-answer wording accepted: 두 번째 선택지가 맞아요.
```

This violates the canonical invariant that Rasa is not an answer generator and the approved requirement to reject Korean and English direct-answer wording. Because answer safety is a controlling product/privacy boundary for minors, this is a critical blocker.

## Additional findings

### 4. Campaign policy and request/job lifecycle evidence are mutable (high)

The schema defines legal-looking status values and final-shape checks, but it does not install transition/immutability triggers for `rasa_requests`, `class_boss_campaigns`, or `boss_projection_jobs`, nor does it protect campaign policy from update. The only new protection triggers cover `audit_logs`, `rasa_actions`, `ai_usage`, and `boss_contributions`. See `packages/db/src/schema.ts:181-246`, `packages/db/src/schema.ts:287-315`, and `packages/db/src/schema.ts:462-473`.

Direct SQL reproduced all of the prohibited transitions/mutations:

```text
PROBE campaign ENDED->ACTIVE direct update: { status: 'ACTIVE' }
PROBE terminal Rasa request rewritten to RUNNING: { status: 'RUNNING' }
PROBE terminal boss job rewritten to PENDING: { status: 'PENDING' }
PROBE immutable campaign policy direct rewrite: {
  policy: {
    amounts: {
      ANSWER_CORRECT: 999,
      ANSWER_RETRIED: 'corrupt',
      EXPERIENCE_COMPLETED: 5
    }
  }
}
```

This breaks the approved immutable teacher policy, terminal request state, one-way campaign lifecycle, and exact job replay requirements. A changed invalid policy also caused a later eligible projection to fail.

### 5. The provider timeout is advisory rather than enforced (high)

`requestHint` schedules `AbortController.abort()` but awaits the provider promise directly. A provider that ignores the signal is never raced against a timeout promise. See `packages/db/src/rasa-repository.ts:203-235`.

With `timeoutMs: 10`, an ignoring provider completed successfully after about 104 ms:

```text
PROBE provider ignoring AbortSignal succeeds past timeout: { elapsedMs: 104, level: 1 }
```

A permanently unresolved provider can therefore hold the request indefinitely instead of durably reaching `TIMED_OUT` and returning the approved retryable 503.

### 6. Concurrent job drains process the same job twice (high)

`drainPendingJobs` selects jobs without row locking/claiming and then unconditionally updates each selected ID to `PROCESSING`. Two drainers can select the same row, both increment attempts, and both report it processed. The contribution uniqueness constraint prevents double damage, but job replay, attempt accounting, diagnostics, and bounded-retry behavior are not exact. See `packages/db/src/gamification-repository.ts:192-210`.

PGlite reproduced the race:

```text
PROBE concurrent job drain: {
  drains: [ { processed: 1, failed: 0 }, { processed: 1, failed: 0 } ],
  state: { status: 'SUCCEEDED', attempts: 2, contributions: 1 }
}
```

### 7. The approved real React-to-database M5/M6 E2E and negative matrix are absent (high)

The plan required `apps/web/test/m5-m6-e2e.test.tsx` plus `tests/helpers/m5-m6-fixture.ts`, including browser event/hint transport ambiguity, terminal-503 retry, reload, correct-first contribution, literal audit evidence, and the real React → API client → Hono → repositories/provider/projector → PGlite boundary. Neither file exists in the diff. The `test:e2e` script instead runs the single HTTP-only M5/M6 happy-path test plus pre-existing UI/unit files; see `package.json:16-17` and `services/api/test/m5-m6.test.ts:37-197`.

The added M5/M6 tests are only one Rasa repository happy path, one campaign repository happy path, one HTTP happy path, a client response-rejection check, and small presentational component checks. They do not cover the plan's stale-role/cross-tenant matrices, provider rejection/throw/timeout, lifecycle changes during provider work, changed request reuse, concurrent request ownership, direct policy/state abuse, projection retry concurrency, browser hint/event retries, campaign end/replacement, or current-role teacher detail.

The SDK-level exact pending-envelope tests do pass (`packages/experience-sdk/test/event-session.test.ts:124-152`), and source inspection shows the hint request ID is retained for transport exceptions. There is no executed React-boundary proof that the browser retries the exact event/request through the real client and server, so the approved browser-retry acceptance evidence is missing.

### 8. Teacher campaign UI does not implement the approved lifecycle (medium)

`BossCampaignPanel` can only create a hard-coded weekly campaign in local component state. It never loads an existing campaign, never calls `getTeacherBossDetail`, renders no end action, never calls `endBossCampaign`, cannot select `SPECIAL`, and cannot create a replacement after end. See `apps/web/src/components/boss-campaign-panel.tsx:14-90`.

This leaves the documented one-active-campaign lifecycle incomplete at the actual teacher UI boundary even though repository methods exist.

### 9. Required Rasa/boss audit records are mostly not emitted (medium)

The schema allowlists `RASA_HINT_REQUESTED`, `BOSS_PROJECTION_PROCESSED`, `BOSS_PROGRESS_READ`, and `BOSS_DETAIL_READ`, but no implementation emits them. Successful duplicate hint replay also returns before a `DUPLICATE` audit row is written. `GamificationRepository` only audits campaign create/end; read methods merely parse the trace ID, and the job drain has no audit. See `packages/db/src/rasa-repository.ts:59-93`, `packages/db/src/gamification-repository.ts:135-190`, `packages/db/src/gamification-repository.ts:192-293`, and `packages/db/src/gamification-repository.ts:350-363`.

This materially weakens trace-correlated diagnosis, duplicate evidence, and the approved teacher-only projection observability.

## Passing adversarial evidence

The following controls worked in direct probes and should be preserved during remediation:

- Exact learning-event replay returned `duplicate: true` with the authoritative `nextSequence`; changed payload reuse raised `ConflictError`.
- Update/delete attempts against `audit_logs`, `rasa_actions`, `ai_usage`, and `boss_contributions` were all rejected by the database.
- The student boss object contained exactly `campaignId`, `completed`, `damage`, `targetHp`, and `title`; no individual contribution data appeared.
- Projection failure did not roll back the learning event. The eligible event remained while its job became `FAILED`:

```text
PROBE projection failure containment: {
  ingestAccepted: true,
  drain: { processed: 1, failed: 1 },
  event_count: 1,
  failed_jobs: 1
}
```

- The local provider package has no external provider SDK or credential dependency, the changed-file credential/provider scan found no hits, and provenance continues to attribute the pure gamification rules to the recorded WordQuest source while identifying M5/M6 orchestration as LessonQuest-original.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `9a82c69`.

| Command                                                           | Result                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                         | PASS; lockfile already current                                                                                |
| `corepack pnpm check`                                             | PASS; lint, formatting, typecheck, 24/24 files and 245/245 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                  | PASS; 5/5 files, 16/16 tests                                                                                  |
| `corepack pnpm test:e2e`                                          | PASS as scripted; 4/4 files, 10/10 tests, but the required M5/M6 React E2E is not part of the script          |
| `corepack pnpm audit --prod`                                      | PASS; no known vulnerabilities                                                                                |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD` | PASS                                                                                                          |
| Changed-file credential/private-key/external-provider scan        | PASS; no matches                                                                                              |
| `git status --short` before report                                | Clean                                                                                                         |

One initial credential-scan shell invocation failed before scanning because of a reviewer quoting error (`zsh:2: unmatched "`). It was corrected and rerun successfully; this was not an implementation failure. One early lifecycle probe attempted to set an invalid assignment date and correctly hit the existing assignment check constraint; the probe was rerun using class-membership revocation and reproduced the actual finalization defect shown above.

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      15/25 | Core contracts and happy paths exist, but current-authorization revalidation, answer-safe output, immutable lifecycle enforcement, full audits, teacher campaign lifecycle UI, browser retries, correct-first real E2E, and required negative matrices are incomplete. |
| Correctness and code quality                |      10/20 | Exact learning-event ACK/replay and aggregate calculations work, but timeout enforcement, terminal state machines, concurrent job claiming, and campaign UI lifecycle are incorrect.                                                                                   |
| Security, privacy, and tenant isolation     |       8/20 | Strict bodies, server-derived damage/correctness, append-only evidence, provider minimization, and aggregate-only student output are good; unknown-actor hint replay, mid-call authorization revocation, and direct-answer bypasses are critical failures.             |
| Test and verification evidence              |      10/20 | The complete scripted suite is green, but the small M5/M6 happy-path set missed every reproduced blocker and the plan-mandated real React M5/M6 E2E is absent.                                                                                                         |
| Operability, recoverability, and provenance |       9/15 | Projection failure containment, local-only dependencies, clean audit/provenance scan, and documentation are positive; missing audit emissions, ineffective timeout, duplicate job processing, mutable state evidence, and incomplete UI controls reduce operability.   |
| **Total**                                   | **52/100** | **FAIL**                                                                                                                                                                                                                                                               |

## Gate decision

**FAIL.** The score is below 86 and critical authorization/answer-safety blockers remain. Remediation must be test-first and followed by a new independent final review by a different non-implementing agent. No merge, push, deployment, or Phase 1 completion claim is permitted from this review.
