# M5/M6 Durable Decision Audits Implementation Plan

> **For agentic workers:** Use `superpowers:test-driven-development` and `superpowers:verification-before-completion`. Implement inline; assign final validation to a fresh independent agent under `AGENTS.md`.

**Goal:** Close finding 1 of the M5/M6 Attempt 9 review: preserve denied/conflicting Rasa and boss decisions after transaction rollback, with correct trace lineage and no sensitive content.

**Architecture:** A small internal database helper awaits an operation, catches only known authorization/not-found and semantic-conflict errors after rollback, writes one parameterized audit row, and rethrows. Existing success transactions, authorization predicates, provider isolation and responses remain unchanged. Rasa finalization already has durable failure handling; classify revocation there as DENIED instead of adding a second failure writer.

**Tech stack:** Existing pinned TypeScript 6.0.3, PGlite 0.5.8, Hono 4.13.5, Vitest 4.1.11, Node 24 and pnpm 11.24.0. No dependency changes.

**Spec:** `docs/PROJECT_CANON.md`; `docs/INTEGRATION_PLAN_V2.md` sections 12, 13, 16; `docs/superpowers/specs/2026-08-30-phase-1-m5-m6-design.md` sections 6, 9, 10; original M5/M6 plan tasks 6–8; final review Attempt 9 finding 1. Later level-only Rasa remediation and exact terminal retry behavior supersede the old plan's provider-text and new-retry-ID wording.

## Global constraints and scope

- Baseline `9bcb2fb777ddae0d85248fe5df822976d17eec8c`; isolated branch `codex/m5-m6-audit`.
- Synthetic local databases only. No Firebase, real students, external AI, reference-repository access, migrations, credentials or paid resources.
- No UI, auth policy, response contract, schema, provider, projection or deployment configuration changes.
- Preserve safe 404 for inaccessible/missing resources and 409 for semantic conflicts. Invalid/missing credentials and malformed inputs continue to stop before repository operations; no fabricated authenticated audit actor.
- Audit actor is the parsed server-resolved Actor. Organization/resource UUIDs denote the attempted scope, including nonexistent IDs, and never confer authorization. No FK lookup or resource existence check in the failure writer, so unknown actors/resources do not break logging or reveal existence. Internal logs remain unexposed to tenants.
- Store only server trace UUID, actor UUID, requested organization/resource UUID or null, allowlisted action/resource type/outcome, generated ID/time. Never error text, request body, token, step string, title, answer, hint or provider result.
- Do not swallow audit-storage failure: propagate to existing safe 500 diagnostics; the denied operation remains rolled back. Unknown infrastructure exceptions must not be mislabeled as DENIED/CONFLICT.
- The existing standing delivery authorization controls: guarded PR/CI/main merge and observe Git-triggered Vercel only. No manual deployment or configuration changes.
- Remaining broad React negative/failure matrix, durable visual probes, genuine correct-first React scenario and production adapters are separate follow-ups; do not claim those closed.

## Decision mapping

| Boundary                                                                                    | Action                                | Resource                                                 | Result                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Rasa preparation authorization/step failure                                                 | RASA_HINT_REQUESTED                   | RASA_REQUEST / requested request ID                      | DENIED                                              |
| Changed request identity, no unresolved wrong answer, exhausted level, in-progress conflict | RASA_HINT_REQUESTED                   | RASA_REQUEST / requested request ID                      | CONFLICT                                            |
| Revocation during provider work                                                             | RASA_HINT_REJECTED                    | RASA_REQUEST / requested request ID                      | DENIED, terminal FAILED; no action/usage/hint event |
| Campaign create denied/conflicting                                                          | BOSS_CAMPAIGN_CREATED                 | CLASS / requested class ID (campaign does not exist yet) | DENIED/CONFLICT                                     |
| Campaign end denied/conflicting                                                             | BOSS_CAMPAIGN_ENDED                   | BOSS_CAMPAIGN / requested campaign ID                    | DENIED/CONFLICT                                     |
| Exact campaign end replay                                                                   | BOSS_CAMPAIGN_ENDED                   | BOSS_CAMPAIGN / campaign ID                              | DUPLICATE in read transaction, unchanged lifecycle  |
| Student/teacher boss read denied                                                            | BOSS_PROGRESS_READ / BOSS_DETAIL_READ | CLASS / requested class ID                               | DENIED                                              |

Existing successful and provider/output/projection failure records retain their semantics. A rejected prepare transaction must leave no SUCCEEDED request audit. No new duplicate failure record for already terminal provider replay.

## Task 1: Reproduce missing durable evidence

**Files:** extend `services/api/test/m5-m6.test.ts`; create `services/api/test/m5-m6-audit-cases.ts` if isolation keeps the test readable; reuse `tests/helpers/m5-m6-fixture.ts`. Keep registration in the existing integration/E2E script-selected file.

