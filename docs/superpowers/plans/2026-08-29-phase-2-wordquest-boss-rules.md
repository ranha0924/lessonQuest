# Phase 2 WordQuest Boss Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selectively port WordQuest's fail-safe boss configuration, class-scoped identity, HP calculation, per-student damage aggregation, and server-verified contribution projection into a pure LessonQuest gamification package.

**Architecture:** Add `@lessonquest/gamification` as a side-effect-free domain package. Runtime schemas reject malformed configuration and projection inputs, WordQuest-compatible pure functions preserve verified source behavior, and contribution amounts are derived only from server-verified outcomes plus a server-owned policy. This slice is deliberately not connected to an API, database, Firebase, a deployment, or real student data.

**Tech Stack:** TypeScript 6.0.3, Zod 4.5.2, Vitest 4.1.11, pnpm 11.24.0

**Spec:** `docs/INTEGRATION_PLAN_V2.md`

## Global Constraints

- Treat `ranha0924/wordQuest` and all existing deployments as read-only reference sources.
- Pin copied behavior to WordQuest commit `2ce8dc57f68a74aebf7acef79cad522b7f72a571` and record paths, symbols, changed assumptions, parity tests, and ownership in `docs/SOURCE_PROVENANCE.md`.
- Do not connect Firebase, production credentials, existing WordQuest KV data, or real student data.
- `BOSS_ENABLED` compatibility is exact and fail-safe: only the raw string `"true"` enables boss behavior.
- Client-authored `BOSS_DAMAGE_EARNED` remains rejected by `clientLearningEventSchema`; the new package accepts only a server-owned verified-outcome contract and never accepts a client damage amount.
- Tenant and class identifiers are UUIDs. Weekly keys require a real ISO date that is a Monday; special versions are positive integers.
- Invalid runtime configuration or malformed projection input must be rejected, not normalized into an enabled state.
- This package is an offline/pure Phase 2 unit. It does not claim Phase 1 M3-M6 or Phase 2 completion, perform a data migration, or authorize a deployment.
- Follow TDD: create the behavior tests, observe the intended missing-module RED, then write production files and observe GREEN.
- Run one complete implementer verification at the end, followed by one new independent-agent final validation. Both gates require at least 86/100 and no critical blocker.

---

## Scope and file map

| File                                                 | Responsibility                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/gamification/package.json`                 | Workspace package metadata and pinned dependencies                                        |
| `packages/gamification/tsconfig.json`                | Declaration-producing package build configuration                                         |
| `packages/gamification/src/boss-rules.ts`            | Fail-safe switch parsing, difficulty normalization, boss keys, HP, and row aggregation    |
| `packages/gamification/src/boss-projection.ts`       | Strict server-verified outcome and policy schemas plus idempotent contribution projection |
| `packages/gamification/src/index.ts`                 | Public package exports only                                                               |
| `packages/gamification/test/boss-rules.test.ts`      | WordQuest parity and hardened-boundary tests                                              |
| `packages/gamification/test/boss-projection.test.ts` | Authority, deduplication, cap, tenant/class, and policy tests                             |
| `docs/SOURCE_PROVENANCE.md`                          | Immutable source commit and behavior mapping                                              |
| `README.md`                                          | Current implemented-scope marker                                                          |
| `memory/projects/lessonquest.md`                     | Durable Phase 2 milestone marker and validation result                                    |

## Public interfaces

```ts
export type BossDifficulty = 0.7 | 1 | 1.2;

export interface BossHpInput {
  previousActivityTotal: number;
  memberCount: number;
  difficulty: unknown;
  tuning?: {
    ratio?: unknown;
    perNewMember?: unknown;
    minHp?: unknown;
    maxHp?: unknown;
  };
}

export interface BossDamageRow {
  studentId: string;
  bossKey: string;
  damage: number;
}

export interface BossDamageAggregate {
  total: number;
  byStudent: ReadonlyArray<{ studentId: string; damage: number }>;
}

