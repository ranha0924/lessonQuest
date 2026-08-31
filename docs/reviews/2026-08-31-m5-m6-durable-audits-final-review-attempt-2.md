# M5/M6 Durable Decision Audits — Independent Final Review, Attempt 2

- Date: 2026-08-31
- Reviewer: fresh independent `audit_final_validation_2` agent, separate from the implementer and first reviewer.
- Worktree: `/Users/ranha/Documents/ChatGPT/lessonQuest/.worktrees/m5-m6-audit`
- Base: `9bcb2fb777ddae0d85248fe5df822976d17eec8c`
- Reviewed candidate: `7a461ec3b76f1dbc845793fed13acbdb73afe5e5`
- Decision: **96/100 PASS, no critical blocker.** The reviewed implementation passes the independent final gate. Release still requires the standing CI, merged-result, and deployment verification steps.

## Independence and reviewed scope

I did not implement or remediate this change. I read `AGENTS.md`, `docs/PROJECT_CANON.md`, the final implementation rubric in `memory/projects/lessonquest.md`, the original durable-audits plan and its revised **97/100** review, the organization-lifecycle remediation plan and its **98/100** review, M5/M6 design sections 9–10, Attempt 9's audit finding, the first **82/100 FAIL**, and the complete implementer verification report. I inspected the complete 14-file base-to-candidate diff, including normal and whitespace-insensitive production diffs, all 663 lines of the new API audit cases, the repository fixture correction, and documentation. I also compared the failed candidate to the remediation: production remediation consists of exactly the two approved active-organization joins.

I independently rebuilt dependencies, ran the focused API/Rasa/boss suites and full check, reran the first review's 13 outside-repository probes, and wrote five additional independent probes. Those additional probes test lifecycle reactivation, owner/admin/nonowner behavior, spoofed trace and diagnostic privacy, audit-storage failure on a disabled-organization end replay, and unknown-error identity after rollback. All synthetic probes and their configuration remain under `/tmp/lessonquest-audit-attempt2-probes/`; the previous probes remain unchanged under `/tmp/lessonquest-audit-independent/`.

Only this review file was written inside the repository by this reviewer. No production or test source, index, HEAD, branch, dependency declaration, external system, or reference repository was changed. The full checks ran at the candidate before this review file was added; the review was separately formatted and checked afterward. The first failed review is preserved unchanged.

## Findings and remediation assessment

### 1. Disabled-organization boss bypass is fixed — previous blocker closed

`packages/db/src/gamification-repository.ts:193` now requires an active organization for student progress. The common teacher authorization predicate at `packages/db/src/gamification-repository.ts:416` adds the same tenant-matched requirement while preserving existing user, member, class, ownership, and administrator checks. `endCampaign` calls that predicate at line 132 before inspecting the campaign or accepting exact replay at lines 139–150. No protected business read, lifecycle update, or replay return precedes authorization.

The five checked-in API regressions beginning at `services/api/test/m5-m6-audit-cases.ts:395` passed independently. They isolate organization disablement while keeping users, class, and memberships active, require literal safe 404 envelopes and one trace-correlated DENIED row, and compare complete campaign rows and contributions afterward. My separate workflow probe repeated the operations and then reactivated the organization, proving that active behavior is restored without altering the prior campaign evidence.

| Operation while organization is disabled | Independently observed                    | Business effect |
| ---------------------------------------- | ----------------------------------------- | --------------- |
| Student boss progress                    | 404; one `BOSS_PROGRESS_READ / DENIED`    | No change       |
| Teacher boss detail                      | 404; one `BOSS_DETAIL_READ / DENIED`      | No change       |
| Teacher campaign create                  | 404; one `BOSS_CAMPAIGN_CREATED / DENIED` | No change       |
| Teacher campaign end                     | 404; one `BOSS_CAMPAIGN_ENDED / DENIED`   | No change       |
| Exact campaign-end replay                | 404; one `BOSS_CAMPAIGN_ENDED / DENIED`   | No change       |

My owner/admin probe also verifies an ordinary TEACHER class owner can create and read detail; after transferring ownership, that same ordinary teacher is denied detail, end, and create with no changes; changing the synthetic membership to ORG_ADMIN restores detail, end, exact replay, and replacement creation. The remediation therefore closes the prior blocker without widening the existing ownership boundary.

