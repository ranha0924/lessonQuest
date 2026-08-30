# Phase 1 M5/M6 Independent Final Review — Attempt 2

- Date: 2026-08-30
- Reviewer: fresh independent non-implementing agent (different from Attempt 1)
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `7a95972`
- Scope: complete base-to-head diff, approved design/original/remediation plans, prior failed review, implementation evidence, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 68/100, with a critical answer-safety blocker**

## Verdict

Attempt 2 must not be accepted, merged, deployed, or described as complete. The remediation fixed the exact three direct-answer examples, authorizes completed hint replay before disclosure, revalidates membership after provider work, enforces an actual provider timeout, rejects the previously demonstrated status rewrites, conditionally claims projection jobs, emits the formerly absent audit action names, and adds teacher lifecycle controls plus a React-to-PGlite happy path. However, the answer guard still accepts common Korean and English letter-choice imperatives, so the canonical Rasa boundary remains bypassable. Database evidence can also be deleted or directly mutate the assignment Rasa policy, the browser does not preserve the exact hint request across retryable HTTP failures, projection audits are not trace-correlated, and the remediation-plan E2E negative/retry/reload/lifecycle matrix is mostly absent.

## Critical blocker

### 1. Direct letter-choice instructions still bypass the Rasa answer guard

`validateHintOutput` only recognizes Korean numeric/ordinal choices and English `choose`; it does not recognize Korean letter choices or the ordinary English verbs `select` and `pick`. See `packages/rasa/src/output-policy.ts:26-34`.

A fresh direct probe against the built package produced:

```text
REJECTED 2번을 고르세요.
REJECTED Choose option B.
REJECTED 두 번째 선택지가 맞아요.
ACCEPTED B를 선택하세요.
ACCEPTED Select option B.
ACCEPTED Pick choice C.
```

The first review's literal fixtures are fixed, but the controlling requirement is semantic: Rasa must not generate a direct answer and the remediation root cause explicitly names positional or letter-choice imperatives. This remains a critical product-safety blocker regardless of score.

## High-severity findings

### 2. Campaign/request/job evidence has update guards but no delete guards; Rasa policy remains directly mutable

The new triggers on `rasa_requests`, `class_boss_campaigns`, and `boss_projection_jobs` are `BEFORE UPDATE` only. Unlike the append-only evidence triggers immediately above them, they do not reject `DELETE`; see `packages/db/src/schema.ts:462-532`. A fresh PGlite probe created an active campaign, directly deleted it, and observed `{ count: 0 }`. This removes lifecycle and policy evidence outside the repository state machine.

`assignment_rasa_policies` also has no mutation trigger at all (`packages/db/src/schema.ts:151-162`), although the approved design defines one immutable policy snapshot per assignment. Direct SQL can therefore change `enabled`, `max_hint_level`, `policy_version`, or creator metadata after assignment creation. This undermines durable teacher-policy evidence even though repository authorization reads the current row.

### 3. Retryable HTTP failures do not preserve the exact hint request

`StudentPlay` retains a request ID only for transport exceptions. Every `LessonQuestApiError`, including the approved retryable provider-timeout 503, clears `hintRequestId` (`apps/web/src/components/student-play.tsx:174-193`). The next click therefore sends a new request ID. The API client also discards the response envelope's `retryable` flag, so the component cannot make the required distinction (`apps/web/src/api-client.ts:108-146`). This contradicts the remediation plan's exact terminal-503 retry requirement and the design's “same request again” behavior.

### 4. The added M5/M6 E2E omits most of the remediation acceptance matrix

`apps/web/test/m5-m6-e2e.test.tsx:16-96` is a useful real React → client → Hono → repositories/provider/projector → PGlite happy path, and it checks aggregate keys plus same-instance double drain. It does not cover exact event/hint retry after ambiguous delivery, reload/resume, terminal 503 retry, campaign end/replacement, unknown/stale actor access, membership or lifecycle revocation during provider work, or failure audit evidence. Those cases were explicitly required by remediation Task 5. Focused repository/component tests cover portions of the matrix, but there is still no browser-boundary proof for the most failure-prone retry behavior.