export function isBossEnabled(rawValue: unknown): boolean;
export function normalizeBossDifficulty(rawValue: unknown): BossDifficulty;
export function buildWeeklyBossKey(weekStart: string, classId: string): string;
export function buildSpecialBossKey(version: number, classId: string): string;
export function computeBossHp(input: BossHpInput): number;
export function aggregateBossDamage(
  rows: readonly BossDamageRow[],
  bossKey: string,
): BossDamageAggregate;
```

`boss-projection.ts` defines strict Zod schemas for these structures:

```ts
type VerifiedBossOutcomeKind = 'ANSWER_CORRECT' | 'ANSWER_RETRIED' | 'EXPERIENCE_COMPLETED';

interface VerifiedBossOutcome {
  organizationId: string;
  classId: string;
  studentId: string;
  sourceEventId: string;
  kind: VerifiedBossOutcomeKind;
  serverAccepted: true;
  firstForRule: boolean;
  capped: boolean;
}

interface BossContributionPolicy {
  enabled: boolean;
  amounts: {
    ANSWER_CORRECT: number;
    ANSWER_RETRIED: number;
    EXPERIENCE_COMPLETED: number;
  };
}

interface BossProjectionInput {
  organizationId: string;
  classId: string;
  campaignKey: string;
  policy: BossContributionPolicy;
  existingSourceEventIds: string[];
  outcomes: VerifiedBossOutcome[];
}

interface ProjectedBossContribution {
  organizationId: string;
  classId: string;
  campaignKey: string;
  studentId: string;
  sourceEventId: string;
  amount: number;
  reason: 'answer_correct' | 'answer_retried' | 'experience_completed';
}

export function projectBossContributions(input: BossProjectionInput): ProjectedBossContribution[];
```

The `serverAccepted: true` field is an internal contract marker, not an authentication mechanism. Only a future server ingestion/projection service may construct this input after authenticating the actor and validating the assignment, answer/completion, tenant, cap, and persistence state. The pure projector revalidates shape, tenant/class equality, policy bounds, duplicates, and the `firstForRule`/`capped` decisions. Database persistence must later enforce a unique constraint on `(organizationId, sourceEventId)` transactionally; the `existingSourceEventIds` snapshot and in-batch deduplication do not replace that database guarantee.

### Task 1: Establish the TDD contract with WordQuest parity fixtures

**Files:**

- Create: `packages/gamification/test/boss-rules.test.ts`
- Create: `packages/gamification/test/boss-projection.test.ts`

**Interfaces:**

- Consumes: the public interfaces above and literal fixtures from WordQuest `tools/boss-test/boss.test.mjs`.
- Produces: executable acceptance criteria for Tasks 2 and 3.

- [ ] **Step 1: Write the boss-rule tests before production files exist**

Use literal expected values, including:

```ts
expect(isBossEnabled(undefined)).toBe(false);
expect(isBossEnabled('false')).toBe(false);
expect(isBossEnabled('1')).toBe(false);
expect(isBossEnabled(true)).toBe(false);
expect(isBossEnabled('true')).toBe(true);

expect(buildWeeklyBossKey('2026-07-27', CLASS_A)).toBe(`w:2026-07-27:${CLASS_A}`);
expect(buildSpecialBossKey(1234, CLASS_A)).toBe(`s:1234:${CLASS_A}`);
expect(buildWeeklyBossKey('2026-07-27', CLASS_B)).not.toBe(
  buildWeeklyBossKey('2026-07-27', CLASS_A),
);

expect(normalizeBossDifficulty(0.7)).toBe(0.7);
expect(normalizeBossDifficulty(1.2)).toBe(1.2);
expect(normalizeBossDifficulty(1.3)).toBe(1.2);
expect(normalizeBossDifficulty(2)).toBe(1);

