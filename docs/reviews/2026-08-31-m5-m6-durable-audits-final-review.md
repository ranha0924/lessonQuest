# M5/M6 Durable Decision Audits — Independent Final Review

- Date: 2026-08-31
- Reviewer: fresh independent `audit_final_validation` agent; no implementation participation or implementation edits.
- Worktree: `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/m5-m6-audit`
- Base: `9bcb2fb777ddae0d85248fe5df822976d17eec8c`
- Reviewed candidate: `c15d25e4bca10eee7591ef7d16cb1228c2ade423`
- Decision: **82/100 FAIL — one blocking authorization finding. Do not accept, merge, push for release, deploy, or claim completion.**

## Scope and independence

I read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final rubric in `memory/projects/lessonquest.md`, the approved durable-audits plan and its 96/97-point review, the implementation verification report and its local logs, the M5/M6 design including sections 9–10, and Attempt 9 finding 1. I inspected the complete 11-file base-to-candidate diff, both normal and whitespace-insensitive production diffs, the new internal helper, all 611 lines of the API audit cases, the repository fixture correction, and the documentation changes.

The new audit wrapper and campaign-end duplicate behavior work in the exercised cases. The blocker below is **inherited from the baseline**, not introduced by this diff. Nevertheless, the project gate explicitly prohibits acceptance with an unresolved authorization risk. It affects the same four boss entrypoints reviewed by this change, and the new audits record their unauthorized lifecycle access as success. The bounded scope cannot justify certifying that known condition as safe.

Only this review file was written inside the repository by this reviewer. Any remediation-plan documents added by the implementing agent during report preparation are excluded from the scored candidate. Additional synthetic probes and their configuration remain outside the repository under `/tmp/lessonquest-audit-independent/`. I did not change production code, tests, dependencies, index, HEAD, branch, or an external system.

## Findings

### 1. Disabled organizations retain all four boss capabilities — blocking authorization defect, inherited

**Affected code:** `packages/db/src/gamification-repository.ts:193` and `packages/db/src/gamification-repository.ts:416`. The student query checks active class/member/user state but never joins an active organization. The shared teacher predicate used by create, end, and detail likewise omits organization state. The baseline contains the same predicates at lines 148 and 358 respectively; this is not an audit-wrapper regression.

**Requirement:** M5/M6 design section 9 (`docs/superpowers/specs/2026-08-30-phase-1-m5-m6-design.md:285`) requires student boss reads, teacher campaign operations, and teacher detail to repeat current database role, membership, and lifecycle checks and collapse unauthorized access to safe not-found. The existing tenant and learning repositories also require `organizations.status='ACTIVE'`. The project memory's critical-blocker rule disallows unresolved authorization risks regardless of numerical score.

**Independent reproduction:** Using `createM56Fixture`, create a campaign under an active organization; execute the parameterized local update `UPDATE organizations SET status='DISABLED' WHERE id=$1`; keep the synthetic users, class, and memberships active; call these real Hono endpoints with the existing authenticated teacher/student tokens:

| Operation after organization disablement                           | Expected | Observed | Durable audit                       |
| ------------------------------------------------------------------ | -------: | -------: | ----------------------------------- |
| Student `GET .../boss`                                             |      404 |      200 | `BOSS_PROGRESS_READ / SUCCEEDED`    |
| Teacher `GET .../boss/detail`                                      |      404 |      200 | `BOSS_DETAIL_READ / SUCCEEDED`      |
| Teacher `POST .../boss/campaigns/:id/end`                          |      404 |      200 | `BOSS_CAMPAIGN_ENDED / SUCCEEDED`   |
| Teacher `POST .../boss/campaigns` with a new period after that end |      404 |      201 | `BOSS_CAMPAIGN_CREATED / SUCCEEDED` |

The probe deliberately collects all four responses before asserting `[404,404,404,404]`; it failed with `[200,200,200,201]`. The end and replacement creation mutate durable lifecycle state while the organization is disabled. The read paths remain able to disclose data within that suspended organization. This is an organization-suspension bypass; I did **not** reproduce a cross-tenant disclosure or credential leak.

