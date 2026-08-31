# M5/M6 Audit Final-Gate Remediation: Disabled Organizations

> **For agentic workers:** Use test-driven development; obtain a fresh independent non-implementing review after the fix. Do not merge or deploy a failing candidate.

**Goal:** Close the independently reproduced inherited tenant lifecycle bypass: disabled organizations must not allow any boss entrypoint, including exact end replay.

**Architecture:** Extend the two existing boss authorization queries with an organization join constrained to `ACTIVE`. This makes authorization precede every read, creation, end and end replay, using the existing safe `ResourceNotFoundError` and the newly tested post-rollback DENIED audit writer. No other policy or interface changes.

**Tech stack:** Existing locked TypeScript/PGlite/Hono/Vitest workspace; no new dependencies.

**Spec:** `docs/PROJECT_CANON.md` tenant fail-closed rule; M5/M6 design section 9; independent review of candidate `c15d25e4bca10eee7591ef7d16cb1228c2ade423`. This amends the prior audit plan's no-authorization-query-change exclusion only for the active-organization predicate below.

## Reproduced evidence and scope

The independent reviewer used a fresh synthetic fixture, changed only `organizations.status` to `DISABLED`, and observed student boss read 200, teacher detail 200, end 200 and create 201, with SUCCEEDED audits. Both `getStudentProgress` and `requireTeacher` omit organization lifecycle checks on the candidate and baseline. This is inherited but blocks the current security gate. The failing review remains preserved; do not replace its score with the remediation score.

## File-level test-first steps

- Modify `services/api/test/m5-m6-audit-cases.ts`, already included by the existing full/integration/E2E commands.
- Modify only the SQL authorization predicates in `packages/db/src/gamification-repository.ts`.
- Update the implementer verification report, README and memory to record the inherited defect and correction; retain all failure evidence.

1. Add five real Hono → repositories → PGlite tests: disabled organization create (no active campaign), student aggregate, teacher detail, end of active campaign, exact replay of an ended campaign. Keep actor, org membership and class active to isolate the missing organization predicate.
2. Before disabling, create needed campaigns via the existing API and end once for the replay case. Capture complete campaign rows. Disable only the synthetic organization. Call the operation with the proper-role valid token. Require safe 404, one trace-correlated DENIED audit with the requested scope, and byte-equivalent campaign rows afterward. Existing success paths remain regression coverage.

```ts
await database.query("UPDATE organizations SET status='DISABLED' WHERE id=$1", [organization.id]);
const response = await request(path, validToken, body);
expect(response.status).toBe(404);
expect(await audits(response.headers.get('x-trace-id'))).toEqual([
  expect.objectContaining({ outcome: 'DENIED', action: expectedAction }),
]);
expect((await database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual(before);
```

3. RED: `corepack pnpm exec vitest run services/api/test/m5-m6.test.ts -t 'disabled organization'`. Observe 200/201 instead of 404 on the current built candidate; do not count a malformed fixture or build failure.
4. GREEN: add the following tenant-scoped join to both `requireTeacher` (via `c.organization_id`) and `getStudentProgress` (via `cm.organization_id`):

```sql
JOIN organizations o ON o.id=c.organization_id AND o.status='ACTIVE'
```

Use `cm.organization_id` for the student query. Preserve class/membership/role/ownership predicates. Do not fetch protected data or perform writes before the completed authorization check.

5. Rebuild dependencies and rerun all M5/M6 API and Rasa/boss repository tests. Run fresh `pnpm check`, integration, E2E, production audit, demo build, diff and credential-pattern checks. Record exact results.
6. Commit the fix with the preserved failed review. A different independent reviewer must inspect the entire baseline-to-fixed diff and repeat disabled-org probes plus relevant checks, score strictly greater than 85 and find no critical blocker. Only then use the existing CI-guarded PR/main/Git-triggered Vercel workflow.

## Safety and recovery

No migration, auth-provider change, UI, provider, Firebase, external AI or real data. No manual deployment. Disabled organizations intentionally lose all four boss capabilities, including idempotent replay; active organizations retain existing behavior. Rollback is a reviewed commit revert, but must not knowingly re-enable the reproduced bypass. Audit evidence remains append-only. No new credential or paid resource is required.