expect(computeBossHp({ previousActivityTotal: 2400, memberCount: 24, difficulty: 1 })).toBe(1080);
expect(computeBossHp({ previousActivityTotal: 2400, memberCount: 24, difficulty: 1.2 })).toBe(1296);
expect(computeBossHp({ previousActivityTotal: 450, memberCount: 6, difficulty: 0.7 })).toBe(142);
expect(computeBossHp({ previousActivityTotal: 0, memberCount: 10, difficulty: 1 })).toBe(150);
expect(computeBossHp({ previousActivityTotal: 999999, memberCount: 9, difficulty: 1.2 })).toBe(
  60000,
);
expect(
  computeBossHp({
    previousActivityTotal: 450,
    memberCount: 6,
    difficulty: 0.7,
    tuning: { ratio: '0.5' },
  }),
).toBe(158);
```

Also assert that weekly non-Monday/invalid dates, invalid UUIDs, non-finite/negative activity values, non-integer member counts, and unsafe aggregation rows throw. Assert that aggregation ignores other boss keys and non-positive damage, takes the maximum per student across repeated rows, sorts by student ID, and returns the literal total.

- [ ] **Step 2: Write server-authority projection tests before production files exist**

Use synthetic UUIDs only. Assert these exact behaviors:

```ts
expect(projectBossContributions({ ...baseInput, policy: { ...policy, enabled: false } })).toEqual(
  [],
);
expect(projectBossContributions({ ...baseInput, outcomes: [correctOutcome] })).toEqual([
  {
    organizationId: ORG,
    classId: CLASS_A,
    campaignKey: `w:2026-07-27:${CLASS_A}`,
    studentId: STUDENT,
    sourceEventId: EVENT_A,
    amount: 4,
    reason: 'answer_correct',
  },
]);
```

Add cases proving that duplicate source events (within the input and in `existingSourceEventIds`) contribute once or zero times, configured amounts rather than any outcome field determine damage, `firstForRule: false` contributes zero, `capped: true` contributes zero, mismatched organization/class contributes zero, all three kinds map to their reason and policy amount, and malformed IDs/policy/campaign keys are rejected. Do not add an `amount` field to the verified outcome schema.

- [ ] **Step 3: Run the focused tests and observe RED**

Run:

```bash
corepack pnpm contracts:build
corepack pnpm exec vitest run \
  packages/gamification/test/boss-rules.test.ts \
  packages/gamification/test/boss-projection.test.ts
```

Expected: FAIL because `../src/index.js` does not exist. A syntax, fixture, or environment failure is not the intended RED and must be corrected before Task 2.

- [ ] **Step 4: Commit the RED tests**

```bash
git add packages/gamification/test
git commit -m "test: define WordQuest boss rule parity"
```

### Task 2: Implement fail-safe boss rules and parity calculations

**Files:**

- Create: `packages/gamification/package.json`
- Create: `packages/gamification/tsconfig.json`
- Create: `packages/gamification/src/boss-rules.ts`
- Create: `packages/gamification/src/index.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 boss-rule tests.
- Produces: `isBossEnabled`, `normalizeBossDifficulty`, `buildWeeklyBossKey`, `buildSpecialBossKey`, `computeBossHp`, and `aggregateBossDamage`.

- [ ] **Step 1: Add the minimal workspace package**

Use package name `@lessonquest/gamification`, `type: module`, `workspace:*` for `@lessonquest/contracts`, exact `zod: 4.5.2`, and the same `dist` export/build structure as `@lessonquest/contracts`. The package TypeScript config extends `../../tsconfig.base.json`, emits declarations/maps/source maps from `src` to `dist`, and excludes `test`.

- [ ] **Step 2: Implement boss identity and fail-safe normalization**

Implement exact WordQuest-compatible output on valid inputs:

```ts
export function isBossEnabled(rawValue: unknown): boolean {
  return rawValue === 'true';
}

export function normalizeBossDifficulty(rawValue: unknown): BossDifficulty {
  const value = Number(rawValue);
  if (value === 0.7) return 0.7;
  if (value === 1.2 || value === 1.3) return 1.2;
  return 1;
}
```

Validate UUID class IDs, validate calendar dates without JavaScript rollover, and require weekly dates to be Monday before returning `w:${weekStart}:${classId}`. Validate positive safe-integer special versions before returning `s:${version}:${classId}`.

- [ ] **Step 3: Implement HP and damage aggregation**

HP defaults and clamps are copied from WordQuest: ratio `0.45` clamped to `0.05..5`, new-member amount `15`, minimum `60`, maximum `60000`, and swap min/max when configured in reverse. With prior activity use `Math.round(ratio * previousActivityTotal * normalizedDifficulty)`; otherwise use `(memberCount > 0 ? memberCount : 3) * perNewMember`; finally clamp to min/max. Reject non-finite or negative activity, non-safe-integer activity/member counts, and invalid configured integer bounds.

For aggregation, reject malformed top-level input and unsafe-integer damage values, ignore rows for another boss or damage `<= 0`, retain each student's maximum damage, sort by `studentId`, and sum with a safe-integer overflow guard.