**Evidence:** `/tmp/lessonquest-audit-independent-disabled-org.log` (exit 1, one failing probe); source `/tmp/lessonquest-audit-independent/probe.test.ts`, test `requires disabled organization to deny all four boss operations`.

**Required remediation:** First amend/review the implementation plan because it currently excludes authorization predicate changes. Require active organization state in both boss authorization predicates; add durable negative regressions for all four entrypoints that assert safe 404, one trace-correlated DENIED audit, and unchanged campaigns/contributions. Preserve active-organization success, ownership/admin rules, cross-tenant denial, and replay behavior. Obtain a fresh independent final review after implementation and full verification. Do not silently alter code under this failed review.

### 2. Infrastructure failure during Rasa finalization is still described as authorization revocation — non-blocking inherited diagnostic limitation

**Affected code:** `packages/db/src/rasa-repository.ts:444` through the `failRequest` call at line 452. A local trigger that rejects insertion into `rasa_actions` with an ordinary database exception produces a safe 500 and rolls back events/actions/usage, but the remaining request becomes `FAILED` with `error_code='RASA_AUTHORIZATION_REVOKED'` and its rejection audit is `CONFLICT`, despite no revoked authority.

The same catch/code/default classification exists in the baseline. Task 2 explicitly preserves other provider/output/finalization handling; the global statement that unknown infrastructure errors must not be mislabeled is therefore broader than the delivered scope unless read as applying to the **new wrapper**. The new wrapper correctly leaves unexpected errors unclassified. Record and separately plan the inherited finalization distinction; do not claim this change fixes all infrastructure-error classification. This issue does not disclose exception text or commit a hint, and it is not the reason for the gate failure.

**Evidence:** the passing characterization probe `characterizes inherited finalization infrastructure-error classification without claiming it fixed` in `/tmp/lessonquest-audit-independent/probe.test.ts`; run output is `/tmp/lessonquest-audit-independent-probes.log`.

## Verified behavior

- `withDecisionAudit` (`packages/db/src/decision-audit.ts:23`) awaits the repository-owned transaction. Its post-rollback insert catches only `ResourceNotFoundError` and `ConflictError`, preserves the original error after a successful audit write, and propagates audit-storage failure. An independent transaction probe inserted a business marker then threw a semantic conflict: the marker was rolled back and exactly one conflict audit survived.
- Metadata is limited to generated ID/time, trace UUID, parsed actor UUID, attempted organization/resource UUID, and allowlisted action/type/outcome. All SQL values are parameterized. Unknown actor/organization/resource identifiers work without audit FK failure. No content lookup, audit endpoint, token, answer, hint, title, raw provider output, or exception text is added. The changed-file credential scan found no matching private key, provider-token, or literal-bearer patterns.
- Checked-in cases independently passed for pre-answer/changed-identity/exhausted/in-progress conflicts, proper-role foreign-tenant access, missing scope, wrong role, membership removal, safe input/auth rejection, and audit/storage faults. A rejected preparation transaction does not retain its speculative SUCCEEDED audit.
- The corrected `DISABLED` revocation fixture now exercises actual authorization failure and asserts `ResourceNotFoundError`, instead of the previous invalid `REMOVED` SQL status and broad throw. Independent provider-time assignment, class, organization, and user revocation probes also returned 404 with exactly one terminal `RASA_HINT_REJECTED / DENIED`, no delivered hint, no action/usage, and no extra learning event. The earlier committed preparation success audit remains a distinct legitimate stage record.
- Successful hint replay preserves one effect; failed/timed-out/rejected exact replay calls no provider, adds no second rejection, and changes no business evidence. Revoked teacher authority is checked before exact campaign-end replay. The new end DUPLICATE audit does not rewrite campaign lifecycle; injected duplicate-audit failure returns safe 500 without lifecycle changes or invented denial/conflict records.
- Rasa preparation infrastructure failure after session creation rolls back the session and preparation success audit, invokes no provider, and returns a safe unclassified 500. The checked-in boss success-audit fault also rolls back its prior campaign insert.
- Schema, authentication package, response contracts, provider/output renderer, projection algorithm, frontend, dependencies, CI, and Vercel configuration are unchanged. No reference-source copying, migration, Firebase, external AI, real student data, or deployment was involved in this review.

