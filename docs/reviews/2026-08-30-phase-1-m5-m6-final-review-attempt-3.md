# Phase 1 M5/M6 Independent Final Review — Attempt 3

- Date: 2026-08-30
- Reviewer: third fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `8be1cf1c19400762c0a0f85aa7f199cb39deda8e`
- Scope: complete base-to-head diff, canon/design/original plan, both remediation plans and gate reviews, both prior failed final reviews, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 72/100, with a critical answer-safety blocker**

## Verdict

Attempt 3 must not be accepted, merged, deployed, or described as complete. The latest remediation closes the six literal answer phrases covered by the shipped tests, protects campaign and assignment-policy records from update/delete, preserves retryable browser request IDs, replays terminal timeout requests consistently, and correlates successful projection audits with ingestion traces. The final gate still fails because semantically equivalent direct-answer statements bypass the Rasa output boundary. Durable request/job evidence can also be deleted directly, failed projection audits are not trace-correlated because their insert parameters are reversed, and the required React-boundary retry/reload/authorization/lifecycle matrix remains absent.

## Critical blocker

### 1. The direct-answer guard still permits ordinary Korean and English answer statements

`validateHintOutput` matches a finite set of answer prefixes and selection imperatives, but it does not reject declarative choice answers or several common answer instructions. See `packages/rasa/src/output-policy.ts:26-46`.

A fresh probe used the same valid context and answer-safe validation entry point as the package tests. All six prior literal phrases were rejected:

```text
REJECTED 2번을 고르세요.
REJECTED Choose option B.
REJECTED 두 번째 선택지가 맞아요.
REJECTED B를 선택하세요.
REJECTED Select option B.
REJECTED Pick choice C.
```

However, semantically equivalent variants were accepted:

```text
ACCEPTED B가 맞아요.
ACCEPTED Option B is correct.
ACCEPTED The correct choice is C.
ACCEPTED 가장 적절한 것은 B입니다.
ACCEPTED Mark B as your answer.
```

This is not merely a missing fixture: the canonical invariant is that Rasa is not an answer generator, and the provider boundary must reject direct Korean/English answer wording. The current marker-list approach does not enforce that semantic boundary. Because this is a controlling learner-safety requirement, it is a critical blocker regardless of total score.

## High-severity findings

### 2. Terminal Rasa request and projection-job evidence can be deleted directly

The transition triggers are registered only for `UPDATE`; unlike the campaign and append-only evidence triggers, they do not cover `DELETE`. See `packages/db/src/schema.ts:480-498` and `packages/db/src/schema.ts:521-539`.

A fresh PGlite probe created a terminal request and a pending projection job, then exercised all requested direct mutation paths:

```text
campaign update: REJECTED
campaign delete: REJECTED
Rasa policy update: REJECTED
Rasa policy delete: REJECTED
terminal request rewrite: REJECTED
terminal request delete: ALLOWED
job invalid rewrite: REJECTED
job delete: ALLOWED
```

Deleting either row removes the state-machine and retry evidence that the design calls durable. Add delete protection for `rasa_requests` and `boss_projection_jobs`, with direct SQL regression tests.

### 3. Failed projection audits swap the audit ID and trace ID

The success path inserts `[randomUUID(), claimedJob.trace_id, ...]`, but the failure path supplies `[claimedJob.trace_id, randomUUID(), ...]` for the same `(id, trace_id, ...)` column order. See `packages/db/src/gamification-repository.ts:336-344`.

As a result, successful projections are correlated to the ingestion trace, while failed projections receive an unrelated random trace and use the ingestion trace as the audit row ID. This defeats the required trace-correlated failure diagnosis and can create an ID collision if one trace produces more than one failure audit. The current E2E asserts only successful projection lineage.

### 4. The real React-to-PGlite E2E still covers only one happy path

`apps/web/test/m5-m6-e2e.test.tsx:16-105` contains one real-boundary wrong → hint → retry-correct → completion flow. It usefully proves aggregate privacy, successful audit lineage, and correct job attempts, but it does not execute the remediation plans' required browser-boundary cases:

- exact event/hint replay after ambiguous delivery;
- terminal 503 replay through React and the real HTTP client/server;
- reload/resumed hint state;
- unknown/stale actor and mid-provider membership/lifecycle revocation;
- campaign end and replacement;
- failed projection containment and trace-correlated failure audit.

Focused repository/component tests cover portions of this matrix, but they do not substitute for the explicitly required React → client → Hono → repository/provider/projector → PGlite acceptance evidence.

## Medium-severity finding

### 5. Denied and conflicting M5/M6 decisions are not durably audited

Rasa authorization and semantic-conflict failures occur inside the transaction that writes `RASA_HINT_REQUESTED`, so the audit insert rolls back with the rejection; there is no outer denied/conflict audit path. Campaign creation/end methods likewise audit only successful state changes. See `packages/db/src/rasa-repository.ts:59-118` and `packages/db/src/gamification-repository.ts:42-134`.

This remains below the design requirement that denied/conflicting decisions be recorded after rollback. It also contributes to the missing negative E2E evidence.

## Verified improvements and preserved controls

- Unknown actors cannot replay another student's completed hint; current database authorization runs before replay disclosure.
- Membership revoked during provider work prevents finalization.
- An ignored `AbortSignal` is bounded by `Promise.race`; the request reaches durable `TIMED_OUT`.
- Reusing the terminal timeout request ID returns the same retryable timeout classification, and the React component preserves the ID across retryable HTTP failures.
- The six literal answer phrases from Attempts 1 and 2 are rejected.
- Campaign definition update/delete and assignment Rasa policy update/delete are rejected.
- Invalid terminal request/job updates are rejected.
- Conditional `UPDATE ... RETURNING` job claiming prevents a second claimant from processing an already claimed row; shipped concurrent drain evidence records one attempt per job.
- Successful projection audits share the ingestion/job trace, and the real E2E observes three correlated successful jobs.
- Teacher UI loads existing detail, supports weekly/special creation, ends the active campaign, and offers replacement after end.
- Student boss output remains aggregate-only.
- No external AI provider, Firebase access, real student data, credential, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `8be1cf1` before this report commit.

| Command                                                           | Result                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                             | PASS; lint, format, typecheck, 25/25 test files and 254/254 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                  | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                          | PASS as scripted; 5/5 files and 13/13 tests, with the acceptance-matrix omissions above                        |
| `corepack pnpm audit --prod`                                      | PASS; no known vulnerabilities                                                                                 |
| Focused Rasa/repository/UI regression run                         | PASS; 4/4 files and 28/28 tests                                                                                |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD` | PASS                                                                                                           |
| Changed-file credential/private-key/external-provider scan        | PASS; no implementation hit                                                                                    |
| Direct six-phrase plus variant output-policy probe                | FAIL; five semantically direct variants accepted                                                               |
| Direct campaign/policy/request/job SQL mutation probe             | FAIL; request and job deletion accepted                                                                        |
| `git status --short` before report                                | Clean                                                                                                          |

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                        |
| ------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      18/25 | Most concrete remediation behaviors exist, but semantic answer safety, durable request/job lifecycle evidence, negative audit evidence, and much of the required integrated matrix remain incomplete.           |
| Correctness and code quality                |      15/20 | Current authorization, timeout ownership, exact terminal replay, immutable campaign/policy updates, and conditional claiming are sound; request/job deletion and failed-audit parameter ordering are incorrect. |
| Security, privacy, and tenant isolation     |      13/20 | Replay and mid-call revocation are fixed, inputs are strict, and student output is aggregate-only; direct answer disclosure remains a critical learner-safety violation.                                        |
| Test and verification evidence              |      15/20 | All scripted suites pass and targeted tests are stronger, but the output variants, deletion paths, failed trace lineage, and required browser negative/retry/reload/lifecycle matrix are absent.                |
| Operability, recoverability, and provenance |      11/15 | Local-only dependencies, successful trace lineage, audits, clean provenance, and failure containment are positive; deletable lifecycle rows and broken failure correlation reduce diagnostic reliability.       |
| **Total**                                   | **72/100** | **FAIL**                                                                                                                                                                                                        |

## Gate decision

**FAIL.** The score is below 86 and a critical answer-safety blocker remains. Fixes must be test-first and followed by a fourth fresh independent review by a different non-implementing agent. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 3.
