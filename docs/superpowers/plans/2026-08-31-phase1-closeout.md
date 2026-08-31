# Phase 1 Closeout Implementation Plan

> **For agentic workers:** Execute the approved plan with test-driven development. Independent browser-test work may be delegated using `superpowers:dispatching-parallel-agents`; a separate non-implementing agent must validate the complete final diff.

**Goal:** Close the documented Phase 1 verification gaps and the failures they expose, then deliver the complete synthetic local M1–M6 slice through the existing Git-linked deployment.

**Architecture:** Keep React → HTTP client → real Hono/LocalAuth → repositories → fresh PGlite and deterministic Rasa intact. Inject only transport delivery faults and synthetic provider/database failures. Retain unacknowledged client operations for exact retry, serialize learning/hint writes, and classify Rasa finalization failures accurately. Add a pinned Chromium regression suite for the unchanged static demo.

**Tech Stack:** Existing Node 24+, pnpm 11.24.0, TypeScript/React/Vitest/PGlite workspace; add dev-only `@playwright/test` exactly `1.62.1` (registry checked 2026-08-31).

**Spec:** `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md` sections 13–14, `docs/superpowers/specs/2026-08-30-phase-1-m5-m6-design.md`, `docs/superpowers/plans/2026-08-30-phase-1-m5-m6.md`, and the remaining findings in `docs/reviews/2026-08-31-m5-m6-durable-audits-final-review-attempt-2.md`.

## Constraints and acceptance

- Base: `fe206c1f9f69e10dbc15a7abc656d0b1636ad93d`; isolated branch `codex/phase1-closeout`.
- No Firebase, real student data, external AI, reference repository changes, production authentication/database connection, new paid resources, schema migration, or Vercel configuration changes. Existing authorization, immutable evidence, fixed hint rendering and server-owned scores remain mandatory.
- “Phase 1 complete” means the approved synthetic local vertical slice. The public Vercel site remains a static synthetic demo, not a production backend.
- Do not change existing requirements to make tests pass. Existing reviewed successes get additional regression evidence; tests already passing are recorded as baseline characterization, not invented RED.
- Each production correction requires an observed behavior failure first. Browser tests must detect controlled geometry/contrast faults; do not use source-string assertions or test-only controls in production.
- Add only dev browser tooling; pin its lockfile. Chromium downloads occur during setup/CI, never from the running demo. Restrict browser test traffic to the managed local server; abort and report every external request.

| Completion evidence      | Concrete behavior                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1–M4 authoring boundary | Synthetic authenticated teacher creates org/class/student through real API; React saves fixture JSON, validates, displays scripts-only preview, approves and assigns. Student React completes it and teacher React shows persisted results.      |
| M5/M6 retry path         | Wrong answer → fixed safe hint → remount/resume → retry correct → completion → drain projector → aggregate damage 8 and teacher evidence, with exact event and audit lineage.                                                                    |
| Genuine correct-first    | No wrong answer/hint/provider call; first correct contributes 2, completion 5, aggregate 7; no hint usage, one attempt, no retry reason.                                                                                                         |
| Ambiguous delivery       | Transport failure before commit and response loss after commit for answers/completion/hints; exact request body/ID retained on retry; one durable effect; no speculative UI success. Remount uses server-owned state.                            |
| Overlapping actions      | Pending learning event prevents a different choice/hint/completion until retry settles. Pending hint prevents answer/completion. Repeated start/end actions cannot corrupt ACK state or create changed end IDs.                                  |
| Negative outcomes        | Real 404 revocation/cross-tenant or wrong-role access, rejected provider output, timeout/provider failure, hint exhaustion, and database faults cannot reveal hints or add false progress/contribution.                                          |
| Accurate diagnostics     | Actual authorization loss is DENIED. Generic finalization faults are FAILED with `RASA_FINALIZATION_FAILED`, safe retryable 503 on initial and exact replay, no invented DENIED/CONFLICT audit and no action/usage/hint event.                   |
| Durable browser checks   | 1440×900, 768×1024, 375×812; initial/wrong/hinted/completed/teacher/reset states; no overflow/errors/external traffic, 44px targets, dark surfaces, critical text contrast ≥4.5, keyboard focus, reduced motion and working fragment navigation. |

## Task 1 — Real React-to-database closeout matrix

