import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalAuthProvider } from '@lessonquest/auth';
import { createApp } from '../src/app.js';
import { createClassroomFixture } from '../../../packages/db/test/classroom-fixture.js';

let f: Awaited<ReturnType<typeof createClassroomFixture>>;
let app: ReturnType<typeof createApp>;
const origin = 'https://classrooms.lessonquest.test';
const token = (role: string) => `dev_${role.repeat(32)}`;
beforeEach(async () => {
  f = await createClassroomFixture();
  app = createApp({
    repository: f.tenants,
    learningRepository: f.learning,
    classroomRepository: f.classrooms,
    auth: new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [token('t'), f.teacher],
        [token('s'), f.student],
        [token('c'), f.colleague],
      ]),
    }),
    trustedOrigin: origin,
    diagnostics: { record() {} },
  });
});
afterEach(async () => {
  await f?.database.close();
});
const base = () => `/organizations/${f.organization.id}`;
const classPath = () => `${base()}/classes/${f.lessonClass.id}`;
const call = (path: string, role = 't', body?: unknown) =>
  app.request(`${origin}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token(role)}`, origin, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('classroom API', () => {
  it('crosses HTTP with strict responses, authenticated self-join and private dashboard', async () => {
    const list = await call(`${base()}/classes`);
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toContain('no-store');
    expect(await list.json()).toEqual([
      { id: f.lessonClass.id, organizationId: f.organization.id, name: '탐험 1반' },
    ]);
    const issued = await call(`${classPath()}/invitations`, 't', { maxUses: 1 });
    expect(issued.status).toBe(201);
    const { code, invitation } = (await issued.json()) as {
      code: string;
      invitation: { id: string };
    };
    const joined = await call(`${base()}/class-invitations/redeem`, 's', { code });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({ outcome: 'JOINED' });
    const detail = await call(`${classPath()}/dashboard`);
    expect(await detail.json()).toMatchObject({ memberCount: 1, invitation: { uses: 1 } });
    expect((await call(`${classPath()}/dashboard`, 's')).status).toBe(404);
    expect((await call(`${classPath()}/dashboard`, 'c')).status).toBe(404);
    expect((await call(`${classPath()}/invitations/${invitation.id}/revoke`, 't', {})).status).toBe(
      200,
    );
    const denied = await call(`${base()}/class-invitations/redeem`, 's', { code });
    expect(denied.status).toBe(404);
    const json = (await denied.json()) as { error: { traceId: string } };
    expect(
      (
        await f.database.query(
          "SELECT outcome FROM audit_logs WHERE trace_id=$1 AND action='CLASS_INVITATION_REDEEMED'",
          [json.error.traceId],
        )
      ).rows,
    ).toEqual([{ outcome: 'DENIED' }]);
    expect(JSON.stringify(json)).not.toContain(code);
  });

  it('applies authentication, Origin, JSON and strict input rules to every new route', async () => {
    const routes = [
      [`${base()}/classes`, 'GET'],
      [`${classPath()}/dashboard`, 'GET'],
      [`${classPath()}/invitations`, 'POST'],
      [`${classPath()}/invitations/${f.trace()}/revoke`, 'POST'],
      [`${base()}/class-invitations/redeem`, 'POST'],
    ] as const;
    for (const [path, method] of routes) {
      expect((await app.request(`${origin}${path}`, { method })).status).toBe(401);
      if (method === 'POST') {
        expect(
          (
            await app.request(`${origin}${path}`, {
              method,
              headers: { authorization: `Bearer ${token('t')}` },
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await app.request(`${origin}${path}`, {
              method,
              headers: { authorization: `Bearer ${token('t')}`, origin },
            })
          ).status,
        ).toBe(415);
      }
    }
    expect((await call(`${classPath()}/invitations`, 's', { maxUses: 1 })).status).toBe(404);
    expect(
      (await call(`${classPath()}/invitations`, 't', { maxUses: 1, role: 'ORG_ADMIN' })).status,
    ).toBe(400);
    expect((await call(`${base()}/class-invitations/redeem`, 's', { code: '123456' })).status).toBe(
      400,
    );
    await f.database.query("UPDATE users SET platform_role='STUDENT' WHERE id=$1", [
      f.teacher.userId,
    ]);
    expect((await call(`${base()}/classes`)).status).toBe(404);
    expect((await call(`${classPath()}/invitations`, 't', { maxUses: 1 })).status).toBe(404);
  });
});
