# Unified Dark Demo Theme Independent Final Review

- **Date:** 2026-08-30
- **Reviewer:** newly assigned independent final validator; did not implement the theme, write its plan, or perform the prior student-home reviews
- **Branch:** `codex/student-home-redesign`
- **Final HEAD:** `5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4`
- **Complete feature range:** `db784b357de75e479daf8043ce40097a02d560a0..5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4`
- **Dark-theme slice:** `9d936985492b7f95297adba97ed6899aacbb11ce..5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4`
- **Decision:** **PASS — 94/100, no critical blocker**
- **Ready-to-merge assessment:** **YES under the repository's `>=86` and no-critical-blocker gate.** No merge, push, deployment, or external-system mutation was performed. The important small-label contrast finding below should be fixed before describing the demo as fully WCAG 2.1 AA conformant.

## Scope, range, and history inspection

This review inspected `AGENTS.md`, `docs/PROJECT_CANON.md`, the unified-dark design, implementation plan, and 98/100 plan review, the prior student-home design and plan, the student-home final review Attempt 2, and the final rubric and blockers in `memory/projects/lessonquest.md`. It also inspected the complete diffs, commit history, and actual files at final HEAD for both requested ranges.

The complete range is linear and contains 12 commits, 16 changed files, 2,049 insertions, and 91 deletions. Its order preserves the mandatory gate and TDD sequence: student design/plan/review, student RED tests, semantic implementation, visual implementation, verification, independent review, remediation, second independent review, then the unified-dark plan/review (`2fa851e`), contract-only RED test (`e6b4f30`), implementation (`476a441`), and verification documentation (`5dbeb7c`). The dark slice contains those final four commits, eight changed files, 329 insertions, and 39 deletions.

The dark runtime change is limited to `apps/web/src/demo-shell.css`, the `data-theme="dark"` marker in `apps/web/src/demo-shell.tsx:9`, and the focused contract test at `apps/web/test/demo-shell.test.tsx:11-19`. The wider student-home range adds the local `DemoStudentHome`, demo stylesheet/import, focused tests, and documentation. Neither range changes a package manifest, lockfile, `vercel.json`, API, service, database, schema, migration, authentication, authorization, provider, boss rule, Firebase path, remote asset, or generated artifact.

## Fresh independent verification

| Command or inspection                                                                                                                                          | Fresh result                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git rev-parse HEAD`; ancestry checks; reverse log; full diff/name/status/stat inspection for both exact ranges                                                | PASS: exact requested HEAD; both bases are ancestors; 12-commit complete range and four-commit dark slice inspected                                                                                                                                                                  |
| `corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx`                                                                                              | PASS: 1 file, 4/4 tests                                                                                                                                                                                                                                                              |
| `corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx apps/web/test/m5-m6-e2e.test.tsx apps/web/test/demo-shell.test.tsx` | PASS: 4 files, 15/15 tests                                                                                                                                                                                                                                                           |
| `corepack pnpm check`                                                                                                                                          | PASS: ESLint, Prettier, type checks, 26/26 test files and 285/285 tests, all workspace builds, normal Vite build                                                                                                                                                                     |
| `corepack pnpm test:integration`                                                                                                                               | PASS: 5/5 files, 16/16 tests                                                                                                                                                                                                                                                         |
| `corepack pnpm test:e2e`                                                                                                                                       | PASS: 5/5 files, 14/14 tests                                                                                                                                                                                                                                                         |
| `corepack pnpm audit --prod`                                                                                                                                   | PASS: no known vulnerabilities                                                                                                                                                                                                                                                       |
| `corepack pnpm --filter @lessonquest/web build`                                                                                                                | PASS: normal build emitted local `dist/index.html` and hashed assets                                                                                                                                                                                                                 |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build`                                                                                            | PASS: synthetic demo build emitted local `dist/index.html` and hashed assets                                                                                                                                                                                                         |
| `git diff --check db784b357de75e479daf8043ce40097a02d560a0..5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4`                                                          | PASS, exit 0 with no output                                                                                                                                                                                                                                                          |
| `git diff --check 9d936985492b7f95297adba97ed6899aacbb11ce..5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4`                                                          | PASS, exit 0 with no output                                                                                                                                                                                                                                                          |
| Demo build plus loopback `vite preview --host 127.0.0.1 --port 4173 --strictPort`; `python3 /tmp/lessonquest_visual_check.py`                                  | PASS at 1440x900, 768x1024, and 375x812: 23 dark-surface observations per viewport, 44 px minimum target, no overflow/errors/external requests, 4 px `rgb(255, 200, 90)` CTA focus, reduced-motion animation `none`, and completed `40 / 100` flow                                   |
| Independent inline Playwright state/target/network/contrast probe at all three widths                                                                          | PASS with one contrast finding: initial, wrong, hint, completed, and teacher states have no overflow; every rendered button/nav link is at least 44 px in every state; zero console/page errors and zero external requests; computed background and contrast evidence recorded below |
| Full-range changed-path, dependency/deployment, network/remote-asset, credential-assignment, CSS-scope, binary/type-change, and worktree scans                 | PASS: no boundary file, dependency, deployment setting, remote request/asset, credential-like assignment, unscoped class selector, binary, submodule, or unexpected tracked mutation                                                                                                 |