**Files:** create `apps/web/test/phase1-flow.test.tsx`, `apps/web/test/phase1-recovery.test.tsx`, `apps/web/test/phase1-negative.test.tsx`, and `apps/web/test/phase1-fixture.ts`; correct the misleading correct-first name in `apps/web/test/m5-m6-e2e.test.tsx`; only if RED requires it, change `apps/web/src/components/student-play.tsx` and `boss-campaign-panel.tsx`. Existing `apps/web/test/m5-m6-fixture.ts` may accept a test-only diagnostic sink and configurable synthetic setup; do not move unrelated files.

**Interfaces:** reuse `createApp`, repositories, `createHttpLessonQuestApi`, `StudioWorkbench`, `StudentPlay`, and `BossCampaignPanel`. Test bridge forwards actual requests to `app.request`; it may throw before forwarding or after awaiting a committed response. Capture bodies at this external transport boundary, never mock repository results.

- [ ] Write the full authoring/student/teacher flow and literal correct-first accounting. Assert event types/sequences, teacher counts, student aggregate-only response, request/action/usage counts, and contribution reasons. Use typed schema parsing for API-created identities.
- [ ] Add recovery/negative cases from the table. Retain full request bodies and check equality only where identity preservation is the production contract; pair every transport assertion with UI and database effects.

```ts
const response = await fixture.app.request(url, init);
if (loseNextAnswerResponse && url.endsWith('/learning-events')) {
  loseNextAnswerResponse = false;
  throw new TypeError('synthetic response lost after commit');
}
return response;
// After the real UI reports a failed save:
expect(screen.getByRole('button', { name: '질량 6 kg 선택' })).toHaveProperty('disabled', true);
fireEvent.click(screen.getByRole('button', { name: '기록 다시 전송' }));
await screen.findByText('정답이에요!');
expect(answerBodies[1]).toBe(answerBodies[0]);
expect(
  (
    await database.query(
      "SELECT count(*)::int n FROM learning_events WHERE type='QUESTION_ANSWERED'",
    )
  ).rows,
).toEqual([{ n: 1 }]);
```

- [ ] RED: run the new recovery tests against untouched components; preserve missing retry UI, unlocked competing action, or changed end-ID failures. Do not count fixture/type errors as RED.
- [ ] Minimal correction: store the unacknowledged answer/completion event in component state/ref and expose an explicit retry action using that same event. Disable competing choices/hints/completion until acknowledged. Use a synchronous ref lock plus visible pending state for in-flight writes. Start retains existing server-resume behavior; synchronize after hints only with no pending event. Never store tokens/answers in browser persistence.
- [ ] Boss end retains one request UUID through transport/retryable failure and disables duplicate in-flight submission; clear it only after success or definitive nonretryable response. Its server authorization remains unchanged.
- [ ] GREEN: new real boundary files plus existing web, SDK, API and repository regressions. Inspect no pending asynchronous request survives fixture cleanup.

## Task 2 — Rasa finalization diagnostic correction

**Files:** `packages/db/src/rasa-repository.ts`; add cases to `services/api/test/m5-m6-audit-cases.ts` (already in all current verification scripts); test-only fixture diagnostic injection if needed. No audit schema change.

- [ ] Install a synthetic database trigger rejecting `rasa_actions` insertion after hint events are attempted. Call the real hint API after a wrong answer. Require the safe retryable error code below and unchanged authority; check FAILED request, zero accepted action/usage/hint events and no terminal DENIED/CONFLICT record. Remove trigger and replay same request: same error, no provider rerun, no newly persisted hint. A new request may succeed after recovery. Retain actual revocation tests.

```ts
expect(await response.json()).toMatchObject({
  error: { code: 'RASA_FINALIZATION_FAILED', retryable: true, traceId },
});
expect(response.status).toBe(503);
expect(requestRows).toEqual([{ status: 'FAILED', error_code: 'RASA_FINALIZATION_FAILED' }]);
```

