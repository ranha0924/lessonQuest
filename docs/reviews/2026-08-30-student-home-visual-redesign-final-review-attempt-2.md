# Student Home Visual Redesign Independent Final Review — Attempt 2

- **Date:** 2026-08-30
- **Reviewer:** second newly assigned independent final validator; did not implement the change or perform Attempt 1
- **Branch:** `codex/student-home-redesign`
- **Base:** `db784b357de75e479daf8043ce40097a02d560a0`
- **Head:** `dc94be081d6a55503ffff1865bcd980d3dbe90e8`
- **Decision:** **PASS — 97/100, no critical blocker**
- **Ready-to-merge assessment:** **YES.** The complete remediated range satisfies the repository's `>=86` and no-critical-blocker gate. No merge or deployment was performed.

## Scope and range inspection

This review covers the complete linear `db784b357de75e479daf8043ce40097a02d560a0..dc94be081d6a55503ffff1865bcd980d3dbe90e8` range, all seven commits, the full diff, the actual files at `HEAD`, the approved design and plan, the 97/100 plan review, Attempt 1, and the final rubric and blockers in `memory/projects/lessonquest.md`. The range contains 12 changed files, 1,664 insertions, and 90 deletions.

History preserves the required gate and TDD order: approved design/plan/review (`3e0dd52`), RED acceptance tests (`c75cea1`), semantic implementation (`5dda138`), visual implementation (`7a6513f`), verification records (`6032e1f`), independent Attempt 1 (`05856e7`), and remediation (`dc94be0`). The remediation changes only the demo CSS/student link and documentation/evidence formatting; it does not expand runtime scope.

Runtime changes remain confined to `apps/web` demo component/style/test files. The range has no package manifest, lockfile, `vercel.json`, API, database, repository, schema, migration, authentication, authorization, Rasa provider, boss-rule, Firebase, generated artifact, or external-repository change. The normal app imports the stylesheet, but every ordinary presentation selector is structurally rooted at `.demo-shell`; the global `@keyframes` declaration is not a selector and has no other repository use.

## Fresh independent verification

| Command or inspection                                                                                                                                       | Result                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`; `git merge-base --is-ancestor BASE HEAD`; `git log`; full diff/name/status/stat inspection                                            | PASS: exact requested head, linear range, seven commits, 12 changed files                                                                                                                                                                                                                                     |
| `git diff --check db784b357de75e479daf8043ce40097a02d560a0..dc94be081d6a55503ffff1865bcd980d3dbe90e8`                                                       | PASS, exit 0 with no whitespace errors                                                                                                                                                                                                                                                                        |
| `corepack pnpm check`                                                                                                                                       | PASS: ESLint, Prettier, type checks, 26/26 test files and 284/284 tests, all workspace builds, normal Vite build                                                                                                                                                                                              |
| `corepack pnpm test:integration`                                                                                                                            | PASS: 5/5 files, 16/16 tests                                                                                                                                                                                                                                                                                  |
| `corepack pnpm test:e2e`                                                                                                                                    | PASS: 5/5 files, 14/14 tests                                                                                                                                                                                                                                                                                  |
| `corepack pnpm audit --prod`                                                                                                                                | PASS: no known vulnerabilities                                                                                                                                                                                                                                                                                |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build`                                                                                         | PASS: demo build emitted `dist/index.html` and local hashed assets                                                                                                                                                                                                                                            |
| `python3 /tmp/lessonquest_visual_check.py` through the loopback server helper                                                                               | PASS at 1440x900, 768x1024, and 375x812: no body/shell horizontal overflow, minimum initial target 44 px, visible 4 px `#ffc85a` CTA focus, reduced-motion animation `none`, no console/page errors, and desktop wrong/hint/correct flow at `40 / 100`                                                        |
| Independent Playwright interaction/network probe at all three widths                                                                                        | PASS: every rendered button and demo-navigation link measured at least 44 px in initial, wrong-answer, hint-visible, and teacher states; every initial fragment target exists; CTA is fully inside each viewport; teacher evidence/no-ranking copy passes; refresh returns to `32 / 100`; 0 external requests |
| Selector, containment, dependency, network, and credential scans                                                                                            | PASS: every ordinary selector in `demo-shell.css` starts below `.demo-shell`; no boundary-file diff; no HTTP asset, remote import, fetch/XHR/WebSocket/EventSource/Firebase addition, or credential-like assignment                                                                                           |
| Screenshot inspection: `/tmp/lessonquest-desktop.png`, `/tmp/lessonquest-tablet.png`, `/tmp/lessonquest-mobile.png`, `/tmp/lessonquest-desktop-resumed.png` | PASS: approved hierarchy, readable responsive stacking, aggregate-only boss state, fixed hint, and successful retry are visible without horizontal clipping                                                                                                                                                   |

The browser matrix measured the initial CTA at y=565–617 desktop, y=489–541 tablet, and y=578–630 mobile, fully within each viewport. Tablet support content now begins at y=751 instead of Attempt 1's y=1,013.

## Attempt 1 remediation verification

