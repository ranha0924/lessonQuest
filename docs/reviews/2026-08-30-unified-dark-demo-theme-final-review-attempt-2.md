# Unified Dark Demo Theme Independent Final Review — Attempt 2

- **Date:** 2026-08-30
- **Reviewer:** fresh independent final validator; did not implement the theme or contrast remediation and did not perform Attempt 1
- **Branch:** `codex/student-home-redesign`
- **Final HEAD:** `d16ebef65f1cc6014266c334d943e216dc84b0d7`
- **Complete feature range:** `db784b357de75e479daf8043ce40097a02d560a0..d16ebef65f1cc6014266c334d943e216dc84b0d7`
- **Contrast-remediation range:** `5dbeb7c9eea1bacc2a07a3ae9893994ca2b146b4..d16ebef65f1cc6014266c334d943e216dc84b0d7`
- **Decision:** **PASS — 97/100, no critical blocker**
- **Ready-to-merge assessment:** **YES under the repository's `>=86` and no-critical-blocker gate.** No merge, push, deployment, or external-system mutation was performed.

## Scope, history, and actual-diff inspection

This review inspected `AGENTS.md`, `docs/PROJECT_CANON.md`, the final rubric and blockers in `memory/projects/lessonquest.md`, the approved unified-dark design, implementation plan, 98/100 plan review, Attempt 1, the complete base-to-HEAD diff, the remediation diff, and the actual files at final HEAD.

The complete linear range contains 15 commits and 17 changed files with 2,176 insertions and 91 deletions. It preserves the approved student-home and unified-dark gate/TDD sequence and adds the prior independent review followed by the contrast remediation and verification record. The exact remediation range contains three commits and three changed files with 129 insertions and two deletions: the 125-line Attempt 1 review, two CSS substitutions, and the project-memory verification record.

The only post-Attempt-1 production change is `apps/web/src/demo-shell.css:221,294`, where the two small-text selector groups move from orbit blue to ion cyan. The remediation does not change markup, state, APIs, services, schemas, migrations, authentication, authorization, providers, boss rules, Firebase paths, package manifests, lockfiles, `vercel.json`, generated artifacts, or external assets.

## Fresh independent verification

