# LessonQuest Project Memory

Updated: 2026-08-30

## Product and source of truth

LessonQuest is a playable learning platform with four product areas: Studio, Play, Rasa, and Institution Console. The canonical product constraints live in `docs/PROJECT_CANON.md`; architecture and sequencing live in `docs/INTEGRATION_PLAN_V2.md` and the applicable plan under `docs/superpowers/plans/`.

The existing GitHub repositories and their deployments are reference sources only. They must remain unchanged. Reuse is limited to selectively copying useful code, behavior, or tests into LessonQuest and recording provenance.

## Mandatory pre-implementation validation gate

Every production-code, database-migration, or deployment task must pass a written review before implementation starts or resumes.

### Review process

1. State the implementation scope and the controlling requirements.
2. Write or update a concrete implementation plan with interfaces, affected files, ordered tests, risks, and rollback or containment steps.
3. Score the plan using the rubric below and cite specific plan sections or evidence for every category.
4. Save the review as `docs/reviews/YYYY-MM-DD-<scope>-plan-review.md`.
5. Implement only if the final score is **86/100 or higher** and there are no critical blockers.
6. If the score is 85 or lower, revise the plan and perform a new review. Preserve both the original and revised scores in the review record.

### 100-point rubric

| Category                               |  Points | Passing evidence                                                                                                   |
| -------------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------ |
| Requirements and scope coverage        |      25 | Acceptance criteria trace to canonical requirements; exclusions and dependencies are explicit.                     |
| Architecture and interface quality     |      20 | Boundaries, data ownership, contracts, failure behavior, and migration/compatibility effects are defined.          |
| Security, privacy, and tenant safety   |      20 | Threats and abuse paths are addressed; authorization fails closed; no real student data or unsafe secret handling. |
| Test and verification quality          |      20 | RED/GREEN tests, integration checks, negative cases, regression scope, and completion commands are concrete.       |
| Execution readiness and recoverability |      15 | File-level steps, dependency versions, observability, rollback/containment, and source provenance are actionable.  |
| **Total**                              | **100** | **Implementation requires more than 85 points.**                                                                   |

### Critical blockers

The gate fails regardless of score if any of these remain:

- an unresolved authorization, tenant-isolation, secrets, or student-data risk;
- destructive or irreversible migration without backup and rollback;
- generated learning content can be published without independent validation and teacher approval;
- untrusted generated code can access credentials or institution/student data;
- a plan mutates an existing source repository or deployment;
- acceptance criteria cannot be verified;
- required external authority, credentials, or user choice is missing.

## Implementation discipline after the gate

- Use test-driven development: observe the intended failing test before production implementation.
- Keep client inputs strict and server authority explicit.
- Prefer synthetic data and local deterministic services.
- Run targeted tests while iterating, then the complete affected verification suite.
- Do not claim completion from the pre-implementation score alone; the implemented result must separately pass its tests, type checks, lint, build, security audit, and any plan-specific checks.

## Mandatory independent final-validation gate

After implementation and the implementing agent's checks, a separate agent that did not implement the reviewed change must validate the actual result.

### Independence and evidence

- The final reviewer must be a newly assigned independent agent and must not edit the implementation during the scoring pass.
- The reviewer inspects the controlling requirements, approved plan, complete diff, tests, dependency changes, and recorded verification output.
- The reviewer runs relevant checks independently rather than relying only on the implementer's report.
- Findings include file and line references where applicable and distinguish critical blockers from scored quality gaps.
- Save the report as `docs/reviews/YYYY-MM-DD-<scope>-final-review.md`.

### Final implementation rubric

| Category                                    |  Points | Passing evidence                                                                                                           |
| ------------------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25 | The delivered behavior satisfies traced acceptance criteria with no unauthorized scope expansion.                          |
| Correctness and code quality                |      20 | Interfaces and failure behavior are correct; code is maintainable; edge cases and regressions are addressed.               |
| Security, privacy, and tenant isolation     |      20 | Threat controls work in the actual code; authorization fails closed; secrets and student data remain protected.            |
| Test and verification evidence              |      20 | Relevant tests pass; negative and integration coverage is meaningful; typecheck, lint, build, and security checks succeed. |
| Operability, recoverability, and provenance |      15 | Logs/diagnostics, rollback or containment, documentation, dependencies, and copied-source provenance are adequate.         |
| **Total**                                   | **100** | **Acceptance requires more than 85 points.**                                                                               |

### Final decision

- **PASS:** 86/100 or higher and no critical blocker. The implementation may be accepted as complete.
- **FAIL:** 85/100 or lower, or any critical blocker. Fix the findings and obtain a new independent review.
- Do not merge, deploy, or claim completion while final validation is failing or missing.

## Current milestone marker