## Independent verification

All successful checks below were run fresh at the candidate in the stated worktree with Node `v24.13.0` and pnpm `11.24.0`; the final review file was added afterward and separately formatted.

| Command / check                                         | Result                                                                                        | Evidence                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `corepack pnpm check`                                   | Exit 0; lint, format, both type checks, 26 files / 301 tests, all workspace builds            | `/tmp/lessonquest-audit-independent-check.log`        |
| `corepack pnpm test:integration`                        | Exit 0; 5 files / 32 tests                                                                    | `/tmp/lessonquest-audit-independent-integration.log`  |
| `corepack pnpm test:e2e`                                | Exit 0; 5 files / 30 tests as scripted, including API tests; **not 30 browser tests**         | `/tmp/lessonquest-audit-independent-e2e.log`          |
| `corepack pnpm audit --prod`                            | Exit 0; no known vulnerabilities                                                              | `/tmp/lessonquest-audit-independent-security.log`     |
| Outside-repository adversarial probes, initial 12 cases | Exit 0; 12/12 passed                                                                          | `/tmp/lessonquest-audit-independent-probes.log`       |
| Additional disabled-organization boss probe             | **Exit 1; expected denial failed for all four entrypoints**                                   | `/tmp/lessonquest-audit-independent-disabled-org.log` |
| `git diff --check 9bcb2fb c15d25e`                      | Exit 0                                                                                        | Independent command output                            |
| Protected-scope comparison to base                      | Exit 0; schema/auth/contracts/provider/UI source/manifest/lockfile/CI/Vercel config unchanged | Independent `git diff --exit-code` output             |
| Changed-file credential-pattern scan                    | 11 files, zero matches                                                                        | Independent command output                            |

I also inspected the implementer's baseline, corrected RED, focused GREEN, full, security, and demo-build logs. The corrected RED genuinely contains the DENIED-versus-CONFLICT and missing-DUPLICATE failures; it does not rely on the invalid fixture. The counts in the implementation report match the reviewed logs. I did not independently inspect the live site or make a new browser/demo-rendering claim. The broader React negative/failure matrix, genuine correct-first M5/M6 React scenario, production adapters, PostgreSQL multi-connection concurrency, and durable browser geometry/contrast/network tests remain outside this slice.

## Final score

| Category                                    |      Score | Evidence and deduction                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      23/25 | The new helper, mapping, revocation classification, end replay, and containment match the bounded plan. The actual boss boundary still violates the controlling lifecycle requirement and records success for suspended-organization operations. |
| Correctness and code quality                |      18/20 | Small typed helper, unchanged transaction semantics, no double failure writer, parameterized SQL, and immutable replay work. The inherited finalization classification remains misleading.                                                       |
| Security, privacy, and tenant isolation     |      10/20 | UUID-only metadata, safe responses, no content/secret logging, and tested cross-tenant denial hold. The reproduced organization-suspension bypass is an unresolved blocking authorization defect.                                                |
| Test and verification evidence              |      18/20 | Fresh full/integration/scripted-E2E/security checks and meaningful adversarial probes pass except the lifecycle probe. The checked-in new negative matrix omitted the disabled-organization boss case.                                           |
| Operability, recoverability, and provenance |      13/15 | Post-rollback durability, trace lineage, storage-failure containment, original-code provenance, and revert-only recovery are documented. Misleading inherited finalization diagnostics and local-only durability limits remain.                  |
| **Total**                                   | **82/100** | **FAIL. The score is below 86, and the blocking authorization finding independently prohibits acceptance.**                                                                                                                                      |

The implementation must remain unaccepted until the lifecycle finding is fixed under a passing amended plan, verification is rerun, and a different independent reviewer returns a score above 85 with no critical blocker. This review preserves the original candidate and failed verdict; it is not delivery approval.