### 2. Generic Rasa finalization database failures retain an inaccurate cause label — nonblocking inherited limitation

`packages/db/src/rasa-repository.ts:444` still sends every finalization exception through `failRequest` with `error_code='RASA_AUTHORIZATION_REVOKED'` at line 451. A trigger that rejects a `rasa_actions` insert with an ordinary database exception independently reproduced safe 500, zero action/usage/new hint events, a FAILED request, and a `RASA_HINT_REJECTED / CONFLICT` audit despite unchanged authority.

The baseline already contains this generic catch/cause classification. The new helper correctly leaves unknown infrastructure exceptions unclassified; the approved slice changes actual revocation to DENIED without claiming to fix the inherited generic-finalization branch. This does not grant access, reveal the raw exception, or commit a hint. It remains a separate diagnostic follow-up and reduces correctness/operability scores. The original plan's broad infrastructure-classification statement must continue to be read with this explicitly documented limitation; do not advertise universal error classification as fixed.

No additional blocking defect was found in the reviewed scope.

## Verified behavior and safety evidence

- `packages/db/src/decision-audit.ts:23` awaits the repository-owned operation and only handles `ResourceNotFoundError` or `ConflictError` after rollback. The successful audit insert rethrows the original error. Independent probes inserted a business marker and then threw: the marker rolled back, the semantic decision survived once, and an ordinary infrastructure exception preserved identity with no invented decision audit.
- All five intended operation boundaries use the helper after parsing actor, route UUIDs, input, and trace. Failure metadata is limited to generated ID/time, parsed actor UUID, attempted organization/resource UUID, and finite action/type/outcome fields. SQL values are parameterized; there is no protected-content lookup or new audit API. Unknown actor/resource UUIDs do not require foreign-key existence.
- Checked-in conflicts cover no wrong answer, changed request identity, exhausted levels, active-campaign conflict, changed end-request identity, and an in-flight same-ID hint. Denials cover unknown scope, proper-role foreign-tenant access, wrong role, membership removal, and disabled organizations. Rejected preparation leaves no speculative SUCCEEDED audit or request effect. Invalid authentication/input does not fabricate an authenticated audit actor.
- Actual provider-time revocation produces one terminal `RASA_HINT_REJECTED / DENIED`, in addition to its previously committed legitimate preparation record, with no action, usage, or hint event. Fresh probes repeat assignment, class, organization, and user revocation. The corrected repository fixture now uses schema-valid `DISABLED` and specifically expects `ResourceNotFoundError`.
- Successful hint replay has one durable effect. FAILED, TIMED_OUT, and REJECTED exact replay calls no provider, adds no second terminal rejection, and leaves business evidence unchanged. Campaign end replay writes one DUPLICATE while retaining the complete ended campaign row. Revoked teacher authority and disabled organization state are checked before replay.
- Audit-storage failures return safe 500 and cannot turn denied work into success. Separate fault probes cover Rasa preparation rollback, campaign creation rollback after a success-audit fault, duplicate-audit failure, and disabled-organization end-replay denial-audit failure. Raw fault text is absent from the response and captured safe diagnostics; no fabricated DENIED/CONFLICT record is appended for an ordinary infrastructure failure in the new wrapper.
- My trace probe supplies a client `x-trace-id` and private title. The API generates a different server trace shared by the conflict response, durable audit, and allowlisted diagnostic. The client trace, title, token, and private body text appear in none of those outputs.
- The protected-path comparison confirms no schema, auth package, shared contracts, Rasa provider/output policy, frontend source, dependency manifest/lockfile, CI, or Vercel configuration change. The projection implementation is unchanged. Credential-pattern scanning of all 14 candidate files found no private-key, provider-token, or literal-bearer match. All work used synthetic local PGlite data; no Firebase, external AI, real student data, or reference-source copying was involved.

## Independent verification

Node `v24.13.0`, pnpm `11.24.0`; every command below completed with exit 0. There were no failed or skipped tests in these fresh runs.