The Phase 1 identity/tenancy implementation was squash-merged to `origin/main` at `9bb18cbef95963eef5e20654d53cae4723d5efd0`. Its first independent final review scored 77/100 and reproduced a platform-role downgrade bypass; the preserved Attempt 1 verdict is followed by a separate Attempt 2 review in `docs/reviews/2026-08-29-phase-1-identity-tenancy-final-review.md`.

The remediation plan in `docs/superpowers/plans/2026-08-29-identity-tenancy-review-remediation.md` passed its pre-implementation gate at 98/100. Test-first remediation enforces current platform/organization role compatibility, audits conflicts, proves post-write rollback, correlates request trace IDs across safe responses/audits/allowlisted diagnostics, and covers every protected route against missing/malformed/unknown credentials. A new independent non-implementing agent reran the checks and probes and scored the actual remediated implementation **98/100 PASS with no critical blocker** before merge.

The first bounded Phase 2 unit lives on `codex/phase2-wordquest-boss-rules`. Its plan passed the pre-implementation gate at **99/100**. It selectively ports WordQuest boss switch, class-scoped keys, difficulty/HP rules, per-student maximum aggregation, and server-verified contribution projection into the pure `@lessonquest/gamification` package. The implementer check passed 145 tests, lint, formatting, typecheck, builds, audit, and diff validation. A fresh independent non-implementing agent repeated the checks and scored the actual result **95/100 PASS with no critical blocker** in `docs/reviews/2026-08-29-phase-2-wordquest-boss-rules-final-review.md`. Before runtime integration, reject non-string/non-number HP tuning coercions and canonicalize or reject uppercase UUID campaign keys. The package is not wired to an API, database, Firebase, deployment, or real data; Phase 1 M3-M6 and the remaining Phase 2 class/invite/dashboard/PWA/data work remain incomplete. Nothing on this branch has been pushed, merged, or deployed.

The Phase 1 M3–M4 implementation candidate is being built on `codex/phase1-m3-m4-complete` from `origin/main` commit `415d8487fb15627351e260c816fc70041801fb0e`. Its original design and file-level TDD plan passed the pre-implementation gate at **100/100 with no critical blocker**, and its first implementer check passed 176 tests. Independent final-review Attempt 1 then scored the actual implementation **62/100 FAIL** after reproducing three blockers: validation was not bound to the approved artifact/status graph, an in-progress attempt restarted event sequence zero, and client-scripted correctness made teacher results untrustworthy. It also found deadline/state symmetry, audit, shared response-contract, grade-band, and true E2E gaps. The failed verdict is preserved in `docs/reviews/2026-08-29-phase-1-m3-m4-final-review.md`.

The test-first final-gate remediation plan passed a separate pre-implementation review at **100/100 with no blocker**. The candidate now links validation and approval to the canonical artifact hash, enforces forward-only database transitions and validated-content immutability, accepts option IDs instead of client correctness, derives answer outcomes and completion on the server, resumes from server-owned sequence/answer state, applies assignment and institution lifecycle checks at player/event time, records trace-correlated M3/M4 audits, parses shared response contracts, bounds Korean grade bands, and includes a React → HTTP client → Hono → PGlite reload/resume test.

The remediation implementer verification passed on 2026-08-29: `corepack pnpm check` passed 19/19 files and 196/196 tests plus lint, format, typecheck, all workspace builds, and the Vite production build; `test:integration` passed 2/2 files and 13/13 tests; `test:e2e` passed 3/3 files and 8/8 tests across the real React → HTTP → Hono → PGlite boundary; the production dependency audit reported no known vulnerabilities; the changed-file credential-pattern scan and `git diff --check` were clean.

A different fresh independent reviewer then inspected the complete base-to-`486abb8` diff, reran the full verification and adversarial probes, and recorded **91/100 PASS with no critical blocker** as Attempt 2 in `docs/reviews/2026-08-29-phase-1-m3-m4-final-review.md`. The original 62/100 FAIL remains preserved above it. Non-blocking follow-ups before production-adapter work are database-enforced audit-log immutability and distinct duplicate outcomes, exact browser retry after transient delivery failure, real PostgreSQL multi-connection concurrency normalization, a narrower Node/jsdom engine range, and correct-first coverage in the integrated E2E. M3/M4 is complete on the local feature branch but has not been pushed, merged, or deployed. M5, M6, and production adapters remain excluded.

Phase 1 M5–M6 now has a user-approved design at `docs/superpowers/specs/2026-08-30-phase-1-m5-m6-design.md` and an implementation plan at `docs/superpowers/plans/2026-08-30-phase-1-m5-m6.md` on `codex/phase1-m5-m6-complete`, based on local `main` commit `e5e1e04a0dcc02ff094e811e625c11a3b211bccf`. The slice uses a deterministic no-network/no-secret local Rasa provider and at most one active class boss campaign with server-derived contributions and aggregate-only student visibility. The plan also closes the M3/M4 attempt-lock, authoritative acknowledgement/exact-retry, audit immutability/duplicate-outcome, and correct-first E2E follow-ups required by these boundaries.