- [ ] **Step 4: Export the rule module and update the lockfile**

```ts
export * from './boss-rules.js';
export * from './boss-projection.js';
```

Run `corepack pnpm install --lockfile-only` after creating package metadata. The missing `boss-projection.ts` remains the expected focused-test failure until Task 3.

- [ ] **Step 5: Commit the rule implementation**

```bash
git add packages/gamification pnpm-lock.yaml
git commit -m "feat: port fail-safe WordQuest boss rules"
```

### Task 3: Implement server-verified contribution projection

**Files:**

- Create: `packages/gamification/src/boss-projection.ts`
- Test: `packages/gamification/test/boss-projection.test.ts`

**Interfaces:**

- Consumes: `BossProjectionInput`, `VerifiedBossOutcome`, and `BossContributionPolicy` from the public-interface section.
- Produces: `projectBossContributions(input): ProjectedBossContribution[]` and the strict schemas/types it uses.

- [ ] **Step 1: Define strict runtime schemas**

Use `z.strictObject`, `uuidSchema`, a campaign key string bounded to 1..240 characters and matching `^(?:w:\\d{4}-\\d{2}-\\d{2}|s:[1-9]\\d*):[0-9a-f-]{36}$`, policy amounts as integers `0..10000`, `serverAccepted: z.literal(true)`, and strict outcome objects without an amount property. The projection input requires strict organization/class UUIDs and an array of existing event UUIDs.

- [ ] **Step 2: Implement the fail-closed pure projector**

Parse the complete input before doing work. Return `[]` when `policy.enabled` is false. Seed a `Set` with `existingSourceEventIds`, then process outcomes in input order. Skip tenant/class mismatches, `firstForRule: false`, `capped: true`, duplicate event IDs, and policy amounts of zero. Map reasons with a total mapping:

```ts
const reasonByKind = {
  ANSWER_CORRECT: 'answer_correct',
  ANSWER_RETRIED: 'answer_retried',
  EXPERIENCE_COMPLETED: 'experience_completed',
} as const;
```

Mark a valid event ID seen before appending so duplicate outcomes cannot select a later variant. Build the contribution amount exclusively from `policy.amounts[outcome.kind]`. Do not accept a `BOSS_DAMAGE_EARNED` outcome and do not generate source event IDs.

- [ ] **Step 3: Run the focused tests and observe GREEN**

Run:

```bash
corepack pnpm contracts:build
corepack pnpm exec vitest run \
  packages/gamification/test/boss-rules.test.ts \
  packages/gamification/test/boss-projection.test.ts
```

Expected: both files PASS with zero skipped tests, warnings, or unhandled errors.

- [ ] **Step 4: Run package build/type verification**

```bash
corepack pnpm --filter @lessonquest/gamification build
corepack pnpm deps:build
corepack pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the projection**

```bash
git add packages/gamification/src packages/gamification/test
git commit -m "feat: derive boss contributions from verified outcomes"
```

### Task 4: Record provenance, containment, and final evidence

**Files:**

- Modify: `docs/SOURCE_PROVENANCE.md`
- Modify: `README.md`
- Modify: `memory/projects/lessonquest.md`
- Create: `docs/reviews/2026-08-29-phase-2-wordquest-boss-rules-final-review.md` (independent reviewer only)

**Interfaces:**

- Consumes: the completed code, tests, source commit, and verification output.
- Produces: auditable source lineage, an honest milestone marker, and the required independent acceptance result.

- [ ] **Step 1: Add source provenance**

Record `ranha0924/wordQuest` commit `2ce8dc57f68a74aebf7acef79cad522b7f72a571`; source `rank-worker/worker.js` symbols `bossOn`, `bossWeeklyId`, `bossSpecialId`, `bossDiff`, `bossHpCompute`, `bossRowsSum`, and the verified-submit `dmgAdd` rules; source fixtures `tools/boss-test/boss.test.mjs` and `tools/boss-sim/hp-sim.mjs`; LessonQuest parity test paths; UUID/date/runtime validation hardening; and the user's ownership of both repositories with no third-party relicensing claim.

- [ ] **Step 2: Update only the implemented-scope markers**

State that the first Phase 2 unit is a pure gamification package and is not yet wired to an API or database. Preserve the statement that Phase 1 M3-M6 and the remaining Phase 2 class/invite/dashboard/PWA/data work are incomplete. State that no source repository, deployment, Firebase project, or real data was modified.

- [ ] **Step 3: Run the single implementer final verification**

```bash
corepack pnpm check
corepack pnpm audit --audit-level high
git diff --check origin/main...HEAD
git status --short
```

Record exact pass/fail and test counts. This is the only full implementer suite for this unit.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/SOURCE_PROVENANCE.md README.md memory/projects/lessonquest.md
git commit -m "docs: record WordQuest boss rule provenance"
```