- [ ] Observe RED against the inherited `RASA_AUTHORIZATION_REVOKED` / CONFLICT classification.
- [ ] Extend the finite `RasaRequestError.code` union with `RASA_FINALIZATION_FAILED`. Select prior `error_code` for terminal replay; replay this code as retryable and authorization-revoked failure as `ResourceNotFoundError` after current authorization. Existing provider FAILED/TIMED_OUT/REJECTED behavior stays intact.
- [ ] Finalization catch: `ResourceNotFoundError` retains existing FAILED/revoked/DENIED flow and original throw. Ordinary finalization exception persists FAILED/finalization code with no semantic-decision audit, then throws the safe typed Rasa error with cause. `failRequest` accepts `outcome: 'DENIED' | 'CONFLICT' | null`; skip only the audit insert for null. Its request state update remains transactional; storage failure propagates to existing safe 500 containment. The already-committed valid preparation audit is preserved.
- [ ] GREEN and probe trace/diagnostic redaction, rollback, provider count, fresh-request recovery, and initial/replay consistency.

## Task 3 — Durable local Chromium regression checks

**Files:** add `playwright.config.ts`, `tests/browser/demo.spec.ts`, and focused browser-only helpers as needed; modify root `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.gitignore`, `.github/workflows/ci.yml` for pinned dev tooling and verification. Browser owner alone edits these shared tooling files until handoff; root adds new React files to `test:e2e` afterward.

- [ ] Add exact dev dependency with `corepack pnpm add -Dw -E @playwright/test@1.62.1`. Add `test:browser` which builds the synthetic demo then runs Playwright. Typecheck config/spec; use `.spec.ts` so Vitest's `.test.ts` include does not overlap. Ignore Playwright outputs.
- [ ] Configure managed Vite preview on `http://127.0.0.1:4178`, `reuseExistingServer: false`, Chromium only, serial or bounded workers, retries 0, three named viewport projects. Do not use production URLs, credentials, or a user's browser profile. Test runner owns and closes only its server/browser.
- [ ] Assert geometry/contrast/dark-surface behavior in the live rendered DOM at every relevant state. Exercise reset, role switch, hint and completion through accessible controls. Capture JS/page errors and external request attempts. Verify anchor destinations, keyboard focus and reduced motion with concrete DOM/computed-style evidence.
- [ ] Prove the assertions can fail: temporarily inject a small-button/low-contrast style in the local test context and observe expected violations using the same measurement helper. Remove all injected faults before acceptance runs. Keep no production bypass flag.
- [ ] Run Chromium locally. Add CI steps after existing full check/audit: install Chromium with system dependencies and run `pnpm test:browser`. Retain pinned actions, read-only permissions and current gates; no workflow bypass.

Reference: [Playwright managed web server](https://playwright.dev/docs/test-webserver) and [CI setup](https://playwright.dev/docs/ci-intro). This is a checked-in CI test runner, not automation of a user's signed-in browser.

## Task 4 — Phase 1 closure evidence and guarded delivery

**Files:** `README.md`, `memory/projects/lessonquest.md`, new `docs/reviews/2026-08-31-phase1-closeout-verification.md`, new `docs/PHASE1_COMPLETION.md`, and independent `docs/reviews/2026-08-31-phase1-closeout-final-review.md`. Update the old plan's completed milestone pointers only with verified evidence; preserve historical failures.

- [ ] Add the three new React suites to `test:e2e`; run `corepack pnpm check`, `test:integration`, `test:e2e`, `test:browser`, `audit --prod`, full-range whitespace check and changed-file secret-pattern scan. Record exact counts and what uses Chromium versus jsdom.
- [ ] Closure matrix maps M1–M6 to checked-in tests and local runtime boundaries. Explicitly separate Phase 2 features/production adapters, real PostgreSQL concurrency, external AI and operating-service readiness. No unsupported “all possible errors tested” claim.
- [ ] Assign a fresh independent non-implementer to inspect the full actual diff and evidence, rerun relevant checks and adversarial scenarios, and score using the project final rubric. Require >85 and no critical blocker; any failure gets a separately gated correction and fresh review.
- [ ] Commit and push only after acceptance gate. Open PR, require exact-head full/browser CI, recheck base and head, merge with expected-head guard, sync local main and check merged tree/tests. Verify main CI, existing Vercel Production deployment SHA/status and public URL/assets. Never manually duplicate deployment.

## Recovery

No migrations or real data writes. Recover code via reviewed revert without restoring known authorization holes. Existing immutable event/audit evidence remains intact. Browser tooling can be reverted independently without changing runtime. If local database/audit storage is unavailable, fail closed with safe errors; never promise durability while storage is down. If any added test exposes a broader issue, write a narrow plan amendment and score it before modifying production outside this file list.