The local preview server was stopped after inspection. The tracked checkout was clean before this authorized review file was created.

## Browser and screenshot evidence

The required script was rerun against the local loopback demo, and all nine generated full-page screenshots were independently inspected:

- `/tmp/lessonquest-desktop.png`, `/tmp/lessonquest-desktop-resumed.png`, `/tmp/lessonquest-desktop-teacher.png`
- `/tmp/lessonquest-tablet.png`, `/tmp/lessonquest-tablet-resumed.png`, `/tmp/lessonquest-tablet-teacher.png`
- `/tmp/lessonquest-mobile.png`, `/tmp/lessonquest-mobile-resumed.png`, `/tmp/lessonquest-mobile-teacher.png`

The screenshots show a cohesive navy-black game surface system with white used for text/SVG highlights and yellow confined to the primary CTA and small accents. No large white, cream, pale-blue, or pale-yellow panel appears in initial, wrong/hint, completed, or teacher states. Responsive stacking remains readable and unclipped.

Fresh computed backgrounds were identical across the three viewport widths:

| State/region                            | Computed background evidence                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Initial page/toolbar/navigation/mission | shell `rgb(5, 8, 23)`; toolbar `rgba(5, 8, 23, 0.96)`; navigation and mission `rgb(11, 18, 48)`                                        |
| Initial supporting cards                | growth, boss, and next session `rgb(17, 27, 62)`; Rasa companion `rgb(11, 18, 48)`                                                     |
| Wrong and hint                          | question `rgb(17, 27, 62)`; choices `rgb(23, 36, 77)` (hover `rgb(29, 44, 91)`); retry `rgb(45, 37, 28)`; Rasa panel `rgb(13, 42, 56)` |
| Completed                               | question/choices/Rasa remain dark; success stamp `rgb(18, 55, 47)`                                                                     |
| Teacher                                 | shell `rgb(5, 8, 23)`; panels `rgb(17, 27, 62)`, `rgb(23, 36, 77)`, and `rgb(17, 27, 62)`                                              |

Every surface passed the plan's dark-luminance threshold. Body and shell widths were exactly 1440/1440, 768/768, and 375/375 in every independently probed state. The minimum target height was exactly 44 px: eight rendered targets initially, ten in wrong/hint/completed states, and two in the teacher state.

The exact student sequence remains: resume -> `질량 6 kg 선택` -> wrong guidance -> `힌트 받기` -> fixed level-one text `문제에서 무엇이 계속 유지되는지 먼저 찾아보자.` -> `질량 2 kg 선택` -> `재도전 성공 · 탐험 완료` -> aggregate boss `40 / 100`. The initial aggregate value remains `32 / 100`; refresh resets local state. Teacher switching preserves the existing policy/process/boss copy, including `개인 순위는 공개하지 않습니다.`

## Findings

### Critical

None.

### Important

#### I1. Small orbit-blue labels do not meet WCAG 2.1 AA text contrast on the new dark surfaces

`apps/web/src/demo-shell.css:219-223` and `apps/web/src/demo-shell.css:292-299` use orbit blue `#315bea` for small text. Fresh computed measurements at all three widths found:

- `LESSONQUEST PLAY · DEMO`: `rgb(49, 91, 234)` on `rgb(5, 8, 23)`, **3.62:1**, 10.56 px, weight 900.
- `탐험 체크포인트 3`, `이번 주 성장`, and `다음 탐험`: `rgb(49, 91, 234)` on `rgb(17, 27, 62)`, **3.05:1**, 10.88 px, weight 900.

These labels are far below the 18 pt/14 pt-bold large-text threshold, so they require 4.5:1 and fail WCAG 2.1 AA. The screenshots make the low-emphasis blue visible, especially on tablet/mobile. Primary/body copy, muted text, CTA text, focus, retry, hint, success, teacher labels, and controls otherwise have strong contrast; the failure is localized and does not block navigation, answer safety, or comprehension of the primary task. This is therefore an important scored accessibility/conformance gap, not a critical gate blocker. A lighter blue/cyan text token should be used while retaining orbit blue for non-text action decoration.

### Minor

#### M1. Computed-surface, geometry, target-size, network, and contrast assertions remain outside the checked-in suite

