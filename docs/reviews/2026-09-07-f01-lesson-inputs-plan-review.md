# F01 Lesson Input Authoring Plan Review

- Review date: 2026-09-07
- Reviewer: Codex primary implementing agent (pre-implementation review)
- Candidate plan: `docs/superpowers/plans/2026-09-07-f01-lesson-inputs.md`
- Approved design: `docs/superpowers/specs/2026-09-07-f01-lesson-inputs-design.md`
- Controlling sources: `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md`, `memory/projects/lessonquest.md`, and the user-provided Version 1 planning document
- Baseline: local `main` at `79e9dde`; `corepack pnpm test` passed 39 files and 423 tests before F01 production changes
- Decision: **PASS — implementation authorized**

## Scope and requirement trace

The user selected the first delivery boundary: complete F01 in the existing synthetic in-tab development preview. The source planning document defines F01 as teacher entry of learning content, learning objectives, and target grade. The approved design adds a title only as a practical saved-record label and extends the usable completion criterion to save, list, reopen, and revise the same input. This remains a teacher-authored source resource and does not claim F02 AI generation.

| Requirement or invariant                                          | Plan evidence                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Teacher enters learning content, objectives, and grade            | Global constraints; Task 1 strict field schemas; Task 4 labeled controls           |
| Saved input can be listed, reopened, and revised                  | Tasks 2-5 repository, API, component, and real React-to-PGlite tests               |
| F01 remains distinct from generated/approved experience versions  | Goal, architecture, first global constraint, Task 5 regression assertions          |
| Organization data is tenant-scoped and authorization fails closed | Global constraints; Task 2 authorization/replay tests; Task 3 HTTP negative matrix |
| No Firebase or real student data in Phase 1                       | Global constraints; Task 7 credential, emitted-output, and data-boundary checks    |
| Existing source repositories and deployments remain read-only     | Global constraints and Task 8 guarded LessonQuest-only delivery                    |
| Independent acceptance is required before merge/deployment        | Global constraint and Task 8 final gate                                            |

## Rubric score

### 1. Requirements and scope coverage — 25/25

- The plan traces all three source-document fields and the user-approved saved/reopen/revise completion boundary to concrete contracts, UI controls, persistence behavior, and browser assertions.
- Exclusions are explicit: no AI call, BlockSpec generation, delete/history UI, production authentication, durable shared persistence, Firebase, or real data.
- The title field is justified as record identification, bounded, and tested rather than silently expanding into generated content.
- Reset-on-refresh and data-reset behavior is part of acceptance rather than an undocumented limitation.

### 2. Architecture and interface quality — 20/20

- A separate mutable `lesson_inputs` resource prevents raw teacher material from being mislabeled as or coupled to immutable generated experience versions.
- Public Zod contracts, repository signatures, SQL objects, four HTTP routes, client methods, and component props are specified precisely.
- Update concurrency uses server-owned revisions; mutation IDs and stable request hashes define exact retry and conflict behavior.
- Compatibility is additive. Existing generated JSON, validation, approval, assignment, Rasa, boss, and preview reset ownership remain unchanged and receive regression coverage.

### 3. Security, privacy, and tenant safety — 20/20

- Authorization is re-evaluated from active database state for every operation and replay. Teacher ownership, organization-admin scope, incompatible roles, disabled membership, cross-tenant access, and nonexistent resources have explicit fail-closed tests.
- Request identity/tenant ownership fields are rejected, route IDs are validated, and organization identity never comes from the request body.
- Audit and diagnostics are metadata-only; submitted titles, content, objectives, bodies, tokens, SQL, and raw exceptions are explicitly excluded and tested.
- Fresh synthetic PGlite and synthetic actors avoid Firebase, credentials, real student data, and external systems.
- Transaction rollback, conflict auditing, CORS, body limits, media types, and response caching are all covered.

### 4. Test and verification quality — 20/20

- Every production slice starts with named RED tests and an exact focused command, followed by GREEN and adjacent regression commands.
- Coverage spans contract boundaries, database constraints/transactions, tenant and actor isolation, HTTP/auth/CORS/body handling, client parsing, component text preservation, exact lost-response replay, React-to-Hono-to-PGlite behavior, and three Playwright viewports.
- The complete sequential matrix includes lint, formatting, type checking, builds, unit/integration/E2E, both Chromium suites, dependency audit, diff checks, credential scans, and normal-build containment.
- The corrected focused preview command invokes the actual build chain and Playwright directly, so grep reaches Playwright rather than being ambiguously forwarded through the package script.

### 5. Execution readiness and recoverability — 14/15

- Tasks have file-level ownership, interfaces, ordered commands, expected RED/GREEN outcomes, commit boundaries, provenance updates, and a frozen hash manifest for independent review.
- Schema changes are additive and affect only fresh synthetic databases; rollback is containment by discarding/resetting the in-tab database or reverting the isolated feature branch.
- The plan preserves exact retry IDs across uncertain outcomes and explicitly starts a new logical mutation after authoritative conflict reload.
- One point is withheld because operating-database rollback and durable migration rehearsal cannot be demonstrated in the deliberately selected in-tab PGlite scope. This is a documented exclusion, not a blocker.

## Score and gate decision

| Category                               |      Score |
| -------------------------------------- | ---------: |
| Requirements and scope coverage        |      25/25 |
| Architecture and interface quality     |      20/20 |
| Security, privacy, and tenant safety   |      20/20 |
| Test and verification quality          |      20/20 |
| Execution readiness and recoverability |      14/15 |
| **Total**                              | **99/100** |

Final score is **99/100**, strictly greater than 85.

## Critical-blocker audit

- Authorization or tenant-isolation uncertainty: none remaining in the plan.
- Secrets or real student data: excluded and independently scannable.
- Destructive/irreversible migration: none; only fresh synthetic preview schema objects are added.
- Unvalidated AI publication or unsafe generated code: not in scope; F01 does not invoke generation or publication.
- Reference repository/deployment mutation: prohibited.
- Unverifiable acceptance criteria: none; each criterion has contract, repository/API, React, or browser evidence.
- Missing authority/credentials/user choice: none for local implementation. Remote delivery remains conditional on the already-authorized exact-head gates and configured credentials.

**Critical blockers: 0.** The pre-implementation gate passes. Production work may begin with the planned RED tests. This review does not accept an implementation, authorize bypassing failed tests, or replace the mandatory independent final validation.