| Command or inspection                                                                                                                                          | Fresh result                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`; ancestry, reverse-log, name/status, stat, raw, mode, and binary inspection for both exact ranges                                         | PASS: exact requested HEAD; both bases are ancestors; complete range is 15 commits/17 files; remediation is three commits/three files; no binary, submodule, or unexpected mode change                                                                                    |
| `corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx`                                                                                              | PASS: 1 file, 4/4 tests                                                                                                                                                                                                                                                   |
| `corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx apps/web/test/m5-m6-e2e.test.tsx apps/web/test/demo-shell.test.tsx` | PASS: 4 files, 15/15 tests                                                                                                                                                                                                                                                |
| `corepack pnpm check`                                                                                                                                          | PASS: ESLint, Prettier, type checks, 26/26 test files and 285/285 tests, all workspace builds, and the normal Vite build                                                                                                                                                  |
| `corepack pnpm test:integration`                                                                                                                               | PASS: 5/5 files, 16/16 tests                                                                                                                                                                                                                                              |
| `corepack pnpm test:e2e`                                                                                                                                       | PASS: 5/5 files, 14/14 tests                                                                                                                                                                                                                                              |
| `corepack pnpm audit --prod`                                                                                                                                   | PASS: no known vulnerabilities                                                                                                                                                                                                                                            |
| `VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build`                                                                                            | PASS: synthetic demo build emitted local `dist/index.html` and hashed assets                                                                                                                                                                                              |
| `git diff --check db784b3`; `git diff --check 5dbeb7c`                                                                                                         | PASS: both exact commands exited 0 with no output                                                                                                                                                                                                                         |
| Demo build plus loopback preview and fresh `python3 /tmp/lessonquest_visual_check.py`                                                                          | PASS at 1440x900, 768x1024, and 375x812: 23 dark-surface observations per viewport, 44 px minimum target, no overflow/errors/external requests, 4 px sun-yellow focus, reduced-motion animation `none`, completed `40 / 100`, and minimum small-label contrast 8.235958:1 |
| Independent five-state Playwright matrix at all three widths                                                                                                   | PASS: initial, wrong, hint, completed, and teacher states all have exact body/shell widths, dark surfaces, 44 px minimum targets, visible keyboard focus, no console/page errors, and zero external requests; exact contrast evidence is below                            |
| Full-range path, dependency/deployment, network/remote-asset, credential-assignment, CSS-scope, and worktree scans                                             | PASS: no boundary-file change, remote request/asset, credential-like assignment, unscoped ordinary CSS selector, generated output, or unexpected tracked mutation                                                                                                         |

The local preview server was stopped after inspection. The checkout was clean before this authorized review file was created.

## Contrast remediation and browser evidence

The two failed small-text cases from Attempt 1 now use `rgb(32, 199, 223)` through `--lq-ion` and exceed the required WCAG 2.1 AA 4.5:1 ratio at every target width:

| Remediated text group                                                                                  | Foreground / effective background       | Font                 | Fresh contrast at 1440, 768, and 375 px | Result |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------------------- | --------------------------------------: | ------ |
| `LESSONQUEST PLAY · DEMO` at `apps/web/src/demo-shell.css:219-223`                                     | `rgb(32, 199, 223)` / `rgb(5, 8, 23)`   | 10.56 px, weight 900 |                  **9.77290473986114:1** | PASS   |
| `탐험 체크포인트 3` and the standard dark-card section labels at `apps/web/src/demo-shell.css:292-299` | `rgb(32, 199, 223)` / `rgb(17, 27, 62)` | 10.88 px, weight 900 |                 **8.235958813134527:1** | PASS   |

The independent matrix measured the maximum encoded surface luminance below the plan's 0.22 threshold in every state: initial 0.10745, wrong 0.17335, hint 0.14922, completed 0.18257, and teacher 0.14195. Every rendered button and demo-navigation link was at least 44 px high: eight targets initially, ten in wrong/hint/completed states, and two in teacher view. Keyboard Tab traversal produced the shared 4 px `rgb(255, 200, 90)` focus outline in every state. Reduced-motion emulation returned trajectory animation `none`.

Body and shell widths were exactly 1440/1440, 768/768, and 375/375 in all five states. The exact student sequence remained resume -> `질량 6 kg 선택` -> wrong guidance -> `힌트 받기` -> fixed answer-safe level-one text -> `질량 2 kg 선택` -> `재도전 성공 · 탐험 완료` -> aggregate `40 / 100`. Teacher switching preserved the approved policy, process, boss evidence, and `개인 순위는 공개하지 않습니다.`

All 15 fresh full-page screenshots were visually inspected:

- `/tmp/lessonquest-attempt2-desktop-{initial,wrong,hint,completed,teacher}.png`
- `/tmp/lessonquest-attempt2-tablet-{initial,wrong,hint,completed,teacher}.png`
- `/tmp/lessonquest-attempt2-mobile-{initial,wrong,hint,completed,teacher}.png`

They show one coherent navy-black surface family without a large white, cream, pale-blue, or pale-yellow panel. The repaired cyan labels are legible, the student states and teacher panels remain readable and unclipped, responsive stacking is intact, and the aggregate boss moves only from `32 / 100` to `40 / 100`.

## Findings

### Critical or important

None.

### Minor scored gap

#### M1. Computed contrast, surface, geometry, target-size, focus, motion, and network assertions remain outside the checked-in suite

The checked-in regression at `apps/web/test/demo-shell.test.tsx:11-19` proves the shared dark-theme boundary, and the component tests cover the complete flow, aggregate progress, privacy copy, and teacher switch. The repaired contrast and multi-viewport browser requirements passed in the inspected `/tmp/lessonquest_visual_check.py` and an independent five-state probe, but those browser assertions are not durable repository tests. This is an evidence-maintenance gap, not a reproduced product or containment failure, and accounts for the test/operability deductions below.

## Requirement and containment audit

- `DemoShell` provides one `data-theme="dark"` boundary around student and teacher roles at `apps/web/src/demo-shell.tsx:9-63`.
- Every ordinary selector in `apps/web/src/demo-shell.css` is rooted below `.demo-shell`; the only global identifier is the local trajectory keyframe name.
- The fixed local hint remains answer-safe, and the student boss remains aggregate-only at `apps/web/src/demo-student-home.tsx:180-189`.
- Student DOM and screenshots contain no market, leaderboard, percentile, individual rank, named peer, or public student comparison. Teacher evidence explicitly rejects public individual ranking.
- The local decorative SVG is `aria-hidden`, non-focusable, and uses only its in-document `url('#trajectory-orbit')` paint reference.
- Runtime/static scans and browser traffic show no remote font, image, URL, import, fetch/XHR, WebSocket, EventSource, Firebase access, credential, or external request.
- No API, database, auth, authorization, tenant, provider, dependency, deployment, Firebase, persistent-state, external-AI, or real-student-data boundary changed.
- Rollback is a commit revert. There is no migration, persistent row, external asset, copied source, dependency addition, or irreversible operation requiring another recovery or provenance path.

## Critical-blocker audit

| Critical blocker                                                                           | Result    | Evidence                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unresolved authorization, tenant-isolation, secrets, or student-data risk                  | **CLEAR** | No auth/data boundary changed; static scans and browser traffic are clean; all content/state is local and synthetic                                           |
| Destructive or irreversible migration without backup/rollback                              | **CLEAR** | No schema, migration, database, deployment, or persistent-state change                                                                                        |
| Generated learning content publishable without independent validation and teacher approval | **CLEAR** | Fixed synthetic preview only; authoring, validation, approval, and publishing paths are unchanged                                                             |
| Untrusted generated code can access credentials or institution/student data                | **CLEAR** | No generated-code, provider, API, credential, adapter, or remote-asset path was added                                                                         |
| Existing source repository or deployment mutation                                          | **CLEAR** | Only this bounded local branch changed; no push, deployment, `vercel.json`, or external-repository mutation                                                   |
| Acceptance criteria cannot be verified                                                     | **CLEAR** | Tests, builds, audit, exact diffs, three-width/five-state browser evidence, screenshots, computed contrast, and containment scans are direct and reproducible |
| Required external authority, credentials, or user choice is missing                        | **CLEAR** | The unified dark direction was user-approved; local synthetic validation requires no external authority or credential                                         |

## Final implementation rubric

| Category                                    |      Score | Rationale                                                                                                                                                                                                                         |
| ------------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirement and approved-plan conformance   |      25/25 | Both roles, all five states, dark surfaces, repaired AA contrast, exact flow, privacy, 44 px targets, focus, motion, responsive behavior, builds, and exclusions pass without scope expansion                                     |
| Correctness and code quality                |      20/20 | The remediation is the minimal scoped token correction; component/state ownership, shared theme marker, selector containment, and responsive behavior remain correct and maintainable                                             |
| Security, privacy, and tenant isolation     |      20/20 | Synthetic aggregate-only content, fixed answer-safe hint, clean static/browser scans, and zero external requests are verified; no security or data boundary changed                                                               |
| Test and verification evidence              |      18/20 | 285 unit/component tests, 16 integration tests, 14 E2E tests, lint/format/type/build/audit, exact diff checks, and two browser probes pass; deduct because the visual/contrast assertions are not checked-in regressions          |
| Operability, recoverability, and provenance |      14/15 | Revert rollback, scoped/local assets, clean ranges, reproducible preview, documentation, and no dependency/external mutation are strong; deduct because decisive browser evidence remains ephemeral under `/tmp`/inline execution |
| **Total**                                   | **97/100** | **PASS**                                                                                                                                                                                                                          |

## Final decision

**PASS — 97/100, no critical blocker.** The contrast remediation resolves Attempt 1's only important finding: the two small-label groups now measure 9.7729:1 and 8.2360:1, both well above 4.5:1, with no regression in dark surfaces, behavior, privacy, target size, focus, reduced motion, responsiveness, builds, containment, or external-request isolation. Final HEAD `d16ebef65f1cc6014266c334d943e216dc84b0d7` satisfies the LessonQuest independent final-validation gate and may be accepted as complete. No merge, push, or deployment was performed.
