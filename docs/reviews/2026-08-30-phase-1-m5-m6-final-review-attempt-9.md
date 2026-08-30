# Phase 1 M5/M6 Independent Final Review — Attempt 9

- Date: 2026-08-30
- Reviewer: ninth fresh independent non-implementing agent
- Base: `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`
- Reviewed implementation head: `d1ef49d46ba56655dd66c5194ae98ee30005eea7`
- Scope: canon, approved design and implementation/remediation plans, plan-gate reviews, failed final-review Attempts 1–8, complete base-to-head diff, full repository checks, and fresh output-boundary probes
- Decision: **PASS — 88/100, no critical blocker**

## Verdict

Attempt 9 passes the independent final-validation gate. The Attempt 8 blocker is removed: learner-visible Phase 1 Rasa output is now selected solely by hint level from three fixed server-owned strings. Artifact concept, simulation, question, objective, and provider-authored text cannot be interpolated into accepted content. The repository independently computes the level-only expected string and rejects any provider action that does not match it exactly.

Fresh adversarial verification exercised all three levels with 64 hostile concept/simulation pairs per level. No hostile input influenced output, actual local-provider actions passed at all three levels, and 24 arbitrary direct-answer/link/markup/code/homoglyph/invisible substitutions were rejected. The earlier authorization, mid-call revocation, timeout, immutable evidence, conditional job claim, trace lineage, exact retry, teacher lifecycle, and aggregate-only student controls remain present and green.

Two non-blocking quality gaps remain: denied/request-identity-conflict decisions are not durably audited after rollback, and the real React-to-database E2E does not cover the complete approved negative/failure matrix (and its “correct-first” test name actually exercises retry-correct). These reduce the score but do not leave an authorization, tenant-isolation, privacy, answer-safety, or data-integrity bypass.

## Attempt 8 blocker resolution

### Closed level-only learner-output set

`packages/rasa/src/local-provider.ts:6-14` defines exactly three fixed Korean scaffolds and `buildLocalHintContent` accepts only `1 | 2 | 3`. `LocalRasaProvider.generateHint` uses only the hint level to select learner-visible content (`packages/rasa/src/local-provider.ts:19-32`); concept and simulation strings remain usage-input evidence but do not reach the action content.

`RasaRepository` independently derives expected content from the authoritative prepared level (`packages/db/src/rasa-repository.ts:274-284`). `validateHintOutput` requires exact content equality in addition to strict action target/level, alphabet, semantic, structural, and answer-key checks (`packages/rasa/src/output-policy.ts:53-91`). An arbitrary provider can therefore return only the same safe fixed action content; any substituted content is rejected before action, usage, or hint-event persistence.

The shipped provider regression covers hostile direct-answer, URL, HTML, and Markdown input at all three levels (`packages/rasa/test/local-provider.test.ts:31-55`). A fresh built-package probe expanded this to these independent results:

```text
levels: 3
hostile concept/simulation pairs per level: 64
hostile-output influence failures: 0
actual LocalRasaProvider outputs accepted: 3/3
arbitrary provider substitutions accepted: 0/24
```

The three accepted values were exactly:

```text
문제에서 무엇이 계속 유지되는지 먼저 찾아보자.
실험 전과 후의 운동 상태를 각각 비교해 보자.
원인, 변한 것, 유지된 것을 차례로 설명해 보자.
```

## Preserved prior controls

- Completed hint replay first verifies current actor, tenant, class, assignment, policy, version, and attempt authority; unknown actors cannot disclose another student's action (`packages/db/src/rasa-repository.ts:63-121`).
- Hint finalization repeats current membership/lifecycle/ownership checks under the attempt lock (`packages/db/src/rasa-repository.ts:297-310`).
- Provider work is bounded by an owned timeout and terminal timeout replay preserves retryability and request identity; focused repository and React tests pass.
- Database triggers reject prohibited update/delete of assignment Rasa policy, terminal Rasa requests, campaign definitions/lifecycle, projection jobs, and append-only learning/audit/action/usage/contribution evidence.
- Conditional projection claiming and repository serialization preserve one successful processing attempt in the tested concurrent drain; success and failure audits use the originating trace ID.
- Student boss responses retain only `campaignId`, `title`, `targetHp`, `damage`, and `completed`; teacher detail remains current-role/class guarded.
- Teacher UI supports active detail, weekly/special creation, end, and replacement. Browser terminal-503 retry preserves the exact Rasa request ID.
- The implementation remains local and synthetic: no external AI provider, Firebase access, real student data, credential, source-repository mutation, push, merge, or deployment was introduced.

## Remaining non-blocking findings

### 1. Denied and semantic-conflict M5/M6 decisions lack durable post-rollback audits (medium)

