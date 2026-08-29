# Phase 1 Foundation and Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended when the user explicitly authorizes subagents) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Establish a reproducible TypeScript workspace and runtime-validated contracts for approved experiences, learning events, Rasa actions, and the sandbox bridge.

**Architecture:** This milestone creates the narrow, dependency-light contract layer that every later app and service must consume. Zod schemas are the runtime trust boundary; TypeScript types are inferred from those schemas so browser and server definitions cannot drift. No database, UI, AI provider, source-repository modification, or production student data is included.

**Tech Stack:** Node.js 24, pnpm 11.24.0, TypeScript 6.0.3, Vitest 4.1.11, Zod 4.5.2, ESLint 10.9.1, Prettier 3.9.6

**Spec:** `docs/INTEGRATION_PLAN_V2.md`

## Global Constraints

- Existing `wordQuest`, `FreeFallExperiment`, `jarvis`, `Earth`, `korean`, `bluemoon`, `history`, and `story` repositories and deployments are read-only.
- Work only on a `codex/` branch in an isolated worktree after user consent.
- No production code is written before its failing behavior test is observed.
- Development uses synthetic identifiers and fixtures; it does not connect to production Firebase or real student data.
- Runtime input is strict and fail-closed; unknown keys, unknown actions, absolute entrypoints, malformed IDs, and untrusted origins are rejected.
- Client messages cannot authoritatively create boss damage.
- Rasa cannot emit arbitrary UI operations or a final answer field.
- IDs at new trust boundaries use UUIDs; Experience IDs use stable lowercase slugs.
- No secrets are committed, logged, placed in client code, or accepted through contract payloads.
- Commits affect only `ranha0924/lessonQuest`; no push or deployment is performed by this plan.

## File Map

```text
package.json                         workspace commands and pinned toolchain
pnpm-workspace.yaml                 workspace package discovery
pnpm-lock.yaml                      resolved dependency graph
.npmrc                              reproducible pnpm settings
.gitignore                          secrets, build output, worktrees
.env.example                        allowed environment variable names only
eslint.config.js                    strict TypeScript linting
prettier.config.js                  deterministic formatting
tsconfig.base.json                  shared strict compiler settings
tsconfig.json                       build references
vitest.config.ts                    contract test discovery

packages/contracts/package.json     @lessonquest/contracts package metadata
packages/contracts/tsconfig.json    package build configuration
packages/contracts/src/primitives.ts shared secure scalar schemas
packages/contracts/src/manifest.ts  approved Experience manifest contract
packages/contracts/src/events.ts    client/server learning event contracts
packages/contracts/src/rasa.ts      Rasa context and allowed actions
packages/contracts/src/bridge.ts    sandbox postMessage envelope and guard
packages/contracts/src/index.ts     public exports

packages/contracts/test/manifest.test.ts
packages/contracts/test/events.test.ts
packages/contracts/test/rasa.test.ts
packages/contracts/test/bridge.test.ts

.github/workflows/ci.yml             clean install and verification
docs/SOURCE_PROVENANCE.md            source transplant ledger
```

---

### Task 1: Reproducible workspace and empty test harness

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `eslint.config.js`
- Create: `prettier.config.js`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: Node.js `>=24.0.0` and pnpm `11.24.0`
- Produces: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm check`

- [x] **Step 1: Connect the local repository to its public origin without overwriting files**

Run:

```bash
git remote add origin https://github.com/ranha0924/lessonQuest.git
git fetch origin main
```

Expected: `origin/main` resolves to the remote initial README commit; local `docs/` remains unmodified.

- [x] **Step 2: Create the isolated branch/worktree**

After explicit user consent, follow `superpowers:using-git-worktrees`. The target branch is `codex/phase1-foundation-contracts`; `.worktrees/` must be ignored before creation.

- [x] **Step 3: Add workspace configuration**

Use exact dependency versions:

```json
{
  "name": "lessonquest",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.24.0",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "build": "pnpm --filter @lessonquest/contracts build",
    "check": "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/node": "24.13.3",
    "eslint": "10.9.1",
    "prettier": "3.9.6",
    "typescript": "6.0.3",
    "typescript-eslint": "8.68.0",
    "vitest": "4.1.11"
  }
}
```

`packages/contracts/package.json`:

```json
{
  "name": "@lessonquest/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": { "zod": "4.5.2" }
}
```

Compiler settings must include `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `declaration`, `declarationMap`, and `sourceMap`. Use `module` and `moduleResolution` set to `NodeNext`, `target` set to `ES2024`, and exclude all `dist` and `.worktrees` directories.