The M5–M6 pre-implementation review at `docs/reviews/2026-08-30-phase-1-m5-m6-plan-review.md` scored **98/100 PASS with no critical blocker**. The local implementation candidate now contains strict contracts, ACK-based exact event retry, deterministic answer-safe Rasa hints and usage, one active class campaign, authoritative outbox projection, aggregate-only student UI, teacher evidence, and a real HTTP/Hono/PGlite M5/M6 boundary test. Nothing was pushed, merged, deployed, connected to Firebase/external AI, or run against real student data. Final acceptance still requires the fresh full implementer bundle and independent review at 86/100 or above with no blocker.

The fresh implementer verification on 2026-08-30 passed: `corepack pnpm check` completed lint, formatting, typecheck, 24/24 test files with 245/245 tests, every workspace TypeScript build, and the Vite production build; `test:integration` passed 5/5 files and 16/16 tests; `test:e2e` passed 4/4 files and 10/10 tests; the production dependency audit reported no known vulnerabilities; and `git diff --check` was clean. Independent final validation remains mandatory before claiming Phase 1 complete.

Independent M5/M6 final review Attempt 1 then scored **52/100 FAIL** and reproduced critical authorization and answer-safety defects plus advisory timeout, mutable lifecycle evidence, duplicate projection claiming, missing audits, incomplete teacher lifecycle UI, and a missing real React-to-database M5/M6 E2E. The failed verdict is preserved in `docs/reviews/2026-08-30-phase-1-m5-m6-final-review.md`.

The final-gate remediation plan at `docs/superpowers/plans/2026-08-30-phase-1-m5-m6-final-gate-remediation.md` passed a new pre-implementation review at **100/100 with no blocker**. Test-first remediation now authorizes before hint replay, revalidates current authority before finalization, enforces provider timeouts, rejects direct Korean/English choice instructions, installs database state-transition guards, conditionally claims projection jobs, emits the missing audits, completes the teacher campaign lifecycle UI, and adds the planned React → HTTP → Hono → repositories/provider/projector → PGlite fixture. A different independent reviewer must still score the remediated result above 85 with no blocker before completion.

Independent final review Attempt 2 scored **68/100 FAIL**. It confirmed the original three answer phrases were blocked and all standard checks passed, but found additional letter-choice imperative variants, direct campaign deletion and assignment Rasa policy mutation, retryable hint ID loss, incomplete negative E2E evidence, and projection audits with unrelated trace IDs. The verdict is preserved in `docs/reviews/2026-08-30-phase-1-m5-m6-final-review-attempt-2.md`.

Remediation Plan 2 passed at **100/100 with no blocker**. The candidate now blocks Korean and English letter-choice imperatives, protects campaigns from deletion and assignment Rasa policies from mutation, preserves exact hint IDs across retryable responses, replays terminal retryable Rasa failures consistently, and carries ingestion trace IDs through projection jobs into projection audits. A third fresh independent final review remains mandatory.

Independent final review Attempt 3 scored **72/100 FAIL**. It verified the earlier authorization, timeout, retry, campaign/policy mutation, concurrency, success-trace, and teacher lifecycle fixes, but found declarative answer variants, deletable Rasa request/job evidence, reversed failure-audit ID/trace arguments, and remaining E2E/audit gaps. Remediation Plan 3 passed at **100/100 with no blocker**. The candidate now blocks those declarative Korean/English answer forms, rejects request/job deletion, corrects failed projection trace lineage, and expands the real React boundary with reload, terminal-503 exact retry, and campaign end/replacement. A fourth fresh independent final review remains mandatory.

Independent final review Attempt 4 scored **81/100 FAIL** after all prior literal phrases passed, because punctuation inserted inside the same direct-answer statements evaded adjacency-based patterns. Remediation Plan 4 passed at **100/100 with no blocker**. The output boundary now preserves raw-normalized URL/HTML checks while also applying semantic checks to a Unicode NFKC form stripped of whitespace, punctuation, and symbols. All eight reproduced punctuation variants are regression fixtures. A fifth fresh independent final review remains mandatory.

Independent final review Attempt 5 scored **82/100 FAIL** because Unicode format/combining-mark characters and a letter-shaped symbol could still split or erase answer markers. Remediation Plan 5 passed at **100/100 with no blocker**. Semantic normalization now retains only Unicode letters and numbers, and marker-level rules reject direct choice/correct instructions even when a choice glyph disappears. All six reproduced Unicode variants are fixed regression cases. A sixth fresh independent final review remains mandatory.
