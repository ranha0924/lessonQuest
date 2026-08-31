# Cosmic Service Theme Implementation Plan

> Execute inline with test-first checkpoints. A fresh independent agent performs final validation under AGENTS.md; it must not implement the change.

**Goal:** Restore the user-approved space-game identity to the actual Studio and Play, using the astronaut in the previous Higgsfield concept as the direct image reference.

**Authority:** Current user request to redesign from the prior Higgsfield images, followed by “저 우주인 사진을 레퍼런스로해서 제작해”. The existing 70% Cosmic Quest / 30% Neo Academy direction and later unified dark theme are already approved. This is a bounded redesign of existing flows, not a new product architecture. Existing standing authorization covers verified main/Vercel delivery.

**Architecture:** A presentational CosmicShell wraps both real App roles and the development preview. Existing teacher mount preservation and immutable API identities stay unchanged. A local generated astronaut illustration and CSS provide the theme; real components retain their event handlers, authorization, hint state and authoritative data. Shared component presentation changes affect both normal service and development preview. Demo behavior stays separately testable.

**Tech stack:** Existing pinned React/TypeScript/Vite/Playwright. No dependency or deployment configuration change.

**Spec:** PROJECT_CANON.md; 2026-08-30 student-home and unified-dark-demo design specs; 2026-08-31 Phase1 Vercel development preview plan. Prior demo-only scope is expanded to real components by this request.

## Reference and design contract

- Inspected Higgsfield concept1 job `dc20bd14-71bf-4c48-9c74-0c50b65a47df`, concept4 `ffa4c7f7-b294-49fa-bbad-c18100b06022`, from task “Implement M5 and M6”. Locally inspected originals: `/tmp/lessonquest-higgsfield/1-cosmic.png` and `4-neo.png`.
- Generate one production illustration using the concept1 astronaut as the direct reference: rounded white spacesuit, dark cyan visor, orange suit details, backpack, walking along a cyan space path. Deep navy space and subtle planet, no UI/text/numbers. Built-in imagegen, no paid resource provisioning or reference-repository changes. Save final asset inside web source assets; record exact prompt and attribution. Generated image is decorative, not an interactive screenshot.
- Palette: space `#050817`, void `#0b1230`, panels `#111b3e`, raised `#17244d`, text `#f7f9ff`, muted `#adbcda`, cyan `#20c7df`, yellow `#ffc85a`. Quiet cool borders, restrained glows, yellow primary actions. No large light surfaces except immutable third-party learning artifact content inside the isolated iframe, which must not be modified to recolor approved artifacts.
- Typography: rounded display/system sans for headings, Apple SD Gothic Neo/system sans for Korean body, SFMono-Regular for small utility labels/JSON. No remote fonts.
- Desktop: compact left mission-control rail, main header and astronaut mission banner, Studio authoring/preview/review grid or Play mission list/canvas, Rasa companion. Tablet and mobile stack without horizontal overflow. Unsupported fake menus/streaks/levels/rankings are excluded.
- Keep safety notice visible and concise (synthetic data, reset on refresh, no real student information); expandable details can explain local-only identity/storage/Rasa and workflow. Preserve accessible heading “개발용 서비스 미리보기”, role button names, reset and existing test-facing action names.
- Every interactive target >=44px including labels for checkbox; visible 4px focus outline, normal text >=4.5:1, reduced motion. Decorative illustration must not contain functional controls or meaningful progress data.

## Ordered implementation

### 1. Baseline, reference asset and RED

- [x] Install frozen dependencies and run baseline `corepack pnpm test` in `.worktrees/cosmic-service` (base96cb449).
- [x] Add tests in `tests/browser/service-preview.spec.ts`: for teacher initial/validated, student empty/assigned/play/hint/completed, and teacher results, inspect dark surface luminance, >=44px controls, contrast, no overflow at desktop/tablet/mobile. Require astronaut image loaded with nonzero natural dimensions and a matching same-origin built asset. Existing fixture enforces zero external requests/errors and actual production headers.
- [x] Add tablet to `playwright.preview.config.ts`. Run `corepack pnpm test:preview` and observe new visual assertion failure on the current light UI, retaining existing real-flow tests.
- [x] Add a focused component test for truthful Studio stage indicators: save must not mark validation/approval/deployment complete; transitions follow actual state. Existing code incorrectly marks every stage active after draft creation. Expected pending stages remain inactive after save, validating the new visual claim.