Create `packages/contracts/src/index.ts` as the package marker with `export {};`. It has no behavior; Task 2 replaces it with tested public exports.

- [x] **Step 4: Install and verify the empty baseline**

Run:

```bash
pnpm install --frozen-lockfile=false
pnpm lint
pnpm typecheck
pnpm exec vitest run --passWithNoTests
pnpm build
```

Expected: all commands exit 0; the test command reports no test files rather than false successes.

- [x] **Step 5: Commit the workspace foundation**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .gitignore .env.example eslint.config.js prettier.config.js tsconfig.base.json tsconfig.json vitest.config.ts packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/src/index.ts docs
git commit -m "chore: establish LessonQuest contract workspace"
```

---

### Task 2: Secure scalar primitives and approved Experience manifest

**Files:**

- Create: `packages/contracts/test/manifest.test.ts`
- Create: `packages/contracts/src/primitives.ts`
- Create: `packages/contracts/src/manifest.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: Zod 4.5.2
- Produces: `uuidSchema`, `experienceIdSchema`, `contentHashSchema`, `relativeEntrypointSchema`, `experienceManifestSchema`, `ExperienceManifest`

- [x] **Step 1: Write failing manifest tests**

The test file must use a hand-written approved fixture and prove these breaks are caught:

```typescript
import { describe, expect, it } from 'vitest';
import { experienceManifestSchema } from '../src/manifest.js';

const approvedManifest = {
  schemaVersion: 1,
  id: 'science_inertia_01',
  version: 1,
  title: '급정거하는 버스',
  subject: 'science',
  gradeBands: ['middle1'],
  type: 'simulation',
  entrypoint: '/runner/science_inertia_01/1',
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c201',
  authorId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c202',
  status: 'approved',
  learningObjectives: ['관성을 실제 상황에 적용한다'],
  capabilities: ['quiz', 'rasa', 'class_boss'],
  createdWithAI: true,
  contentHash: `sha256:${'a'.repeat(64)}`,
} as const;

describe('experienceManifestSchema', () => {
  it('accepts an immutable approved manifest', () => {
    expect(experienceManifestSchema.parse(approvedManifest)).toEqual(approvedManifest);
  });

  it.each(['https://evil.example/x', '//evil.example/x', '/runner/../admin', '/runner\\evil'])(
    'rejects unsafe entrypoint %s',
    (entrypoint) => {
      expect(() => experienceManifestSchema.parse({ ...approvedManifest, entrypoint })).toThrow();
    },
  );

  it('rejects a draft manifest at the player boundary', () => {
    expect(() =>
      experienceManifestSchema.parse({ ...approvedManifest, status: 'draft' }),
    ).toThrow();
  });

  it('rejects unknown fields rather than mass-assigning them', () => {
    expect(() => experienceManifestSchema.parse({ ...approvedManifest, admin: true })).toThrow();
  });
});
```

- [x] **Step 2: Run the test and observe RED**

Run: `pnpm vitest run packages/contracts/test/manifest.test.ts`

Expected: FAIL because `../src/manifest.js` does not exist.

- [x] **Step 3: Implement strict primitives and manifest schema**

`primitives.ts` must:

- require UUIDs with `z.uuid()`;
- restrict Experience IDs to `/^[a-z0-9]+(?:_[a-z0-9]+)*$/` and 3–80 characters;
- restrict `contentHash` to `sha256:` plus exactly 64 lowercase hex characters;
- accept only root-relative entrypoints that start with one `/` and reject schemes, `//`, backslashes, NUL, `.` and `..` path segments.

`manifest.ts` must use `z.strictObject` and these enums:

```typescript
export const subjectSchema = z.enum([
  'science',
  'social',
  'korean',
  'english',
  'history',
  'hanja',
  'other',
]);

export const experienceTypeSchema = z.enum([
  'simulation',
  'map_exploration',
  'clue_collection',
  'story_scene',
  'quiz',
  'rpg',
]);

export const capabilitySchema = z.enum(['quiz', 'rasa', 'class_boss']);
```

The manifest boundary accepts only `schemaVersion: 1`, `status: 'approved'`, positive integer versions, 1–120 character titles, 1–8 unique grade bands, 1–12 objectives, and unique capabilities.

- [x] **Step 4: Run GREEN and mutation checks**

Run:

```bash
pnpm vitest run packages/contracts/test/manifest.test.ts
pnpm typecheck
```

Expected: 4 test groups pass. Temporarily allowing `//` or `.passthrough()` would make at least one test fail.

- [x] **Step 5: Commit**

```bash
git add packages/contracts/src packages/contracts/test/manifest.test.ts
git commit -m "feat: define approved experience manifest contract"
```

---

### Task 3: Client and server LearningEvent contracts

**Files:**

- Create: `packages/contracts/test/events.test.ts`
- Create: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: primitive UUID and Experience ID schemas
- Produces: `clientLearningEventSchema`, `serverLearningEventSchema`, `ClientLearningEvent`, `ServerLearningEvent`

- [x] **Step 1: Write failing event tests**

Use this literal base fixture:

```typescript
const base = {
  schemaVersion: 1,
  eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c301',
  organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c302',
  assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c303',
  attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c304',
  experienceId: 'science_inertia_01',
  experienceVersion: 1,
  stepId: 'q_04',
  sequence: 7,
  occurredAt: '2026-08-29T03:20:10.000Z',
} as const;
```

Tests must prove:

1. a `QUESTION_ANSWERED` payload `{ correct: false, attempt: 1, elapsedMs: 18400 }` passes;
2. attempt `0`, negative elapsed time, malformed timestamp, or unexpected answer text fails;
3. a client `BOSS_DAMAGE_EARNED` event fails even if its payload looks valid;
4. a server `BOSS_DAMAGE_EARNED` event with `{ amount: 4, reason: 'answer_retried' }` passes;
5. unknown event types and extra top-level fields fail.

- [x] **Step 2: Run RED**

Run: `pnpm vitest run packages/contracts/test/events.test.ts`

Expected: FAIL because the event schemas do not exist.

- [x] **Step 3: Implement discriminated strict event schemas**

Define strict variants for all canonical event types:

```text
EXPERIENCE_STARTED       {}
STEP_VIEWED              { elapsedMs? }
QUESTION_ANSWERED        { correct, attempt, elapsedMs }
ANSWER_RETRIED           { correct, attempt, elapsedMs }
HINT_USED                { level: 1|2|3 }
RASA_OPENED              {}
CHOICE_MADE              { choiceId }
EXPERIENCE_COMPLETED     { elapsedMs }
EXPERIENCE_EXITED        { elapsedMs, reason: user|navigation|timeout|error }
ERROR_REPORTED           { code, recoverable }
BOSS_DAMAGE_EARNED       { amount, reason }
```

`clientLearningEventSchema` is a discriminated union without `BOSS_DAMAGE_EARNED`. `serverLearningEventSchema` adds that server-only variant. Bound strings to 128 characters, elapsed time to `0..86_400_000`, sequence to `0..1_000_000`, attempt to `1..100`, and boss amount to `1..10_000`. Use ISO datetime strings with an offset.

- [x] **Step 4: Run GREEN and all contract tests**

Run:

```bash
pnpm vitest run packages/contracts/test/events.test.ts
pnpm test
pnpm typecheck
```

Expected: event tests and prior manifest tests pass with no warnings.

- [x] **Step 5: Commit**

```bash
git add packages/contracts/src/events.ts packages/contracts/src/index.ts packages/contracts/test/events.test.ts
git commit -m "feat: validate authoritative learning events"
```

---

### Task 4: Rasa Context and allowlisted Action contracts

