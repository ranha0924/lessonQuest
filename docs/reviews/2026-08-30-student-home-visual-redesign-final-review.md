# Student Home Visual Redesign Independent Final Review

**Date:** 2026-08-30
**Reviewer:** newly assigned independent final validator; did not implement the change
**Branch:** `codex/student-home-redesign`
**Base:** `db784b357de75e479daf8043ce40097a02d560a0`
**Head:** `6032e1fbf37fd320ac23fadaddcd0d437d90b848`
**Decision:** **PASS — 90/100, no critical blocker**
**Ready-to-merge assessment:** **YES under the repository's >=86/no-critical-blocker gate.** The 44 px role-switch target mismatch is an important non-blocking follow-up and should be corrected before treating the preview as accessibility-complete.

## Scope and git-range inspection

This review covers the complete `db784b357de75e479daf8043ce40097a02d560a0..6032e1fbf37fd320ac23fadaddcd0d437d90b848` range, including all five commits, the full diff, actual files at `HEAD`, tests, build output, and browser evidence. The range contains 11 changed files, 1,550 insertions, and 90 deletions.

The history follows the required gate and TDD order: the design/plan and 97/100 plan review landed first (`3e0dd52`), acceptance tests landed separately (`c75cea1`), semantic implementation followed (`5dda138`), visual implementation followed (`7a6513f`), and verification documentation followed (`6032e1f`). The final documentation commit only formats the already approved design/review and adds verification records; it does not retrospectively expand implementation scope.

Runtime changes are limited to `apps/web` demo component/style/test files. Documentation changes are limited to the approved spec, plan, plan review, README, and project memory. The range contains no `package.json`, lockfile, `vercel.json`, package, service, schema, migration, API, authentication, authorization, repository, Rasa provider, boss-rule, Firebase, or generated artifact change.

The implemented flow uses local React state and the existing `RasaHintPanel` and `ClassBossCard`. The learner-visible hint is the fixed answer-safe sentence at `apps/web/src/demo-student-home.tsx:6`, and boss visibility remains aggregate-only at `apps/web/src/demo-student-home.tsx:180`. The unchanged teacher subtree remains in `apps/web/src/demo-shell.tsx:33`.

## Independent verification

| Command or inspection                                                                                                                                          | Fresh result                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx`                                                                                              | PASS: 1 file, 3 tests                                                                                                                                                                                               |
| `corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx apps/web/test/m5-m6-e2e.test.tsx apps/web/test/demo-shell.test.tsx` | PASS: 4 files, 14 tests                                                                                                                                                                                             |
| `corepack pnpm check`                                                                                                                                          | PASS: ESLint, Prettier, type checks, 26/26 test files and 284/284 tests, all workspace builds, normal Vite build                                                                                                    |
| `corepack pnpm test:integration`                                                                                                                               | PASS: 5/5 files, 16/16 tests                                                                                                                                                                                        |
| `corepack pnpm test:e2e`                                                                                                                                       | PASS: 5/5 files, 14/14 tests                                                                                                                                                                                        |
| `corepack pnpm audit --prod`                                                                                                                                   | PASS: no known vulnerabilities                                                                                                                                                                                      |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build`                                                                                            | PASS: Vite demo build emitted `dist/index.html` and local assets                                                                                                                                                    |
| `python3 /tmp/lessonquest_visual_check.py` against loopback Vite preview                                                                                       | PASS at 1440x900, 768x1024, and 375x812: no body/shell horizontal overflow, CTA focus ring 4 px `#ffc85a`, reduced-motion animation `none`, no console/page errors; full wrong/hint/correct flow reached `40 / 100` |
| Independent Playwright target/network/teacher probe                                                                                                            | Flow and teacher evidence PASS at all three widths; no external request and no console error. It also reproduced the role-switch target mismatch: 34 px desktop/tablet and 38 px mobile.                            |
| Changed-path/dependency/deployment/backend scan                                                                                                                | PASS: no dependency, lockfile, deployment, backend, database, auth, provider, or migration file changed                                                                                                             |
| Added runtime network/credential scan                                                                                                                          | PASS: no HTTP asset, `@import`, fetch/XHR/WebSocket/EventSource/Firebase addition and no credential-like assignment                                                                                                 |
| Current authenticated-selector collision scan                                                                                                                  | PASS: no non-demo source currently uses the new demo/trajectory class names                                                                                                                                         |
| `git diff --check db784b357de75e479daf8043ce40097a02d560a0..6032e1fbf37fd320ac23fadaddcd0d437d90b848`                                                          | FAIL (exit 2): six Markdown hard-break trailing-space warnings; see Minor finding M4                                                                                                                                |

