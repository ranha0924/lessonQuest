# Phase 1 M5/M6 Independent Final Review — Attempt 4

- Date: 2026-08-30
- Reviewer: fourth fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed head: `f3fffa638b11afac929bc4ee5fedd3730d5c4336`
- Scope: complete base-to-head diff, canon/design/original and remediation plans, plan-gate reviews, failed final-review Attempts 1–3, memory rubric, full repository checks, and fresh adversarial probes
- Decision: **FAIL — 81/100, with a critical answer-safety blocker**

## Verdict

Attempt 4 must not be accepted, merged, deployed, or described as complete. The latest remediation rejects all 11 previously reported literal direct-answer phrases, protects Rasa request and projection-job rows from deletion, fixes failed-projection audit argument ordering, and adds real React-boundary reload, terminal-503 exact retry, and campaign replacement coverage. The final gate still fails because ordinary punctuation variants of the same direct-answer instructions bypass the Rasa output boundary. Denied/conflicting M5/M6 decisions also remain unaudited, and the integrated acceptance matrix still lacks stale/unknown actor, mid-provider revocation, ambiguous-delivery, and failed-projection execution evidence.

## Critical blocker

### 1. Direct-answer safety remains punctuation-sensitive

`validateHintOutput` removes whitespace but preserves punctuation, while its answer patterns require the option token and answer phrase to be adjacent (`packages/rasa/src/output-policy.ts:10-11`, `packages/rasa/src/output-policy.ts:26-39`). Consequently, punctuation inserted at natural grammatical boundaries bypasses the guard.

A fresh direct invocation of the built output-policy boundary rejected all 11 required literals:

```text
REJECTED 2번을 고르세요.
REJECTED Choose option B.
REJECTED 두 번째 선택지가 맞아요.
REJECTED B를 선택하세요.
REJECTED Select option B.
REJECTED Pick choice C.
REJECTED B가 맞아요.
REJECTED Option B is correct.
REJECTED The correct choice is C.
REJECTED 가장 적절한 것은 B입니다.
REJECTED Mark B as your answer.
```

Case-only and some punctuation variants such as `CHOOSE OPTION B!`, `Choose option: B.`, and `Choose Option-B.` were also rejected. However, these semantically identical, sensible punctuation variants were accepted:

```text
ACCEPTED OPTION B: IS CORRECT.
ACCEPTED Option (B) is correct.
ACCEPTED The correct choice: C.
ACCEPTED The correct choice — C.
ACCEPTED Mark B, as your answer.
ACCEPTED 가장 적절한 것은 “B”입니다.
ACCEPTED B! 가 맞아요.
ACCEPTED 2번을, 고르세요.
```

This violates the canonical requirement that Rasa not generate answers. It is a learner-safety boundary failure, not merely a missing fixture, and is therefore critical regardless of the numerical score. Normalize or tokenize ignorable punctuation before semantic matching and add adversarial mutation coverage rather than extending only a literal phrase list.

## Medium-severity findings

### 2. Denied and conflicting M5/M6 decisions are still not durably audited

The hint request writes `RASA_HINT_REQUESTED/SUCCEEDED` inside the same transaction that performs authorization and idempotency checks (`packages/db/src/rasa-repository.ts:59-118`). Unauthorized access fails before an audit insert, and changed request-ID reuse rolls back the inserted success row. Campaign creation and ending likewise audit only successful transactions (`packages/db/src/gamification-repository.ts:42-91`, `packages/db/src/gamification-repository.ts:93-134`). The API error handler maps errors but does not persist audit decisions (`services/api/src/app.ts:166-245`, `services/api/src/app.ts:677`).

This remains contrary to the approved design requirement that denied/conflicting decisions be recorded after rollback. It is not a new critical authorization bypass—the operations fail closed—but it materially weakens abuse and incident evidence.

### 3. The real-boundary acceptance matrix is stronger but still incomplete

`apps/web/test/m5-m6-e2e.test.tsx:16-184` now executes reload/resumed hint state, concurrent drains, aggregate privacy, successful trace lineage, campaign end/replacement, and terminal-503 exact request replay through React → HTTP → Hono → repositories/provider/projector → PGlite. It still does not exercise these planned browser-boundary cases:

- ambiguous event or hint transport replay and exact durable effect;
- unknown/stale actor access;
- membership or lifecycle revocation during provider work;
- failed projection containment and its trace-correlated `CONFLICT` audit;
- denied/conflict audit persistence.

Focused repository/component tests cover actor replay, membership revocation, ignored-signal timeout, terminal timeout replay, and retryable request-ID preservation. Successful projection trace ordering is exercised in the real E2E (`apps/web/test/m5-m6-e2e.test.tsx:103-111`). The failed projection argument order is now correct by inspection (`packages/db/src/gamification-repository.ts:325-345`), but no shipped test executes that branch and proves the durable failure audit.