| Independent command/check                                                                         | Result                                                                                                     | Evidence                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `corepack pnpm deps:build` followed by focused API/Rasa/boss repository suites                    | Dependency rebuild; 3 files / **24 tests PASS**, including five disabled-organization regressions          | `/tmp/lessonquest-audit-attempt2-focused.log` and rebuild command output |
| `corepack pnpm exec vitest run --config /tmp/lessonquest-audit-attempt2-probes/vitest.config.mjs` | 2 files / **18 probes PASS**: 13 previous probes freshly rerun plus 5 newly authored probes                | `/tmp/lessonquest-audit-attempt2-probes.log`                             |
| `corepack pnpm check`                                                                             | Lint, formatting, both type checks, 26 files / **306 tests**, all workspace/API builds and Vite build PASS | `/tmp/lessonquest-audit-attempt2-check.log`                              |
| `corepack pnpm audit --prod`                                                                      | No known vulnerabilities                                                                                   | `/tmp/lessonquest-audit-attempt2-security.log`                           |
| `git diff --check 9bcb2fb 7a461ec`                                                                | PASS                                                                                                       | Independent command output                                               |
| Protected-path diff to baseline                                                                   | PASS; protected paths unchanged                                                                            | Independent `git diff --exit-code` output                                |
| Candidate changed-file credential-pattern scan                                                    | 14 files; zero matches                                                                                     | Independent command output                                               |

I read the raw initial audit RED, corrected revocation/replay RED, and organization-remediation RED logs. Missing post-rollback rows are real initial failures. The corrected RED isolates CONFLICT versus DENIED and the missing end DUPLICATE after removing the invalid fixture; the organization RED contains five genuine 200/201-versus-404 failures. I also inspected the preserved test-only TypeScript failure and the final successful implementer logs: full check **306 tests**, integration **37**, scripted E2E **35**, production audit with no known vulnerabilities, and successful static demo build. Counts match the report. I did not separately rerun the integration/E2E scripts; their selected checked-in tests also run in the independent full suite. These numbers are not browser-test counts.

## Limits and release containment

The broader React-to-database negative/ambiguous-delivery matrix, genuine correct-first M5/M6 React scenario, and durable browser geometry/contrast/network probes remain separately planned. Some supplemental fault/authority probes are outside the repository and therefore do not yet provide durable CI regression coverage. This review makes no new live-site or browser-rendering claim.

PGlite tests establish local transaction behavior, not real PostgreSQL multi-connection concurrency or disaster durability. Audit evidence cannot be persisted while its database storage is unavailable; safe 500 remains the containment path. No migration or data rewrite is needed for recovery; a reviewed commit revert is available, but it must not knowingly restore the disabled-organization bypass. Already appended audit rows remain valid. Vercel remains a static synthetic demo: delivery of this repository does not deploy the local API as a production backend.

## Final implementation score

| Category                                    |      Score | Evidence and deduction                                                                                                                                                                                                                     |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |  **25/25** | Complete bounded decision matrix, real revocation, immutable end replay, and approved active-organization remediation are delivered. Exclusions and first failed gate remain explicit.                                                     |
| Correctness and code quality                |  **19/20** | Small typed helper, post-rollback semantics, preserved transaction ownership, correct scope attribution, error identity, and replay behavior. Deduct for inherited misleading generic finalization classification.                         |
| Security, privacy, and tenant isolation     |  **20/20** | Prior lifecycle blocker is closed; independently exercised foreign scope, current authority, owner/admin boundary, UUID-only audits, trace integrity, input/auth containment, and safe fault behavior. No unresolved critical issue found. |
| Test and verification evidence              |  **19/20** | Valid RED evidence, fresh 24 focused tests, 18 adversarial probes, 306 full-suite tests, lint/type/build/security checks. Deduct because some supplemental fault/authority regressions remain outside durable CI tests.                    |
| Operability, recoverability, and provenance |  **13/15** | Durable decision records, safe diagnostics, documented revert/containment, unchanged dependencies and original-code provenance. Deduct for remaining misleading finalization diagnostics and local/ephemeral operational evidence limits.  |
| **Total**                                   | **96/100** | **PASS: strictly above 85, with no critical blocker.**                                                                                                                                                                                     |

The reviewed candidate may proceed through the authorized CI-guarded integration and Git-linked deployment workflow. This verdict does not itself certify CI on a later commit, the merged result, or a completed deployment.
