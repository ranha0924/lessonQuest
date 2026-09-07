# Task 1 report — strict F01 lesson input contracts

## Implementation

Added strict Zod contracts for teacher-authored lesson inputs. Create and update inputs normalize bounded text and objectives, use the existing UUID and supported grade-band schemas, enforce positive bounded revisions, and reject forged or unknown fields. Lesson responses include tenant/owner identity, revision, and offset-aware timestamps; summaries expose only the approved projection; mutation results are strict. All public types are inferred from schemas.

## Files

- `packages/contracts/src/lesson-inputs.ts` — new schemas and inferred public types.
- `packages/contracts/src/index.ts` — exports the new contract module.
- `packages/contracts/test/lesson-inputs.test.ts` — normalization, boundary, strictness, response, and forged-key tests.

## RED evidence

Command:

```text
corepack pnpm deps:build && corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts
```

Output (before production edits):

```text
❯ packages/contracts/test/lesson-inputs.test.ts (0 test)
FAIL ... Error: Cannot find module '../src/lesson-inputs.js'
Tests  no tests
```

The command exited non-zero because the requested module did not yet exist.

## GREEN evidence

Focused command:

```text
corepack pnpm exec vitest run packages/contracts/test/lesson-inputs.test.ts packages/contracts/test/science.test.ts packages/contracts/test/learning.test.ts
```

Result: `Test Files 3 passed (3)` and `Tests 25 passed (25)`.

Contract package command:

```text
corepack pnpm exec vitest run packages/contracts/test
```

Result: `Test Files 10 passed (10)` and `Tests 120 passed (120)`.

Build command:

```text
corepack pnpm --filter @lessonquest/contracts build
```

Result: TypeScript build passed (`tsc -p tsconfig.json`). `git diff --check` was clean.

## Self-review

The implementation matches the brief’s exact bounds, normalization, strict objects, response projection, list cap, and inferred type requirement. It imports existing `uuidSchema` and `supportedGradeBandSchema`, adds no dependencies, and does not introduce API, database, UI, AI, Firebase, or real-data behavior. Tests cover every required negative category and unknown response keys.

## Concerns

None identified for this contract-only slice. Summary/list schemas intentionally require callers to provide only the documented projection, as specified by strict response contracts.