## Verified improvements and preserved controls

- Current authorization runs before completed hint replay; the unknown-actor probe fails closed (`packages/db/test/rasa-repository.test.ts:126-135`).
- Membership removal during provider work prevents hint finalization (`packages/db/test/rasa-repository.test.ts:137-160`).
- `Promise.race` enforces timeout even when the provider ignores `AbortSignal`; the row becomes `TIMED_OUT`, and exact replay returns the same terminal retryable error (`packages/db/test/rasa-repository.test.ts:161-192`).
- All 11 previously reported literal answer phrases are rejected; the remaining critical bypass is specifically punctuation normalization.
- Assignment Rasa policy, campaign definition, terminal request, and projection-job lifecycle records reject prohibited updates/deletions (`packages/db/src/schema.ts:462-541` and focused/direct SQL assertions).
- Projection claiming uses a conditional `UPDATE ... RETURNING`, and two drains leave each job at one attempt in the real E2E (`packages/db/src/gamification-repository.ts:216-239`, `apps/web/test/m5-m6-e2e.test.tsx:65-81`).
- Both successful and failed projection audit insert argument order now binds `trace_id` to the job's ingestion trace (`packages/db/src/gamification-repository.ts:309-345`).
- React preserves the same request ID for retryable API failures, and the real terminal-503 E2E observes identical IDs (`apps/web/src/components/student-play.tsx:174-195`, `apps/web/test/m5-m6-e2e.test.tsx:141-180`).
- Teacher lifecycle covers loading, weekly/special creation, ending, and replacement; student boss output remains restricted to the five aggregate keys.
- No external AI provider, Firebase access, real student data, credential, push, merge, or deployment was introduced.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at reviewed head `f3fffa6` before this report commit.

| Command                                                                 | Result                                                                                                         |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm check`                                                   | PASS; lint, format, typecheck, 25/25 test files and 260/260 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                        | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                                | PASS as scripted; 5/5 files and 14/14 tests, with matrix gaps described above                                  |
| `corepack pnpm audit --prod`                                            | PASS; no known vulnerabilities                                                                                 |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..HEAD`       | PASS                                                                                                           |
| Changed-file credential/private-key/external-provider scan              | PASS; only the intentional malicious URL fixture matched                                                       |
| Direct 11-phrase output-policy probe                                    | PASS for the exact literals; 11/11 rejected                                                                    |
| Sensible punctuation/case mutation probe                                | FAIL; 8 direct-answer variants accepted                                                                        |
| Actor replay/revocation and ignored-signal terminal retry probes        | PASS in fresh full/focused suite; persisted outcomes match the assertions above                                |
| Campaign/policy/request/job update and deletion probes                  | PASS; prohibited mutations rejected by triggers and direct SQL regression assertions                           |
| Concurrent claim and successful projection trace probe                  | PASS in real E2E; each job has one attempt and shares ingestion trace                                          |
| Failed projection trace probe                                           | Corrected parameter order verified by inspection; no executable shipped regression evidence                    |
| React reload, terminal 503, campaign end/replacement, aggregate privacy | PASS in real E2E                                                                                               |
| `git status --short` before report                                      | Clean                                                                                                          |

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      21/25 | Most M5/M6 flows and all prior lifecycle fixes are delivered, but the core answer-safety invariant, denied/conflict audits, and parts of the integrated matrix remain incomplete.                                          |
| Correctness and code quality                |      17/20 | Authorization ordering, enforced timeout, terminal replay, immutable state machines, trace ordering, and claim logic are sound; punctuation-sensitive safety matching and missing failure-path evidence remain.            |
| Security, privacy, and tenant isolation     |      14/20 | Replay and revocation fail closed, tenant checks are repeated, inputs are strict, and student output is aggregate-only; direct answer disclosure remains a critical learner-safety defect.                                 |
| Test and verification evidence              |      17/20 | Every scripted suite passes and E2E coverage improved materially, but punctuation mutations and several planned negative/failure browser-boundary paths are absent.                                                        |
| Operability, recoverability, and provenance |      12/15 | Durable lifecycle evidence, local-only provenance, clean builds/audit, and corrected trace ordering are positive; denied/conflict audit loss and unexecuted failed-projection trace evidence reduce diagnostic confidence. |
| **Total**                                   | **81/100** | **FAIL**                                                                                                                                                                                                                   |

## Gate decision

**FAIL.** The score is below 86 and a critical answer-safety blocker remains. Fix the punctuation-insensitive semantic answer boundary test-first, add durable post-rollback denied/conflict auditing, and complete the missing failure/negative real-boundary evidence. A fifth fresh independent non-implementing reviewer must then validate the new head. No merge, push, deployment, or Phase 1 completion claim is permitted from Attempt 4.
