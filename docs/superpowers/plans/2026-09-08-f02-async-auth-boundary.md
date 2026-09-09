# F02 asynchronous authentication boundary implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. An independent non-implementing agent must perform final validation under AGENTS.md.

**Goal:** Make the existing authenticated API wait for server identity verification before invoking any tenant operation, enabling the subsequent Firebase adapter.

**Architecture:** Replace the concrete LocalAuthProvider dependency with a structural AuthProvider whose resolve method returns an Actor or Promise<Actor>. Keep local authentication synchronous and keep its production prohibition. The API awaits resolution and retains its existing safe error handling and per-request actor context.

**Tech Stack:** Existing TypeScript 6.0.3, Hono 4.13.5, Vitest 4.1.11, PGlite 0.5.8; no dependency additions or upgrades.

**Spec:** `docs/superpowers/specs/2026-09-08-f02-ai-draft-design.md`, sections 로그인과 최초 교사 등록 and 별도 검증 단위.

## Scope and global constraints

- This is the first independently testable prerequisite of the user's approved real login/server storage/OpenAI F02 request. It does not claim to implement Firebase sign-in, persistent PostgreSQL, OpenAI generation, or live deployment.
- Base: F01 `fe20d4b`; branch `codex/f02-live-authoring`. F01 has final score 98/100; origin/main still points to `79e9dde` at this check.
- Firebase project `lessonquest-df4b0` and Neon connection are user-reported complete. Browser verification reaches a Google sign-in screen. No remote credentials are necessary for this local compatibility change; live connection and release remain blocked on external verification/configuration.
- No Firebase request, remote DB, student data, reference repository, deployment configuration, migration, secret, or new paid resource is accessed or modified.
- Caller-supplied roles/tenant IDs remain untrusted. Awaiting authentication must occur before repository work; current repository authorization remains authoritative.
- Documentation/planning allowed before gate; runtime edits only after the plan review is >=86 with no blocker for this local scope.

## Acceptance criteria

1. A deferred authentication result leaves an authenticated create request pending and writes no organization or audit before identity resolves.
2. Once identity resolves, the real API/repository/PGlite path creates a tenant resource owned by that actor.
3. Rejected asynchronous verification returns the existing safe 401 and leaves no tenant resource. No provider message or credential reaches the response/diagnostic sink.
4. Concurrent requests resolving in reverse order use their own actors, with no shared identity leakage.
5. Synchronous local auth, missing/malformed token rejection, production prohibition, and all existing endpoint behavior remain green.

## Task 1: RED tests against the real HTTP and storage boundary

**Files:** Create `services/api/test/async-auth.test.ts`.

**Interfaces:** Use the existing `createApp`, `TenantRepository`, `LearningRepository`, `initializeSchema`, `AuthenticationError`, and shared `Actor`. Each test owns fresh PGlite and closes it. Test-only deferred promises emulate the external verifier latency/failure, while Hono and storage remain real.

- [x] Write a fixture containing two explicit teacher Actors with distinct literal UUIDs. Initialize users with `upsertUser` and never share DB state across tests.
- [x] Add a deferred helper with `{promise, resolve, reject}` in this test file only. It is test plumbing, not production API.
- [x] For RED typing compatibility use an intermediate structurally typed provider object; execute Vitest before typecheck. The missing await must produce a behavioral failure, not merely an import error.

```ts
const verification = Promise.withResolvers<Actor>();
const entered = Promise.withResolvers<void>();
const provider = {
  resolve() {
    entered.resolve();
    return verification.promise;
  },
};
const pending = app.request('/organizations', {
  method: 'POST',
  headers: {
    authorization: 'Bearer synthetic-verification-token',
    origin: trustedOrigin,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ name: '과학 수업' }),
});
await entered.promise;
expect((await database.query('SELECT id FROM organizations')).rows).toEqual([]);
verification.resolve(teacher);
expect((await pending).status).toBe(201);
```

- [x] Add a rejected verifier test using `AuthenticationError` and a safe assertion over the response and diagnostic event. Attach a test-side rejection observer to prevent a process-level unhandled rejection in the pre-await RED baseline; the API's returned status is the assertion target.
- [x] Add two simultaneous creates selected by exact synthetic bearer strings. Resolve second then first and assert each stored `created_by` independently equals the expected teacher UUID. A shared actor slot or dropped await must fail this test.
- [x] Run `corepack pnpm deps:build && corepack pnpm exec vitest run services/api/test/async-auth.test.ts`; retain output under ignored `.verification/f02-async-auth-red.log`. Expected: create fails before the change because the repository receives a Promise; rejected auth fails to produce the expected 401.

## Task 2: Minimal production change and GREEN

**Files:** Create `packages/auth/src/provider.ts`; modify `packages/auth/src/index.ts`, `packages/auth/src/local-auth.ts`, `services/api/src/app.ts`.

**Interfaces:**

```ts
import type { Actor } from '@lessonquest/contracts';

export interface AuthProvider {
  resolve(authorizationHeader: string | undefined): Actor | Promise<Actor>;
}
```

- [x] Export AuthProvider from the auth package root. Mark `LocalAuthProvider implements AuthProvider`; retain all constructor guards and resolve behavior.
- [x] Change CreateAppOptions.auth from LocalAuthProvider to AuthProvider and its import to a type-only import.
- [x] In the existing auth middleware, await resolve before setting the actor:

```ts
context.set('actor', await options.auth.resolve(context.req.header('authorization')));
```

- [x] Rebuild dependencies and rerun the focused suite plus `packages/auth/test/local-auth.test.ts` and `services/api/test/app.test.ts`. Retain GREEN output.
- [x] Do not add a timeout, token format, Firebase configuration, global cache, fallback identity, role mapping, or database adapter in this change. Those belong to their own approved plans.

## Verification and acceptance

- [x] Run `corepack pnpm check`, `corepack pnpm test:integration`, `corepack pnpm test:e2e`, `corepack pnpm test:browser`, `corepack pnpm test:preview`, `corepack pnpm audit --prod`, and `git diff --check`.
- [x] Record RED/GREEN and complete command exit statuses in `docs/reviews/2026-09-08-f02-async-auth-verification.md`.
- [x] Freeze implementation/test SHA-256 hashes; assign an independent agent that implemented none of this change. Reviewer must inspect actual diff, run focused checks and relevant regression checks, verify evidence, and record a scored final report in docs/reviews.
- [x] Fix any critical finding or score <=85 under a revised plan as needed, then obtain fresh independent review. Do not merge/release or call F02 complete based on this prerequisite's result.

## Subsequent work retained under the F02 objective

After this prerequisite, write separate concrete plans for (1) verified Firebase uid to current server identity/membership, explicit operator bootstrap and teacher registration; (2) PostgreSQL connection and migration adapter plus multi-connection concurrency checks; (3) Google login UI and F01 reload persistence; (4) OpenAI generation jobs, idempotency, quotas, structured output/independent validation and teacher review; (5) environment configuration, staging and production delivery. Each plan must pass the same gate before runtime changes begin. External verification is pending Google sign-in in the Codex browser and access to the existing Vercel project and secret settings.

## Recovery, observability and provenance

No schema or persisted data changes exist. Revert the bounded commit to restore the synchronous-only API typing; keep LocalAuth unchanged in behavior. Existing metadata-only error diagnostics and trace IDs remain active. All code is original LessonQuest; no reference-source copy or external dependency change occurs. Public health stays independent of authentication. Final delivery must include F01 and later F02 units with required CI and verified existing Git-linked Vercel deployment, under standing authorization.
