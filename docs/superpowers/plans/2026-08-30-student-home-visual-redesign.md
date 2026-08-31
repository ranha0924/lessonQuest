# Student Home Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vercel synthetic demo's student surface with the approved Cosmic Quest/Neo Academy hybrid while preserving the complete Phase 1 retry, Rasa, boss, and teacher-switch behavior.

**Architecture:** Split the student demo state and markup into `DemoStudentHome`, keep `DemoShell` responsible for role selection, and scope all new presentation rules in `demo-shell.css`. Reuse the real `RasaHintPanel` and `ClassBossCard`; do not add a new data adapter, dependency, external image, or network path.

**Tech Stack:** React 19, TypeScript 6, CSS, Vitest 4, Testing Library, Vite 8

**Spec:** `docs/superpowers/specs/2026-08-30-student-home-visual-redesign-design.md`

## Global Constraints

- The slice changes only the synthetic Vercel demo student surface; authenticated app, API, repositories, provider, schemas, `vercel.json`, and teacher-demo behavior remain unchanged.
- Preserve wrong answer → fixed answer-safe Rasa hint → correct retry → boss `32 / 100` to `40 / 100`.
- Render no market, individual rank, top percentile, named student comparison, real data, credential, Firebase content, external AI output, or external network asset.
- Keep every interactive target at least 44 px, visible keyboard focus, semantic landmarks, literal progress text, and `prefers-reduced-motion` support.
- Add no runtime or development dependency.
- Use the user-approved direction: 70% Cosmic Quest concept 1 and 30% Neo Academy concept 4.

---

### Task 1: Lock student-home semantics and preserved behavior with RED tests

**Files:**

- Modify: `apps/web/test/demo-shell.test.tsx`

**Interfaces:**

- Consumes: existing `DemoShell` export and Testing Library queries.
- Produces: behavioral acceptance tests for navigation, resume, Rasa/retry/boss progression, prohibited comparison copy, and teacher switching.

- [ ] **Step 1: Split the current broad test into literal behavior tests**

Add tests with these observable assertions:

```tsx
it('presents a synthetic student home without public comparison', () => {
  render(<DemoShell />);
  expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '힘과 운동 탐험' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '탐험 계속하기' })).toBeTruthy();
  expect(screen.getByText('32 / 100')).toBeTruthy();
  expect(screen.queryByText(/상위|순위|마켓/)).toBeNull();
});

it('resumes the mission and turns a retry into aggregate boss progress', () => {
  render(<DemoShell />);
  fireEvent.click(screen.getByRole('button', { name: '탐험 계속하기' }));
  fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
  expect(screen.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
  expect(screen.getByText(/재도전 성공/)).toBeTruthy();
  expect(screen.getByText('40 / 100')).toBeTruthy();
});

it('keeps the existing teacher evidence switch', () => {
  render(<DemoShell />);
  fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
  expect(screen.getByRole('heading', { name: '교사 운영 화면' })).toBeTruthy();
  expect(screen.getByText(/개인 순위는 공개하지 않습니다/)).toBeTruthy();
});
```

The first test catches removal of the home hierarchy or addition of prohibited student comparison. The second catches a broken resume path, hint policy, retry state, or aggregate boss projection. The third catches role-switch regression.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx
```

Expected: the initial-home test fails because the current demo has no `navigation` landmark or “탐험 계속하기” button; the interaction test fails at the missing resume action. The teacher test remains green and proves the fixture still renders.

- [ ] **Step 3: Commit the RED tests**

```bash
git add apps/web/test/demo-shell.test.tsx
git commit -m "test: define redesigned student demo behavior"
```

### Task 2: Build the semantic student-home component and restore GREEN

**Files:**

- Create: `apps/web/src/demo-student-home.tsx`
- Modify: `apps/web/src/demo-shell.tsx`
- Test: `apps/web/test/demo-shell.test.tsx`

**Interfaces:**

- Consumes: `RasaHintPanel`, `ClassBossCard`.
- Produces: `export function DemoStudentHome(): React.JSX.Element`.

- [ ] **Step 1: Add `DemoStudentHome` with local synthetic state**

Create a component with four booleans: `missionStarted`, `wrong`, `hintVisible`, and `completed`. Its initial render includes:

```tsx
<nav aria-label="주요 메뉴">...</nav>
<section aria-labelledby="student-mission-title">...</section>
<button type="button" className="demo-primary" onClick={() => setMissionStarted(true)}>
  탐험 계속하기
</button>
<aside aria-label="Rasa 학습 도우미">...</aside>
```

When `missionStarted` is true, render the existing question and exact two choice labels. Keep the existing state transitions and pass the same fixed hint object to `RasaHintPanel`. Pass damage `completed ? 40 : 32` and the existing campaign/title/target values to `ClassBossCard`.

The decorative mission SVG must have `aria-hidden="true"`, `focusable="false"`, a local `viewBox`, and no external reference.

- [ ] **Step 2: Make `DemoShell` delegate student rendering**

Import `DemoStudentHome` and replace only the current `role === 'STUDENT'` subtree with `<DemoStudentHome />`. Preserve the toolbar, role state, teacher subtree, and synthetic-data notice unchanged.

- [ ] **Step 3: Run the focused test and observe GREEN**

Run:

```bash
corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 4: Run the web component regressions**

Run:

```bash
corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx apps/web/test/m5-m6-e2e.test.tsx apps/web/test/demo-shell.test.tsx
```

Expected: all selected files and tests pass.

- [ ] **Step 5: Commit the semantic implementation**