**Files:**

- Create: `packages/contracts/test/rasa.test.ts`
- Create: `packages/contracts/src/rasa.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: UUID and Experience ID primitives
- Produces: `rasaContextSchema`, `rasaActionSchema`, `RasaContext`, `RasaAction`

- [x] **Step 1: Write failing Rasa tests**

Tests must exercise real parsing and prove:

- a context with student grade band, subject/unit, Experience/version, scene/step, one misconception summary, used hint level, objectives, max hint level, and `forbidFinalAnswer: true` passes;
- missing organization/assignment IDs, more than 20 recent responses, or a raw `studentEmail` field fails;
- `SHOW_HINT` with matching Experience/step, level `2`, and 1–500 character content passes;
- `CLICK_ANYWHERE`, `RUN_COMMAND`, or an extra `finalAnswer` field fails;
- `REQUEST_TEACHER_HELP` accepts only a 1–300 character reason and does not carry an email target;
- navigation actions carry only the identifiers they need.

- [x] **Step 2: Run RED**

Run: `pnpm vitest run packages/contracts/test/rasa.test.ts`

Expected: FAIL because `rasa.ts` does not exist.

- [x] **Step 3: Implement strict Rasa schemas**

Use a discriminated union whose allowed actions are exactly:

```text
OPEN_EXPERIENCE
GO_TO_STEP
NEXT_STEP
PREVIOUS_STEP
SHOW_HINT
EXPLAIN_SIMPLER
READ_TEXT
PLAY_AUDIO
PLAY_VIDEO
SHOW_IMAGE
ASK_REFLECTION
REQUEST_TEACHER_HELP
```

Context rules:

- `schemaVersion` is `1`;
- organization, assignment, session and student IDs are UUIDs;
- recent responses are summaries only and contain `correct` plus optional `misconceptionTag`, never raw free-form answers;
- `usedHintLevels` contains unique values `1|2|3`;
- `teacherPolicy.forbidFinalAnswer` is the literal `true`;
- all objects are strict and all free text has explicit length bounds.

- [x] **Step 4: Run GREEN and mutation checks**

Run:

```bash
pnpm vitest run packages/contracts/test/rasa.test.ts
pnpm test
pnpm typecheck
```

Expected: all tests pass. Adding a catch-all action, allowing unknown fields, or permitting `forbidFinalAnswer: false` must break at least one test.

- [x] **Step 5: Commit**

```bash
git add packages/contracts/src/rasa.ts packages/contracts/src/index.ts packages/contracts/test/rasa.test.ts
git commit -m "feat: constrain Rasa context and actions"
```

---

### Task 5: Sandbox bridge envelope and origin/nonce guard

**Files:**

- Create: `packages/contracts/test/bridge.test.ts`
- Create: `packages/contracts/src/bridge.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Consumes: UUID schema and Rasa Action schema
- Produces: `bridgeMessageSchema`, `parseBridgeMessage(input, trust)`, `BridgeMessage`, `BridgeTrust`, `BridgeMessageError`

- [x] **Step 1: Write failing bridge tests**

Use `https://runner.lessonquest.test` as the expected synthetic origin, a UUID session, and a 43-character base64url nonce. Prove:

- an exact `RUNNER_READY` envelope parses;
- wrong origin throws `BridgeMessageError` with code `ORIGIN_MISMATCH`;
- wrong nonce throws code `NONCE_MISMATCH`;
- a missing/unknown channel, version, message type, or extra field is rejected as `INVALID_MESSAGE`;
- a valid `RASA_ACTION` payload is parsed through `rasaActionSchema`, not as unknown JSON;
- caller-provided `sourceMatches: false` throws `SOURCE_MISMATCH`.

- [x] **Step 2: Run RED**

Run: `pnpm vitest run packages/contracts/test/bridge.test.ts`

Expected: FAIL because the bridge guard does not exist.

- [x] **Step 3: Implement the bridge schema and guard**

The pure guard API is:

```typescript
export interface BridgeTrust {
  actualOrigin: string;
  expectedOrigin: string;
  expectedNonce: string;
  sourceMatches: boolean;
}

export function parseBridgeMessage(input: unknown, trust: BridgeTrust): BridgeMessage;
```

