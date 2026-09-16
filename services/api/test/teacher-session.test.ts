import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import { teacherSessionSchema } from '../../../packages/contracts/src/teacher-session.js';
import { initializeSchema, TenantRepository, LearningRepository } from '@lessonquest/db';
import { TeacherSessionRepository } from '@lessonquest/db';
import { createApp } from '../src/app.js';
const actor: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d101',
  platformRole: 'TEACHER',
  memberships: [],
};
const token = `dev_${'t'.repeat(32)}`;
let db: PGlite;
let tenants: TenantRepository;
let sessions: TeacherSessionRepository;
beforeEach(async () => {
  db = new PGlite();
  await initializeSchema(db);
  tenants = new TenantRepository(db);
  await tenants.upsertUser(actor);
  sessions = new TeacherSessionRepository(db);
});
afterEach(async () => {
  await db.close();
});
it('returns only currently approved teacher spaces, ignoring actor memberships', async () => {
  const org = await tenants.createOrganization(actor, '승인된 수업 공간');
  expect(await sessions.get(actor)).toEqual({
    userId: actor.userId,
    organizations: [{ id: org.id, name: org.name }],
    aiGeneration: 'AI_BILLING_NOT_CONFIGURED',
  });
  await db.query("UPDATE organization_members SET status='DISABLED' WHERE user_id=$1", [
    actor.userId,
  ]);
  expect((await sessions.get(actor)).organizations).toEqual([]);
  await db.query("UPDATE organization_members SET status='ACTIVE' WHERE user_id=$1", [
    actor.userId,
  ]);
  await db.query("UPDATE organizations SET status='DISABLED' WHERE id=$1", [org.id]);
  expect((await sessions.get(actor)).organizations).toEqual([]);
});
it('refuses unknown, disabled and downgraded users even with a stale teacher actor', async () => {
  await expect(
    sessions.get({ ...actor, userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d102' }),
  ).rejects.toThrow();
  await db.query("UPDATE users SET status='DISABLED' WHERE id=$1", [actor.userId]);
  await expect(sessions.get(actor)).rejects.toThrow();
  await db.query("UPDATE users SET status='ACTIVE',platform_role='STUDENT' WHERE id=$1", [
    actor.userId,
  ]);
  await expect(sessions.get(actor)).rejects.toThrow();
});
it('uses authenticated session routing, safe no-store errors, no extra identity data', async () => {
  const app = createApp({
    auth: new LocalAuthProvider({ environment: 'test', sessions: new Map([[token, actor]]) }),
    repository: tenants,
    learningRepository: new LearningRepository(db),
    teacherSessionRepository: sessions,
    trustedOrigin: 'https://lessonquest.test',
    diagnostics: { record() {} },
  });
  const anonymous = await app.request('/session');
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get('cache-control')).toBe('no-store');
  const response = await app.request('/session', { headers: { authorization: `Bearer ${token}` } });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(teacherSessionSchema.parse(await response.json())).toEqual({
    userId: actor.userId,
    organizations: [],
    aiGeneration: 'AI_BILLING_NOT_CONFIGURED',
  });
});
it('strict contract refuses paid overrides, duplicate spaces, oversized lists and profile fields', () => {
  const good = {
    userId: actor.userId,
    organizations: [],
    aiGeneration: 'AI_BILLING_NOT_CONFIGURED',
  };
  expect(teacherSessionSchema.safeParse(good).success).toBe(true);
  for (const value of [
    { ...good, paid: true },
    { ...good, aiGeneration: 'ENABLED' },
    { ...good, email: 'synthetic@test.invalid' },
    { ...good, organizations: Array(101).fill({ id: actor.userId, name: 'space' }) },
    {
      ...good,
      organizations: [
        { id: actor.userId, name: 'a' },
        { id: actor.userId, name: 'b' },
      ],
    },
  ])
    expect(teacherSessionSchema.safeParse(value).success).toBe(false);
});