- [x] Baseline: `corepack pnpm install --frozen-lockfile && corepack pnpm test`.
- [x] Test via real Hono/LocalAuth/repositories/PGlite requests, not mocked API/repository SQL. Inspect literal audit outcomes matched to response `x-trace-id` and error trace; verify rolled-back business rows and unchanged replay effects.
- [x] Rasa cases: pre-answer conflict, changed request-ID step, unknown/cross-tenant scope, removed membership, provider-time revocation, exhausted levels, successful exact replay. Assert one decision record, and no rolled-back SUCCEEDED prepare record.
- [x] Boss cases: create/end/read denies for wrong role and cross-tenant/unknown class; active campaign conflict; missing campaign; changed end-request conflict; exact end replay with same ended timestamp and one DUPLICATE row.
- [x] Direct repository unknown-actor case proves no audit FK dependence. Database-trigger fault injection proves unexpected failure is not misclassified and audit-write failure never produces success or leaks exception text.

Representative behavior assertion (expected values are independent literals):

```ts
expect(response.status).toBe(409);
const traceId = response.headers.get('x-trace-id');
expect(await response.json()).toMatchObject({ error: { code: 'RESOURCE_CONFLICT', traceId } });
const rows = await database.query(
  'SELECT action,outcome,resource_id FROM audit_logs WHERE trace_id=$1',
  [traceId],
);
expect(rows.rows).toEqual([
  { action: 'RASA_HINT_REQUESTED', outcome: 'CONFLICT', resource_id: requestId },
]);
```

- [x] RED: `corepack pnpm deps:build && corepack pnpm exec vitest run services/api/test/m5-m6.test.ts`; retain expected missing audit / wrong outcome failures, not setup errors.

## Task 2: Preserve decision records after rollback

**Files:** create `packages/db/src/decision-audit.ts`; modify `packages/db/src/rasa-repository.ts`, `packages/db/src/gamification-repository.ts` only.

Internal interface (not exported from package index):

```ts
type DecisionAudit = {
  traceId: string;
  actorUserId: string;
  organizationId: string;
  action:
    | 'RASA_HINT_REQUESTED'
    | 'BOSS_CAMPAIGN_CREATED'
    | 'BOSS_CAMPAIGN_ENDED'
    | 'BOSS_PROGRESS_READ'
    | 'BOSS_DETAIL_READ';
  resourceType: 'RASA_REQUEST' | 'CLASS' | 'BOSS_CAMPAIGN';
  resourceId: string;
};
async function withDecisionAudit<T>(
  database: PGliteInterface,
  audit: DecisionAudit,
  operation: () => Promise<T>,
): Promise<T>;
```

- [x] Await operation in try/catch. Map `ResourceNotFoundError` to DENIED, `ConflictError` to CONFLICT; otherwise rethrow without classification. Parameterize every value in the same allowlisted audit columns as existing repositories.
- [x] Wrap Rasa preparation transaction and all four public boss transactions. Keep input parsing before the helper and provider calls outside transactions. No changes to authorization queries.
- [x] Existing Rasa finalization catch passes DENIED to `failRequest` for `ResourceNotFoundError`; other provider/output/finalization errors keep their existing conflict handling. Avoid double logging the same revocation.
- [x] Add transaction-bound DUPLICATE audit on exact campaign-end replay; widen the private lifecycle audit outcome type to the finite allowed union.
- [x] GREEN: rebuild dependencies then rerun the focused API and Rasa/boss repository suites. Inspect actual complete diff and schema/lock/config equality to baseline.

## Task 3: Verify, independently review and deliver

**Files:** update `README.md`, append current evidence/remaining follow-ups in `memory/projects/lessonquest.md`, create `docs/reviews/2026-08-31-m5-m6-durable-audits-verification.md`, independent `...-final-review.md`. Original LessonQuest code only; no copied source.

- [x] Run `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm audit --prod`, `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build`, changed-file secret-pattern scan, `git diff --check 9bcb2fb`.
- [x] Record RED/GREEN counts, full checks and limitations. No React/browser claims from Hono tests.
- [x] Fresh independent reviewer inspects complete baseline diff, runs relevant adversarial/full checks, edits only its review, scores using project rubric. Require >85 and no critical blocker. Attempt 1 scored 82/100 FAIL; the separately gated organization remediation was reviewed by a different agent in Attempt 2 at 96/100 PASS with no critical blocker.
- [ ] Commit all reviewed work, push branch, open PR, verify exact head CI, recheck main/head and use expected-head merge without protection bypass. Sync local main; inspect merged tree and run focused checks.
- [ ] Observe the existing Git-linked Vercel status for the merged commit, verify live URL from deployment evidence when available. Static demo remains synthetic; deploying its unchanged assets does not deploy the local API audit feature.

## Recovery and limits

Rollback is a reviewed commit revert; no schema/data rewrite or deletion is needed. Already appended audit rows remain valid. No network DB concurrency or disaster durability is claimed: tests use fresh PGlite. If DB audit storage is unavailable, safe 500 diagnostics replace 404/409; no in-memory fallback can be called durable. Preview/live access restrictions are reported without bypassing authentication or creating a second deployment.

## Test-fixture correction before finalization changes

Inspection found the original repository revocation test uses `REMOVED`, which is not a legal `class_members.status` (`ACTIVE | DISABLED`), and accepts any thrown error. This simulates a provider failure instead of authority revocation. Add `packages/db/test/rasa-repository.test.ts` to the test-only scope: use `DISABLED`, require `ResourceNotFoundError` for finalization revocation, and restore `ACTIVE` afterward. New API fixtures use the same legal status. Reproduce the actual DENIED-versus-CONFLICT mismatch before enabling the finalization outcome change. This does not change schema or authorization policy.