| Attempt 1 finding                                                                        | Result at final HEAD | Evidence                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role buttons were 34/38 px; all buttons and demo navigation links must be at least 44 px | **RESOLVED**         | `apps/web/src/demo-shell.css:49-58` sets the shared role buttons to 44 px; choice buttons remain 64 px at `apps/web/src/demo-shell.css:520-532`; navigation targets remain 48 px at `apps/web/src/demo-shell.css:137-149`. Fresh browser measurements returned a minimum of 44 px at every required width and interaction state. |
| New presentation selectors were not structurally scoped                                  | **RESOLVED**         | `apps/web/src/demo-shell.css:1-885` roots every ordinary selector at `.demo-shell`, including all responsive and reduced-motion selectors. Repository scan found no unscoped presentation selector or authenticated-class collision.                                                                                             |
| Initial `내 미션` link targeted absent `#mission-question`                               | **RESOLVED**         | `apps/web/src/demo-student-home.tsx:32` now targets the always-present `#student-mission` at line 52. The independent browser probe confirmed all five navigation/brand fragment links resolve on initial render.                                                                                                                |
| Tablet support row inherited the full viewport-height navigation gap                     | **RESOLVED**         | `apps/web/src/demo-shell.css:720-734` resets the navigation minimum height to `auto` and places support in column 2 without top padding. Fresh 768x1024 measurement puts support at y=751 and the screenshot shows it in the intended row immediately after mission/growth content.                                              |
| Recorded range diff check was not genuinely clean                                        | **RESOLVED**         | The exact full-range `git diff --check BASE..HEAD` command exits 0 with no output. The remediation converted the six Markdown hard breaks to clean list formatting.                                                                                                                                                              |

## Findings

### Critical or important

None.

### Minor scored gap

**M1 — Remediation browser assertions are not checked into the repository.** The committed component tests at `apps/web/test/demo-shell.test.tsx:11-37` cover the semantic home, complete Rasa/retry/boss path, privacy copy, and teacher switch, but not target dimensions, initial fragment existence, viewport geometry, reduced motion, or external requests. Those checks passed freshly in `/tmp/lessonquest_visual_check.py` and the independent probe, so this is not a present acceptance failure. It leaves the visual remediation evidence less durable than a checked-in browser regression and accounts for the test/operability deductions below.

## Requirement and behavior audit

- The student demo uses local reset-on-refresh React state and the approved Cosmic/Neo hierarchy; the authenticated app and teacher evidence subtree are behaviorally unchanged.
- Initial render contains the labeled primary navigation, main landmark, mission section, visible resume CTA, Rasa companion, growth section, and aggregate `32 / 100` boss card.
- Resume -> `6 kg` wrong -> hint request displays the fixed level-one sentence at `apps/web/src/demo-student-home.tsx:9` -> `2 kg` correct shows retry success and aggregate `40 / 100`.
- Student content contains no market, leaderboard, percentile, individual rank, named peer, or student-to-student comparison. Teacher switching still exposes the explicit no-public-ranking statement at `apps/web/src/demo-shell.tsx:52`.
- The local decorative SVG is `aria-hidden`, non-focusable, uses only an in-document paint reference, and causes no external request. Keyboard focus, reduced motion, literal numeric progress, and 44 px targets pass at all required widths.
- Normal and demo builds pass. No API, DB, auth, provider, dependency, deployment, persistent data, Firebase, real student data, external AI output, or external network path changed.
- Rollback is a commit revert. No migration, persistent row, copied source, remote asset, or external system mutation requires a separate recovery procedure or provenance record.

## Critical-blocker audit

| Critical blocker                                                                           | Result    | Evidence                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unresolved authorization, tenant-isolation, secrets, or student-data risk                  | **CLEAR** | No auth/data boundary changed; scans and browser traffic are clean; synthetic aggregate-only state is used                                                         |
| Destructive or irreversible migration without backup/rollback                              | **CLEAR** | No schema, migration, database, or persistent-state change                                                                                                         |
| Generated learning content publishable without independent validation and teacher approval | **CLEAR** | Fixed synthetic preview only; no authoring or publishing path changed                                                                                              |
| Untrusted generated code can access credentials or institution/student data                | **CLEAR** | No generated-code, provider, API, credential, or data-adapter path added                                                                                           |
| Existing source repository or deployment mutation                                          | **CLEAR** | Only this repository's bounded branch changed; no deployment configuration, push, deployment, or external repository mutation                                      |
| Acceptance criteria cannot be verified                                                     | **CLEAR** | Unit/component, integration, E2E, builds, audit, full-range diff, browser matrix, screenshots, and negative containment/network probes all provide direct evidence |
| Required external authority, credentials, or user choice is missing                        | **CLEAR** | The visual direction was user-approved and all validation is local/synthetic                                                                                       |

## Final rubric

| Category                                    |      Score | Rationale                                                                                                                                                                                        |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement and approved-plan conformance   |      25/25 | All scope, interaction, privacy, accessibility, responsive, teacher, normal-build, and demo-build criteria pass without scope expansion                                                          |
| Correctness and code quality                |      20/20 | State/component boundaries are clear; shared authoritative display components are reused; all five Attempt 1 defects are resolved in code and browser behavior                                   |
| Security, privacy, and tenant isolation     |      20/20 | No security/data boundary changed; synthetic aggregate-only content, fixed answer-safe hint, clean scans, and zero external requests are verified                                                |
| Test and verification evidence              |      18/20 | Full tests/builds/audit and two browser probes pass; deduct because the remediation-specific responsive/target/network assertions remain outside the checked-in suite                            |
| Operability, recoverability, and provenance |      14/15 | Revert rollback, scoped CSS, local inline asset, clean range diff, documentation, and no dependency/external mutation are strong; deduct because browser evidence remains ephemeral under `/tmp` |
| **Total**                                   | **97/100** | **PASS**                                                                                                                                                                                         |

## Final decision

**PASS — 97/100, no critical blocker.** The final `dc94be081d6a55503ffff1865bcd980d3dbe90e8` implementation is ready to merge under the LessonQuest gate. The sole minor finding is evidence durability, not a reproduced product, security, privacy, accessibility, or operability failure. No merge, push, deployment, or external-system mutation was performed.