- [ ] **Step 5: Request one fresh independent final review**

The reviewer must not edit implementation files, must inspect `origin/main...HEAD`, this plan, the canonical documents, source provenance, focused tests, dependency changes, and implementation. The reviewer runs the relevant checks once, writes `docs/reviews/2026-08-29-phase-2-wordquest-boss-rules-final-review.md`, scores the 100-point final rubric, and explicitly reports critical blockers. Acceptance requires `>=86/100` with no blocker; otherwise resume test-first remediation and request a different fresh review after fixes.

- [ ] **Step 6: Commit the independent report without merging or deploying**

```bash
git add docs/reviews/2026-08-29-phase-2-wordquest-boss-rules-final-review.md
git commit -m "docs: record independent boss rules review"
```

Stop with the isolated branch ready for user review. Do not push, open/merge a pull request, or deploy without a later explicit request.

## Acceptance trace

| Requirement                          | Evidence                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Existing WordQuest remains untouched | Read-only GitHub inspection; all edits restricted to this worktree                           |
| Fail-safe rollback knob              | Exact-string `isBossEnabled` negative and positive tests                                     |
| Class-scoped campaign identity       | UUID/date validation and cross-class key tests                                               |
| WordQuest HP parity                  | Literal `1080`, `1296`, `142`, `150`, `158`, `60000` fixtures                                |
| Multi-row deduplication              | Per-student maximum and wrong-boss/non-positive tests                                        |
| No client damage authority           | Existing client contract regression plus outcome schema without `amount`                     |
| Server-owned configurable rules      | Strict policy and verified outcome projection tests                                          |
| Event replay containment             | Existing-ID and in-batch duplicate projection tests; future DB unique requirement documented |
| Tenant/class fail-closed behavior    | Mismatched organization/class projection tests                                               |
| No live data or migration            | Pure functions, synthetic UUIDs, no I/O dependencies                                         |
| Auditable copying                    | Exact commit, symbols, changed assumptions, and parity test paths in provenance              |

## Risks and containment

- **Not a complete authority boundary:** `serverAccepted: true` alone cannot authenticate a network request. Containment: the package is not exposed as an endpoint; future ingestion must construct outcomes after server verification.
- **No transactional idempotency yet:** a pure existing-ID snapshot can race. Containment: no persistence is implemented; a future schema must uniquely constrain `(organizationId, sourceEventId)`.
- **Phase sequencing mismatch:** canonical Phase 1 M3-M6 is unfinished. Containment: this is an isolated, reusable pure package with no runtime wiring and no claim of broader milestone completion.
- **Copied legacy coercions:** WordQuest accepts permissive numeric input. Containment: preserve outputs only for documented valid/parity inputs and reject malformed LessonQuest runtime values.
- **Rollback:** before integration, removing `packages/gamification` and its provenance row fully removes behavior. After future integration, the exact-string feature switch remains OFF unless explicitly set to `"true"`.

## Plan self-review

- **Spec coverage:** This plan covers only the first Phase 2 WordQuest quiz/boss rule unit from `docs/INTEGRATION_PLAN_V2.md` sections 5, 8, 9, 13 M6, 14, and 16. Class/invite/dashboard/PWA queue and read-only data mapping remain explicit later work.
- **Placeholder scan:** No TBD/TODO/unspecified implementation steps remain.
- **Type consistency:** Public names, reason literals, IDs, test fixtures, and task dependencies are consistent across all tasks.
- **Execution choice:** The user already instructed implementation to proceed. Execute inline with `superpowers:executing-plans`; use a fresh subagent only for the mandatory independent final review.