Rasa authorization failure happens before `RASA_HINT_REQUESTED`, while changed request-ID reuse throws from the transaction (`packages/db/src/rasa-repository.ts:63-121`). Campaign authorization and active/ended conflicts likewise throw without an outer durable `DENIED` or `CONFLICT` audit (`packages/db/src/gamification-repository.ts:42-134`). Provider/output failures and projection conflicts are audited, but the complete design-section-10 decision matrix is not.

The affected operations fail closed and no data is disclosed or mutated, so this is an observability gap rather than a critical authorization blocker. Add post-rollback, trace-correlated denial/conflict audit paths before a production adapter.

### 2. Real-boundary negative/failure coverage remains incomplete (medium)

`apps/web/test/m5-m6-e2e.test.tsx:16-184` proves React → HTTP client → Hono → repository/provider/projector → PGlite for hint persistence/reload, retry-correct and completion projection, concurrent drain, aggregate privacy, success trace lineage, campaign end/replacement, and terminal-503 exact request replay. It does not exercise through that same boundary:

- ambiguous event or hint delivery replay with one durable effect;
- unknown/stale/cross-tenant actors;
- membership, assignment, or class revocation during provider work;
- projection failure containment with conflict-trace evidence;
- durable denied/request-identity-conflict auditing.

Focused repository and component tests cover several underlying controls. Also, the E2E title at line 17 says “correct-first,” but the flow at lines 51–63 is wrong-answer → hint → retry-correct; a genuine correct-first contribution remains absent from this integrated M5/M6 scenario.

## Independent verification record

All commands were run fresh from `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/phase1-m5-m6-complete` at implementation head `d1ef49d46ba56655dd66c5194ae98ee30005eea7` before this report commit.

| Command / probe                                                                   | Result                                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                         | PASS; lockfile already current                                                                                 |
| `corepack pnpm check`                                                             | PASS; lint, format, typecheck, 25/25 test files and 281/281 tests, all workspace builds, Vite production build |
| `corepack pnpm test:integration`                                                  | PASS; 5/5 files and 16/16 tests                                                                                |
| `corepack pnpm test:e2e`                                                          | PASS as scripted; 5/5 files and 14/14 tests, with the matrix gaps above                                        |
| `corepack pnpm audit --prod`                                                      | PASS; no known vulnerabilities                                                                                 |
| `git diff --check e5e1e04a0dcc02ff094e811e625c11a3b211bccf..d1ef49d`              | PASS                                                                                                           |
| Changed-file private-key/bearer/provider-key scan                                 | PASS; no matches                                                                                               |
| Level-only hostile input influence probe                                          | PASS; 0/192 influenced outputs                                                                                 |
| Actual local-provider output validation                                           | PASS; 3/3 levels accepted                                                                                      |
| Arbitrary provider substitution probe                                             | PASS; 0/24 unsafe substitutions accepted                                                                       |
| Prior authorization/revocation, timeout/retry, SQL guard, claim, privacy controls | PASS in fresh full/integration/E2E suites and source inspection                                                |
| `git status --short` before report                                                | Clean                                                                                                          |

## Final implementation score

| Category                                    |      Score | Evidence                                                                                                                                                                                                               |
| ------------------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      22/25 | M5/M6 core behavior and the canonical answer-safe boundary are delivered. Durable denied/conflict audits and parts of the integrated negative matrix remain incomplete.                                                |
| Correctness and code quality                |      19/20 | The level-only rendering boundary is simple and closed; authorization, timeout, lifecycle, idempotency, and projection paths remain sound. Minor duplication from retaining legacy blacklist checks is non-blocking.   |
| Security, privacy, and tenant isolation     |      19/20 | Current authority fails closed, student reads are aggregate-only, server derives correctness/damage, and hostile artifact/provider text cannot reach accepted hints. No critical security or privacy bypass was found. |
| Test and verification evidence              |      16/20 | Full suites and fresh adversarial probes pass, including all-level hostile rendering. The browser-boundary negative/failure matrix and genuine correct-first M5/M6 E2E remain incomplete.                              |
| Operability, recoverability, and provenance |      12/15 | Immutable evidence, timeout behavior, projection containment/trace lineage, local-only provenance, clean audit/builds, and teacher lifecycle are strong; denied/conflict audit gaps reduce diagnostics.                |
| **Total**                                   | **88/100** | **PASS**                                                                                                                                                                                                               |

## Gate decision

**PASS.** The score is above 85 and no critical blocker remains. The implementation satisfies the independent final-validation gate and may be accepted as the local M5/M6 completion candidate. This review does not authorize or perform merge, push, deployment, Firebase access, external-provider access, or real-student-data access. The two remaining findings should be tracked before production-adapter work.