## Medium-severity finding

### 5. Projection audits use unrelated random trace IDs

Both successful and failed `BOSS_PROJECTION_PROCESSED` audits generate a new random trace ID rather than preserving a trace tied to the originating learning event or drain operation (`packages/db/src/gamification-repository.ts:312-315`, `packages/db/src/gamification-repository.ts:328-337`). The audit action now exists, but it is not trace-correlated as required by the approved design/remediation plan. The E2E checks only action-name presence, so it cannot detect this observability gap.

## Verified remediation improvements

- Unknown actors are authorized against current database state before completed hint replay; the focused repository test rejects the prior replay probe.
- Final hint persistence repeats active user, organization, organization membership, class membership, class/assignment window, policy, published version, ownership, and in-progress checks.
- `Promise.race` now owns the timeout; an ignoring provider reaches durable `TIMED_OUT` in the focused test.
- The three exact direct-answer strings reported in Attempt 1 are rejected.
- Direct terminal-request rewrite, campaign reactivation/policy update, and invalid job status rewrites are rejected by update triggers.
- Projection uses conditional `UPDATE ... RETURNING`; the shipped concurrency test records one attempt per job.
- Student boss responses remain aggregate-only.
- Teacher UI loads existing detail, supports WEEKLY/SPECIAL creation, ends active campaigns, and reveals creation after end.
- Formerly missing audit action names are emitted for hint requested/duplicate, boss reads, and projection processing.
- No external AI provider, Firebase access, real student data, secret, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `7a95972` before this report commit.

| Command                                                           | Result                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                             | PASS; lint, format, typecheck, 25/25 test files and 250/250 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                  | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                          | PASS as scripted; 5/5 files and 12/12 tests, with the matrix omissions described above                         |
| `corepack pnpm audit --prod`                                      | PASS; no known vulnerabilities                                                                                 |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD` | PASS                                                                                                           |
| Changed-file credential/private-key/external-provider scan        | PASS after excluding documentation mentions; no implementation credential or provider hit                      |
| Direct answer-safety probe                                        | FAIL; three additional direct choice instructions accepted                                                     |
| Direct campaign-delete PGlite probe                               | FAIL; active campaign deletion succeeded and removed the row                                                   |
| `git status --short` before report                                | Clean                                                                                                          |

The first campaign-delete probe invocation had a shell-expansion quoting error that removed `$1` and caused a SQL syntax error. It was corrected with an escaped placeholder and rerun; the corrected result above is the implementation evidence.

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                     |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      18/25 | Most prior concrete defects are remediated and teacher lifecycle exists, but semantic answer safety, exact terminal-503 retry, immutable policy/evidence, and much of Task 5 remain incomplete.              |
| Correctness and code quality                |      14/20 | Current authorization, enforced timeout, conditional claim, and legal update paths are materially better; browser retry semantics and deletable/mutable authority evidence remain incorrect.                 |
| Security, privacy, and tenant isolation     |      12/20 | Prior replay and mid-call revocation bypasses are closed and aggregate-only output holds, but direct answer instructions still pass the core Rasa safety boundary.                                           |
| Test and verification evidence              |      14/20 | All scripted suites pass and a real-boundary E2E now exists, but it omits most required negative, retry, reload, and lifecycle paths and misses the reproduced bypasses.                                     |
| Operability, recoverability, and provenance |      10/15 | Local-only provenance, builds, audit action coverage, and failure containment are positive; deletable evidence, mutable Rasa policy, uncorrelated projection traces, and retry ambiguity reduce reliability. |
| **Total**                                   | **68/100** | **FAIL**                                                                                                                                                                                                     |

## Gate decision

**FAIL.** The score is below 86 and a critical answer-safety blocker remains. Fixes must be test-first and followed by another fresh independent review by a different non-implementing agent. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 2.