### 2. Real-component theme and GREEN

Files: new `apps/web/src/components/cosmic-shell.tsx`, `cosmic-art.tsx`, `apps/web/src/cosmic-service.css`, image under `apps/web/src/assets/`; modify App, DevelopmentPreview, preview.css, main import, StudioWorkbench, StudentPlay as needed for presentation only.

Interface: `CosmicShell({role: 'TEACHER'|'STUDENT', children: ReactNode, previewControls?: ReactNode})`. Rail uses existing role controls when provided; authenticated App exposes only its authorized role. All shell selectors scoped under `.cosmic-service` except a safe root background fallback. No auth or runtime changes.

- [x] Generate/inspect astronaut asset, copy into repository after gate; render as decorative image with explicit dimensions, stable aspect ratio, alt="". Never fetch Higgsfield/CDN from the served app. Author matching small Rasa face in inline SVG with useId-scoped gradient identifiers, no external resources.
- [x] Wrap real roles, keep the teacher subtree mounted when hidden; retain all API closures/reset lifecycle. Place concise development notice and role controls into the shared rail/header.
- [x] Add mission banner to StudentPlay with server-derived assignment state and to Studio as a compact mission-control introduction. Keep actual assignments and questions, no canned demo UI. Student empty state tells how to get an assignment, not a fake play button. Completed assignment copy says completed.
- [x] Replace Studio stage rendering with derived completion flags `[versionId !== null, report?.verdict === 'PASS', previewDocument !== null, approved, assignmentId !== null]`, with current/pending text truthful and no mutation of handlers. Style current phase without suggesting all steps completed after saving.
- [x] Apply dark tokens to inputs, selects, cards, steps, status, quiz choices, Rasa, boss and teacher evidence. Keep sandbox attributes/content unchanged. Preserve source order and responsive layout. No remote font/image/analytics scripts.
- [x] Run targeted component tests and `test:preview`, compare actual screenshots against the inspected reference. Iterate layout/contrast before full verification.

### 3. Verification, independent gate and delivery

- [x] Run `corepack pnpm check`, `test:integration`, `test:e2e`, `test:browser`, `test:preview`, `audit --prod`, `git diff --check 96cb449`.
- [x] Inspect screenshots at1440x900,768x1024,375x812, including initial teacher, assigned student, hint and results. Check visible focus, reduced motion, broken/missing images and no reference screenshot UI baked into the app. Record asset byte size and generation provenance. Startup/normal build exclusion/reset tests remain green.
- [x] Save concrete RED/GREEN/full evidence in docs/reviews and update memory. Assign independent reviewer to complete diff, rerun checks and score actual implementation >85 with no critical blocker before acceptance/merge/deploy. If failed, fix under reviewed plan then obtain fresh reviewer.
- [ ] Commit/push reviewed candidate, require exact-head CI, merge with expected SHA, check merged tree/main CI, observe existing Git-linked Vercel deployment exact commit and perform real live synthetic flow. No duplicate deploy.

## Risks, boundaries and rollback

- Image must remain locally bundled and decorative so absent image cannot prevent actions. Limit generated asset to practical web size; no additional network origin/CSP relaxation. If optimization is needed, use image tool output or lossless file handling; do not redraw astronaut as a substitute.
- Never copy numerical claims/individual ranking from image. Any status/step/progress comes from current component/server state. Student class boss remains aggregate only.
- No Firebase, real students, DB/API/provider/auth/contracts/migrations changes. The preview remains per-tab memory, not secure production service. Existing learning sandbox may retain its own light theme because artifacts are immutable and isolated.
- CSS scoped to real service; demo still has its prior theme. Keep hidden teacher data hidden. All tests use synthetic data.
- Rollback is a reviewed revert of this presentational commit; no data operations, reference-repository mutation, dashboard change or force push.

## Plan self-review

All visual, state, accessibility, safety, reference provenance and delivery requirements map to the steps above. Existing event handlers and runtime lifecycle remain outside scope. The astronaut reference is actually inspected and its use is explicitly requested. Final validation is separate from implementer verification. No unresolved user choice or critical blocker remains.
