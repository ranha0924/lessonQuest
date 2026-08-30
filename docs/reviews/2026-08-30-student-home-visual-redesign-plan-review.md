# Student Home Visual Redesign Plan Review

- **Date:** 2026-08-30
- **Plan:** `docs/superpowers/plans/2026-08-30-student-home-visual-redesign.md`
- **Design:** `docs/superpowers/specs/2026-08-30-student-home-visual-redesign-design.md`
- **Controlling requirements:** `docs/PROJECT_CANON.md`, `memory/projects/lessonquest.md`
- **Decision:** **PASS — 97/100, no critical blocker**

## Scope and gate conclusion

The plan is limited to the reset-on-refresh synthetic Vercel demo's student surface. It preserves the existing Rasa retry, answer-safe hint, aggregate class-boss progress, and teacher-switch behavior while explicitly excluding the authenticated app, API, database, authorization, provider, schemas, deployment configuration, real student data, and external network assets. The user-approved visual direction is recorded as 70% Cosmic Quest concept 1 plus 30% Neo Academy concept 4.

Implementation is authorized because the score is strictly greater than 85 and no critical blocker remains.

## Rubric evidence

### 1. Requirements and scope coverage — 25/25

- The design's acceptance criteria trace the required initial home hierarchy, resume/retry/Rasa/boss interaction, preserved teacher switch, prohibited public comparison, responsive widths, accessibility, and both normal and demo builds.
- The plan maps those criteria to Tasks 1–4 with literal queries and expected outcomes, including boss progress from `32 / 100` to `40 / 100` and the fixed answer-safe hint.
- `Global Constraints` and Task 4 containment checks explicitly exclude API, database, provider, auth, schema, Vercel configuration, dependency, remote asset, and real-data changes.
- Dependencies are limited to the existing React, TypeScript, CSS, Vitest, Testing Library, and Vite workspace stack.

### 2. Architecture and interface quality — 20/20

- The component boundary is concrete: `DemoShell` owns only role selection and toolbar state; `DemoStudentHome` owns synthetic student interaction state; existing `RasaHintPanel` and `ClassBossCard` remain the display-contract boundary.
- File-level inputs and outputs are listed for every implementation task, including the only new export.
- Compatibility is explicit: the teacher subtree and authenticated application remain unchanged; the stylesheet is imported after global CSS and scoped below `.demo-shell`.
- State lifetime and failure behavior are appropriate for a static preview: local state resets on refresh, with no network or persistence path to fail.

### 3. Security, privacy, and tenant safety — 20/20

- The plan adds no credential, external request, Firebase access, real identity, student image, API response, or external AI output.
- Student visibility is aggregate-only and has a negative assertion against market/rank copy; no named comparison or individual score is introduced.
- Tenant authorization is not bypassed because no authenticated or tenant-scoped path changes. Task 4 explicitly confirms containment against auth/API/provider/schema changes.
- The fixed local Rasa object continues to use the established answer-safe display component and exact expected hint content.

### 4. Test and verification quality — 18/20

- Task 1 requires observable RED before production code, followed by focused GREEN and named web regressions in Task 2.
- The tests cover the initial semantic hierarchy, prohibited comparison, complete retry/hint/boss progression, and teacher switch.
- Task 3 specifies formatting, TypeScript, focused tests, normal build, and demo build; Task 4 adds the complete workspace, integration, E2E, audit, and diff checks.
- Responsive behavior, focus, content order, and reduced motion are checked at deterministic widths. Two points are withheld because those visual assertions are manual rather than image-diff or automated browser assertions; this is proportionate for the bounded demo but leaves a small repeatability gap.

### 5. Execution readiness and recoverability — 14/15

- The plan provides ordered file-level steps, exact commands, expected RED/GREEN results, commit checkpoints, and a final independent-review handoff.
- Rollback is a commit revert; there is no migration, persistent state, external system mutation, dependency addition, or generated artifact to unwind.
- Source provenance is clear: no copied source or external asset is planned, and the inline SVG is locally authored.
- One point is withheld because the screenshot destination is intentionally outside source control rather than a named durable evidence path. The written review and deterministic inspection matrix still make the gate actionable.

## Critical-blocker review

- Authorization, tenant isolation, secrets, or student-data risk: **none**; no authenticated/data boundary changes.
- Destructive or irreversible migration: **none**.
- Generated learning content published without validation/approval: **none**; content is fixed synthetic preview content.
- Untrusted code with credential or institution/student-data access: **none**.
- Existing source repository or deployment mutation: **none planned**.
- Unverifiable acceptance criteria: **none**; every criterion has a test, build, containment, or viewport inspection.
- Missing authority, credentials, or user choice: **none**; the user approved the design blend and authorized implementation.

## Final score

| Category                               |      Score |
| -------------------------------------- | ---------: |
| Requirements and scope coverage        |      25/25 |
| Architecture and interface quality     |      20/20 |
| Security, privacy, and tenant safety   |      20/20 |
| Test and verification quality          |      18/20 |
| Execution readiness and recoverability |      14/15 |
| **Total**                              | **97/100** |

**Gate result:** PASS. Production-code implementation may begin using the approved TDD sequence. Independent final validation remains mandatory before the work can be called complete.
