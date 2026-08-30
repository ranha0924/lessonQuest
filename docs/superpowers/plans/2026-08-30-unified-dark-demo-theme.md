# Unified Dark Demo Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert both roles of the synthetic Vercel demo to one coherent, game-forward dark surface system without changing behavior or data boundaries.

**Architecture:** Add a semantic dark-theme contract to `DemoShell`, then revise only selectors already scoped below `.demo-shell`. Preserve component markup and state ownership except for the theme marker, and verify actual computed surfaces with the existing local Playwright matrix.

**Tech Stack:** React 19, TypeScript 6, CSS, Vitest 4, Testing Library, Vite 8, local Python Playwright inspection

**Spec:** `docs/superpowers/specs/2026-08-30-unified-dark-demo-theme-design.md`

## Global Constraints

- Both student and teacher synthetic demo views use the same dark theme.
- White is reserved for text and SVG highlights; no large white, cream, pale-blue, or pale-yellow panel surface remains.
- Preserve the exact student retry/Rasa/boss flow, aggregate-only visibility, teacher copy, and role switching.
- Preserve 44 px targets, focus-visible styling, reduced motion, and no horizontal overflow at 1440×900, 768×1024, and 375×812.
- Add no dependency, remote asset, network path, API/DB/auth/provider/deployment change, or real data.

---

### Task 1: Lock the unified theme contract with RED

**Files:**

- Modify: `apps/web/test/demo-shell.test.tsx`

**Interfaces:**

- Consumes: `DemoShell`.
- Produces: a stable `data-theme="dark"` contract shared by both role subtrees.

- [ ] **Step 1: Add the failing theme-contract test**

```tsx
it('uses one dark theme contract across student and teacher views', () => {
  const { container } = render(<DemoShell />);
  const shell = container.querySelector('.demo-shell');
  expect(shell?.getAttribute('data-theme')).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
  expect(screen.getByRole('heading', { name: '교사 운영 화면' }).closest('.demo-shell')).toBe(
    shell,
  );
});
```

This test fails when the shared theme marker is absent and proves both role views remain inside the same theme boundary.

- [ ] **Step 2: Observe RED**

Run:

```bash
corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx
```

Expected: the new test fails with `expected null to be 'dark'`; the existing three behavior tests remain green.

### Task 2: Apply the single dark surface system and restore GREEN

**Files:**

- Modify: `apps/web/src/demo-shell.tsx`
- Modify: `apps/web/src/demo-shell.css`
- Test: `apps/web/test/demo-shell.test.tsx`

**Interfaces:**

- Consumes: existing `.demo-shell` scope and all existing component class names.
- Produces: `<main className="demo-shell" data-theme="dark">` and the palette in the approved design.

- [ ] **Step 1: Add the minimal theme marker**

Set `data-theme="dark"` on the existing `main.demo-shell`. Do not move or duplicate role state.

- [ ] **Step 2: Convert shared and student surfaces**

In `demo-shell.css`, add `--lq-black`, `--lq-raised`, and `--lq-paper`, change `--lq-surface` and `--lq-muted` to the approved dark values, and replace all light page/card/control/status backgrounds with black, void, surface, or raised tokens. Keep paper only for text/SVG details. Keep the yellow primary CTA.

- [ ] **Step 3: Add demo-scoped teacher overrides**

Style `.demo-shell .workbench`, `.demo-shell .mission-header`, `.demo-shell .workbench-grid .panel`, and teacher status/boss elements with the same dark tokens. Do not change teacher JSX or copy.

- [ ] **Step 4: Observe GREEN and run focused regressions**

Run:

```bash
corepack pnpm exec vitest run apps/web/test/demo-shell.test.tsx
corepack pnpm exec vitest run apps/web/test/app.test.tsx apps/web/test/m3-m4-e2e.test.tsx apps/web/test/m5-m6-e2e.test.tsx apps/web/test/demo-shell.test.tsx
```

Expected: 4 focused demo tests and all selected web regressions pass.

### Task 3: Verify computed dark surfaces and the complete repository

**Files:**

- Modify: `memory/projects/lessonquest.md`

**Interfaces:**

- Consumes: built `VITE_DEMO_MODE=true` preview.
- Produces: reproducible browser and repository verification evidence.

- [ ] **Step 1: Extend the local browser assertion before rebuilding**

Update `/tmp/lessonquest_visual_check.py` outside source control to assert that computed background colors for student page/card/control/status surfaces and teacher panels fall below the approved dark luminance threshold. Keep the existing overflow, 44 px, focus, flow, and reduced-motion assertions.

- [ ] **Step 2: Build and inspect all required states**

Run the demo build and local loopback preview. Inspect initial student, wrong/hint/correct student, and teacher states at 1440×900, 768×1024, and 375×812. Confirm no external request or console error.

- [ ] **Step 3: Run complete verification**

```bash
corepack pnpm check
corepack pnpm test:integration
corepack pnpm test:e2e
corepack pnpm audit --prod
VITE_DEMO_MODE=true corepack pnpm --filter @lessonquest/web build
git diff --check db784b3
```

Expected: 284 or more unit/component tests, 16 integration tests, 14 E2E tests, builds, audit, and range diff pass.

- [ ] **Step 4: Record evidence and request fresh independent validation**

Record the new plan score, RED/GREEN evidence, computed-surface inspection, and verification results in project memory. A newly assigned non-implementing reviewer must inspect the complete diff and score at least 86/100 with no critical blocker before completion.

## Plan self-review

- **Coverage:** The test, student surface, teacher surface, computed-style matrix, accessibility, privacy, build, containment, and rollback requirements map to Tasks 1–3.
- **Scope:** This is CSS and one semantic attribute only; no component/data refactor is included.
- **No placeholders:** Every production change and verification command is concrete.
- **Type consistency:** `data-theme` is a standard React DOM attribute; no new exported interface is introduced.