```bash
git add apps/web/src/demo-student-home.tsx apps/web/src/demo-shell.tsx
git commit -m "feat: add semantic student demo home"
```

### Task 3: Apply the scoped Cosmic/Neo visual system

**Files:**

- Create: `apps/web/src/demo-shell.css`
- Modify: `apps/web/src/demo-shell.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**

- Consumes: semantic class names from `DemoShell` and `DemoStudentHome`.
- Produces: demo-only token and responsive styles below `.demo-shell`.

- [ ] **Step 1: Import demo styles after global styles**

Add `import './demo-shell.css';` in `main.tsx` immediately after `import './styles.css';` so demo selectors consistently win without `!important`.

- [ ] **Step 2: Move old toolbar rules into the scoped stylesheet**

Delete the existing `.demo-toolbar` block and its 680 px media rule from `styles.css`. Recreate them under `.demo-shell .demo-toolbar` in `demo-shell.css` so normal authenticated views do not inherit demo presentation.

- [ ] **Step 3: Implement the approved token and layout system**

Define all nine tokens from the spec on `.demo-shell`. Implement:

- a `min-height: 100dvh` mist background;
- a desktop grid with a `220px` navigation rail, `minmax(0, 1fr)` mission column, and `320px` support rail;
- mission trajectory SVG styles using orbit/ion/flare only;
- one dominant primary CTA, quiet secondary choices, and tabular boss figures;
- visible `:focus-visible` sun outline;
- a 980 px two-column breakpoint and a 680 px single-column/mobile navigation breakpoint;
- `overflow-x: clip` only on `.demo-shell`, while all child grids use `minmax(0, 1fr)` so content is not merely hidden;
- `prefers-reduced-motion` rules that remove trajectory and hover transforms.

Do not use remote fonts, background URLs, `@import`, emoji navigation icons, public-ranking motifs, or infinite decorative animation.

- [ ] **Step 4: Run formatting, type checking, focused tests, and builds**

Run:

```bash
corepack pnpm exec prettier --check apps/web/src/demo-shell.css apps/web/src/demo-shell.tsx apps/web/src/demo-student-home.tsx apps/web/src/main.tsx apps/web/test/demo-shell.test.tsx
corepack pnpm --filter @lessonquest/web exec tsc --noEmit -p tsconfig.json
corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx
corepack pnpm --filter @lessonquest/web build
VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build
```

Expected: every command exits 0; focused tests report 3 passing tests; both Vite builds emit `apps/web/dist/index.html`.

- [ ] **Step 5: Commit the visual system**

```bash
git add apps/web/src/demo-shell.css apps/web/src/demo-shell.tsx apps/web/src/main.tsx apps/web/src/styles.css
git commit -m "feat: apply Cosmic Neo student demo design"
```

### Task 4: Verify responsive behavior, document the preview, and prepare independent review

**Files:**

- Modify: `README.md`
- Modify: `memory/projects/lessonquest.md`

**Interfaces:**

- Consumes: final demo build and approved plan.
- Produces: reproducible preview instructions and final-review evidence.

- [ ] **Step 1: Run the demo locally at deterministic widths**

Start the built demo using Vite preview on loopback only:

```bash
VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build
corepack pnpm --filter @lessonquest/web exec vite preview --host 127.0.0.1
```

Inspect the student initial state and resumed mission at `1440x900`, `768x1024`, and `375x812`. Verify no horizontal page overflow, visible focus, correct content order, and reduced-motion behavior. Capture one desktop screenshot as review evidence outside the source tree; do not commit generated screenshots.

- [ ] **Step 2: Update preview documentation**

State in `README.md` that the student preview uses the Cosmic/Neo hybrid, is synthetic/reset-on-refresh, performs no API/Firebase/external-AI calls, and is not the authenticated production app. Record the plan score and verification status in `memory/projects/lessonquest.md` without claiming final completion before independent review.

- [ ] **Step 3: Run the complete verification bundle**

Run:

```bash
corepack pnpm check
corepack pnpm test:integration
corepack pnpm test:e2e
corepack pnpm audit --prod
VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build
git diff --check
```

Expected: unit/component tests, lint, formatting, type checking, all builds, integration, E2E, production dependency audit, demo build, and diff validation pass.

- [ ] **Step 4: Check containment and provenance**

Inspect `git diff --name-only db784b3...HEAD` and confirm there are no schema/API/provider/auth changes, dependencies, remote asset URLs, secret-like assignments, generated artifacts, or edits outside the approved demo/docs scope.

- [ ] **Step 5: Commit verification documentation**

```bash
git add README.md memory/projects/lessonquest.md
git commit -m "docs: record student demo redesign verification"
```

- [ ] **Step 6: Assign independent final validation**

Provide the reviewer with the approved spec, plan, full `db784b3...HEAD` diff, test output, responsive inspection evidence, and the final rubric in `memory/projects/lessonquest.md`. The reviewer must write `docs/reviews/2026-08-30-student-home-visual-redesign-final-review.md`, score at least 86/100 with no critical blocker, and must not edit implementation files.

## Plan self-review

- **Spec coverage:** Every scope, interaction, accessibility, privacy, responsive, normal-build, demo-build, and rollback requirement maps to Tasks 1–4.
- **Placeholder scan:** No TBD/TODO or unspecified implementation step remains.
- **Type consistency:** `DemoStudentHome` is the only new export; state and reused component props match existing interfaces.
- **Scope containment:** No application/API/DB/provider behavior, deployment setting, dependency, remote asset, or teacher-demo redesign is included.