The existing screenshots were inspected at `/tmp/lessonquest-desktop.png`, `/tmp/lessonquest-tablet.png`, `/tmp/lessonquest-mobile.png`, and `/tmp/lessonquest-desktop-resumed.png`. They show the approved Cosmic/Neo hierarchy, visible initial CTA, aggregate `32 / 100`, fixed Rasa hint, successful retry, and aggregate `40 / 100` state without clipped horizontal content.

## Findings

### Critical

None.

### Important

#### I1. Demo role-switch buttons are below the approved 44 px minimum target

`apps/web/src/demo-shell.css:49` overrides the global 44 px button minimum with `min-height: 34px`; the mobile rule at `apps/web/src/demo-shell.css:758` raises it only to 38 px. Fresh browser measurement reproduced exactly 34 px at 1440/768 widths and 38 px at 375 px for both “학생 화면” and “교사 화면”. This violates the design's “every button remains at least 44 px” requirement and the plan's global interactive-target constraint. The buttons remain keyboard reachable and have the required visible 4 px focus ring, so this is an accessibility/conformance gap rather than a critical blocker.

The focused test at `apps/web/test/demo-shell.test.tsx:11` and browser script at `/tmp/lessonquest_visual_check.py:51` verify presence, interaction, and the primary CTA focus ring but never assert all interactive target dimensions, which allowed this mismatch through the recorded visual pass.

### Minor

#### M1. Most demo presentation selectors are not structurally scoped below `.demo-shell`

The stylesheet is imported for both normal and demo builds at `apps/web/src/main.tsx:8`, but most rules start at global class selectors such as `.demo-student-layout` at `apps/web/src/demo-shell.css:76` and `.trajectory-halo` at `apps/web/src/demo-shell.css:387`, rather than `.demo-shell ...` as required by the approved component boundary. A repository scan found no current authenticated-app collision, and the class names are demo-specific, so there is no reproduced regression; the residual risk is future style leakage and weaker-than-planned containment.

#### M2. The initial “내 미션” navigation link points to an element that does not yet exist

`apps/web/src/demo-student-home.tsx:32` links to `#mission-question`, while that target is conditionally rendered only after the separate resume action at `apps/web/src/demo-student-home.tsx:117`. On initial render, activating the navigation link changes the fragment but cannot move to or focus mission content. This does not block the specified primary resume flow, but it weakens the semantic navigation added by the redesign.

#### M3. The tablet support row inherits avoidable vertical whitespace from the full-height navigation rail

At the 768x1024 browser check, the mission card began at y=169 px while the support column began at y=1,013 px. The two-column grid at `apps/web/src/demo-shell.css:720` places support in the next row, but the navigation's viewport-height minimum at `apps/web/src/demo-shell.css:93` controls the preceding row height. The result is a large blank interval before Rasa/boss cards. Ordering and overflow acceptance criteria still pass, so this is visual polish rather than a blocker.

#### M4. The committed base-to-head diff is not clean under the recorded diff-check command

The range-level command exits 2 on six Markdown hard-break spaces at `docs/reviews/2026-08-30-student-home-visual-redesign-plan-review.md:3` and `docs/superpowers/specs/2026-08-30-student-home-visual-redesign-design.md:3`. These are documentation-only and appear intentional, but the implementer memory states that the diff check was clean. Running plain `git diff --check` after committing inspects only the empty working-tree diff, not this committed range, so the evidence should not be described as a clean base-to-head diff.

## Requirement and behavior audit