Check `sourceMatches`, exact origin equality, and nonce before returning a parsed message. Never support wildcard origin. `BridgeMessageError` exposes only one of `SOURCE_MISMATCH | ORIGIN_MISMATCH | NONCE_MISMATCH | INVALID_MESSAGE`; it must not echo attacker-controlled payloads in its message.

Allowed message types in this milestone:

```text
PLATFORM_INIT
RUNNER_READY
RUNNER_STATUS
RUNNER_ERROR
LEARNING_EVENT
RASA_ACTION
```

Each payload is a strict schema. `LEARNING_EVENT` uses the client event schema, so boss damage cannot cross from runner to platform as an authoritative client event.

- [x] **Step 4: Run GREEN and all checks**

Run:

```bash
pnpm vitest run packages/contracts/test/bridge.test.ts
pnpm check
```

Expected: all contract tests, lint, formatting, typecheck, and build pass.

- [x] **Step 5: Commit**

```bash
git add packages/contracts/src/bridge.ts packages/contracts/src/index.ts packages/contracts/test/bridge.test.ts
git commit -m "feat: secure the experience sandbox bridge"
```

---

### Task 6: CI, provenance ledger, and milestone verification

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `docs/SOURCE_PROVENANCE.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: root `pnpm check`
- Produces: reproducible CI and a mandatory ledger for later code transplants

- [x] **Step 1: Add CI**

The workflow must:

- run on pull requests and pushes to `main`;
- use Ubuntu and Node 24;
- enable Corepack and activate pnpm 11.24.0;
- run `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm audit --prod --audit-level high`;
- grant only `contents: read` permission;
- use no deployment credentials.

- [x] **Step 2: Add the provenance ledger**

`docs/SOURCE_PROVENANCE.md` starts with an empty table whose columns are:

```text
LessonQuest path | source repository | source commit | source path | imported symbol/fixture | changes in assumptions | parity test | ownership/license note
```

State that a row is added in the same commit as every future transplant. The current contracts are original LessonQuest code, so the table contains one explicit “not applicable — original contract layer” row rather than claiming an external source.

- [x] **Step 3: Replace the one-line README with verified commands and scope**

Document:

- the one-sentence product definition from `docs/PROJECT_CANON.md`;
- Node/pnpm requirements;
- `pnpm install`, `pnpm check`, and contract package location;
- the read-only source repository rule;
- links to `docs/PROJECT_CANON.md`, `docs/INTEGRATION_PLAN_V2.md`, and this plan.

- [x] **Step 4: Verify from a clean dependency state**

Run:

```bash
pnpm check
pnpm audit --prod --audit-level high
git diff --check
git status --short
```

Then remove only `node_modules` directories through the package manager or an explicit, verified path, reinstall with `pnpm install --frozen-lockfile`, and run `pnpm check` again.

Expected: 0 lint errors, 0 formatting changes, 0 type errors, all tests pass with 0 skipped, build exits 0, no high/critical production advisories, and `git diff --check` exits 0.

- [x] **Step 5: Commit the milestone**

```bash
git add .github/workflows/ci.yml README.md docs/SOURCE_PROVENANCE.md
git commit -m "ci: verify LessonQuest contract foundation"
```

## Self-Review Record

- **Spec coverage:** This milestone covers the common Experience manifest, LearningEvent, Rasa Context/Action, sandbox message boundary, provenance, security defaults, and repeatable verification required before UI/API work. Identity, database, AI jobs, player UI, and deployment remain separate testable milestone plans.
- **Placeholder scan:** No unfinished placeholder instruction is present; every planned interface, failure case, command, and file has a concrete definition.
- **Type consistency:** UUID, Experience ID, event, Rasa action, and bridge names match from producer to consumer. The bridge consumes the client event contract and cannot accept server-only boss damage.
- **Security influence:** VibeSec requirements produced strict objects, UUID trust-boundary IDs, origin/source/nonce validation, mass-assignment rejection, secret-free config, least-privilege CI, and fail-closed schemas.