The checked-in dark-theme regression at `apps/web/test/demo-shell.test.tsx:11-19` proves the shared semantic theme boundary, while behavior tests cover the flow and teacher copy. The state/viewport surface matrix and accessibility geometry live in `/tmp/lessonquest_visual_check.py` and the independent inline probe. Both passed, but the contrast defect was not caught before final review and the browser evidence is ephemeral. This is an evidence-durability gap rather than a reproduced functional or containment failure.

## Requirement and containment audit

- `DemoShell` exposes one `data-theme="dark"` contract around both roles at `apps/web/src/demo-shell.tsx:9-63`.
- All ordinary class selectors in `apps/web/src/demo-shell.css:1-939` are structurally rooted below `.demo-shell`; the only global identifier is the local keyframe name. The authenticated application imports the file but has no matching theme subtree.
- The student flow, fixed answer-safe hint at `apps/web/src/demo-student-home.tsx:6-10`, aggregate-only boss values at `apps/web/src/demo-student-home.tsx:180-189`, and teacher switch/copy at `apps/web/src/demo-shell.tsx:30-61` are preserved.
- Student DOM and screenshots contain no market, leaderboard, percentile, individual rank, named peer, or public student comparison. Teacher evidence explicitly states that individual rankings are not public.
- Every button and demo-navigation link is at least 44 px in every state and viewport. Focus uses a visible 4 px sun-yellow outline; reduced motion removes the trajectory animation.
- Initial, wrong, hint, completed, and teacher states have no horizontal overflow, console error, page error, or external request at 1440x900, 768x1024, and 375x812.
- The inline decorative SVG is local, `aria-hidden`, non-focusable, and references only its in-document gradient. There is no remote font, image, URL, import, or network-capable addition.
- No API, DB, auth, authorization, tenant, provider, dependency, deployment, Firebase, persistent-state, credential, external AI, or real-student-data change exists. No existing source repository or external system was touched.
- Rollback is a commit revert. There is no migration, persistent row, external asset, copied source, dependency addition, or irreversible operation requiring a separate recovery path or provenance record.

## Critical-blocker audit

| Critical blocker                                                                           | Result    | Evidence                                                                                                                                        |
| ------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unresolved authorization, tenant-isolation, secrets, or student-data risk                  | **CLEAR** | No auth/data boundary changed; credential/network scans are clean; all state and content are synthetic/local                                    |
| Destructive or irreversible migration without backup/rollback                              | **CLEAR** | No schema, migration, database, deployment, or persistent-state change                                                                          |
| Generated learning content publishable without independent validation and teacher approval | **CLEAR** | Fixed synthetic preview only; authoring, validation, approval, and publishing paths are unchanged                                               |
| Untrusted generated code can access credentials or institution/student data                | **CLEAR** | No generated-code, provider, API, credential, data adapter, or remote asset path was added                                                      |
| Existing source repository or deployment mutation                                          | **CLEAR** | Only this local bounded branch changed; no push, deployment, `vercel.json`, or external-repository mutation                                     |
| Acceptance criteria cannot be verified                                                     | **CLEAR** | Tests, builds, audit, exact range diffs, three-width/five-state browser probes, screenshots, computed styles, and scans provide direct evidence |
| Required external authority, credentials, or user choice is missing                        | **CLEAR** | The unified dark direction was user-approved; local synthetic validation requires no external access                                            |

## Final rubric

| Category                                    |      Score | Rationale                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      23/25 | The unified dark roles, exact flow, privacy, teacher copy, 44 px targets, focus, motion, responsive behavior, builds, and exclusions pass; deduct for the explicit small-text AA contrast miss                                                                |
| Correctness and code quality                |      19/20 | State/component ownership, shared theme marker, scoped CSS, progress styling, and responsive behavior are maintainable and correct; deduct for applying an action-blue token directly to undersized text without a contrast-safe variant                      |
| Security, privacy, and tenant isolation     |      20/20 | Synthetic aggregate-only content, fixed answer-safe hint, clean containment/credential/network scans, and zero external requests are verified; no security/data boundary changed                                                                              |
| Test and verification evidence              |      18/20 | 285 unit/component tests, 16 integration tests, 14 E2E tests, checks/builds/audit, two range checks, and two browser probes pass; deduct because the visual/contrast assertions are not durable checked-in regressions and the existing test did not catch I1 |
| Operability, recoverability, and provenance |      14/15 | Revert rollback, scoped/local assets, clean ranges, reproducible preview, documentation, and no dependency/external mutation are strong; deduct because the decisive browser evidence remains under `/tmp`/inline execution                                   |
| **Total**                                   | **94/100** | **PASS**                                                                                                                                                                                                                                                      |

## Final decision

**PASS — 94/100, no critical blocker.** Final HEAD `5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4` is ready to merge under the LessonQuest gate. The sole important finding is a localized small-label WCAG AA contrast failure; it does not invalidate the dark-surface, behavior, privacy, target-size, focus, reduced-motion, responsive, build, or containment acceptance evidence, but it should be remediated before an accessibility-complete claim.