- Semantic home: labeled primary navigation, main, mission section, learning-support aside, labeled Rasa region, and boss section are present.
- Initial state: visible “탐험 계속하기”, fixed Rasa companion copy, and only aggregate boss `32 / 100` are present.
- Mission flow: resume -> `6 kg` wrong -> fixed level-one hint -> `2 kg` correct produces retry success and `40 / 100`.
- Answer safety: the local hint asks the learner to identify what remains constant and does not disclose a choice or answer.
- Public comparison: no market, leaderboard, percentile, rank, named peer, or student-to-student comparison appears in the student DOM or screenshots.
- Teacher regression: switching still exposes “교사 운영 화면”, approval/policy/process/boss evidence, and the no-public-ranking statement.
- Responsive behavior: no horizontal page overflow at 1440, 768, or 375 px; the primary CTA remains visible; support content follows mission content at tablet/mobile widths.
- Motion and keyboard: trajectory entrance is removed under reduced motion; visible 4 px sun focus is present. I1 records the remaining target-size defect.
- Data and network boundary: synthetic local state only; refresh resets the preview; browser traffic remains loopback/local assets; no real identity, student image, credential, API/Firebase/external-AI output, or tenant data was added.
- Dependency/deployment boundary: no dependency, deployment configuration, backend, provider, database, schema, migration, or external repository mutation exists in the range.
- Recoverability/provenance: rollback is a commit revert; the SVG is local inline authored content; no copied code or remote asset requires additional provenance.

## Critical-blocker audit

| Critical blocker                                                                           | Result | Evidence                                                                                                           |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Unresolved authorization, tenant-isolation, secrets, or student-data risk                  | CLEAR  | No auth/data-boundary file changed; credential and network scans are clean; browser made no external request       |
| Destructive or irreversible migration without backup/rollback                              | CLEAR  | No migration, schema, database, or persistent-state change                                                         |
| Generated learning content publishable without independent validation and teacher approval | CLEAR  | Fixed synthetic preview only; no publishing path changed                                                           |
| Untrusted generated code can access credentials or institution/student data                | CLEAR  | No generated-code, provider, credential, API, or data adapter path added                                           |
| Existing source repository or deployment mutation                                          | CLEAR  | Only this repository's bounded branch changed; no `vercel.json`, external repository, push, or deployment mutation |
| Acceptance criteria cannot be verified                                                     | CLEAR  | Focused tests, full checks, builds, browser probes, screenshots, and containment scans provide direct evidence     |
| Missing external authority, credentials, or user choice                                    | CLEAR  | User-approved design and bounded local verification require no external credential or authority                    |

## Final rubric

| Category                                    |      Score | Rationale                                                                                                                                                                                                     |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      22/25 | Core home, flow, privacy, teacher, responsive, motion, and build requirements pass; deduct for the explicit 44 px miss and weaker-than-planned CSS scoping                                                    |
| Correctness and code quality                |      17/20 | State and shared-component boundaries are clear and the complete flow works; deduct for the initially dead mission link, tablet grid whitespace, and global selector surface                                  |
| Security, privacy, and tenant isolation     |      20/20 | No security/data boundary changed; synthetic aggregate-only UI, fixed answer-safe hint, clean scans, and no external requests are verified                                                                    |
| Test and verification evidence              |      17/20 | 284 unit/component tests, 16 integration tests, 14 E2E tests, builds, audit, and browser checks pass; deduct because target size was not asserted and the recorded range diff-clean claim is not reproducible |
| Operability, recoverability, and provenance |      14/15 | Revert rollback, local inline asset, reproducible preview, containment, documentation, and no dependency change are strong; deduct for the range-level whitespace/evidence mismatch                           |
| **Total**                                   | **90/100** | **PASS**                                                                                                                                                                                                      |

## Final decision

**PASS — 90/100, no critical blocker.** The implementation satisfies the repository's independent final-validation gate and is ready to merge under that rule. No deployment was performed or authorized. Correcting I1 before a public accessibility claim is strongly recommended; M1-M4 are non-blocking follow-ups.
