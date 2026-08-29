# Clean-checkout verification bootstrap plan

**Goal:** Make the repository's documented `corepack pnpm check` command succeed from a fresh checkout where workspace `dist` directories do not yet exist.

## Root cause and RED evidence

- The merged main worktree had no `packages/*/dist` directories after `corepack pnpm install --frozen-lockfile`.
- Workspace package manifests expose types from `./dist/index.d.ts`.
- The root `check` script runs `lint` before any script that builds workspace dependencies.
- A fresh merged-checkout run failed deterministically at lint with 187 unresolved-type errors. The same code passed in the feature worktree only because prior verification had already created `dist` outputs.

## Minimal implementation

1. Change only the root `package.json` `check` script so `pnpm deps:build` runs before lint.
2. Do not change application code, tests, dependency versions, lockfile, CI permissions, or GitHub workflow behavior.
3. Use the already captured clean-checkout failure as the RED reproduction.

## Acceptance and bounded verification

- Run one implementer verification on the merged checkout: `corepack pnpm check`.
- Run `corepack pnpm audit --prod --audit-level high` and `git diff --check` once.
- Assign one new independent non-implementing agent to inspect the one-line production diff, rerun the relevant clean-checkout check once, and score the actual result.
- Accept only at 86/100 or higher with no critical blocker. Do not push or create the PR before that result.

## Rollback

Revert the single `package.json` script change. No schema, data, external service, or generated artifact rollback is required.
