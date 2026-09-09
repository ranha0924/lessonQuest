import { PGlite } from '@electric-sql/pglite';
import { FirebaseAuthProvider } from '@lessonquest/auth/firebase';
import {
  FirebaseIdentityRepository,
  initializeSchema,
  LearningRepository,
  TenantRepository,
} from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type ApiDiagnosticEvent } from '../src/app.js';

const projectId = 'lessonquest-test';
const userId = '018f72a4-cc52-7c5a-a6f9-8b21aa27d101';
const origin = 'https://play.lessonquest.test';
const token = 'synthetic.private.token';
describe('Firebase identity through real HTTP and SQL authorization', () => {
  let database: PGlite;
  let events: ApiDiagnosticEvent[];
  let verifier: { verifyIdToken: ReturnType<typeof vi.fn<() => Promise<unknown>>> };
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    await database.query(`INSERT INTO users(id,platform_role) VALUES ($1,'TEACHER')`, [userId]);
    await database.query(
      'INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)',
      [projectId, 'synthetic-uid', userId],
    );
    const now = Math.floor(Date.now() / 1000);
    verifier = {
      verifyIdToken: vi.fn<() => Promise<unknown>>().mockResolvedValue({
        uid: 'synthetic-uid',
        sub: 'synthetic-uid',
        aud: projectId,
        iss: `https://securetoken.google.com/${projectId}`,
        iat: now - 10,
        auth_time: now - 10,
        exp: now + 300,
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
        platformRole: 'SUPER_ADMIN',
      }),
    };
    events = [];
    app = createApp({
      auth: new FirebaseAuthProvider({
        projectId,
        verifier,
        identities: new FirebaseIdentityRepository(database),
      }),
      repository: new TenantRepository(database),
      learningRepository: new LearningRepository(database),
      trustedOrigin: origin,
      diagnostics: { record: (event) => events.push(event) },
    });
  });
  afterEach(async () => {
    await database.close();
  });
  function request() {
    return app.request('/organizations', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '합성 수업 연구실' }),
    });
  }
  it('creates with the approved database owner rather than token custom roles', async () => {
    expect((await request()).status).toBe(201);
    expect((await database.query('SELECT created_by FROM organizations')).rows).toEqual([
      { created_by: userId },
    ]);
    expect((await database.query('SELECT platform_role FROM users')).rows).toEqual([
      { platform_role: 'TEACHER' },
    ]);
  });
  it.each([
    'wrong-project',
    'unmapped',
    'disabled-identity',
    'disabled-user',
    'provider-secret',
  ] as const)('fails closed and writes no tenant for %s', async (reason) => {
    if (reason === 'wrong-project')
      await database.query('UPDATE firebase_identities SET project_id=$1', ['other-project']);
    if (reason === 'unmapped')
      await database.query('UPDATE firebase_identities SET uid=$1', ['other-uid']);
    if (reason === 'disabled-identity')
      await database.query(`UPDATE firebase_identities SET status='DISABLED'`);
    if (reason === 'disabled-user') await database.query(`UPDATE users SET status='DISABLED'`);
    if (reason === 'provider-secret')
      verifier.verifyIdToken.mockRejectedValueOnce(
        new Error('PRIVATE_KEY secret-provider-payload'),
      );
    const response = await request();
    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toContain('AUTHENTICATION_REQUIRED');
    expect(body).not.toContain('secret-provider-payload');
    expect(body).not.toContain(token);
    expect(JSON.stringify(events)).not.toContain('secret-provider-payload');
    expect(JSON.stringify(events)).not.toContain(token);
    expect(response.headers.get('x-trace-id')).toMatch(/^[a-f0-9-]{36}$/);
    expect((await database.query('SELECT id FROM organizations')).rows).toEqual([]);
    expect((await database.query('SELECT id FROM audit_logs')).rows).toEqual([]);
  });
  it('honors a current student role despite a signed SUPER_ADMIN custom claim', async () => {
    await database.query(`UPDATE users SET platform_role='STUDENT'`);
    expect((await request()).status).toBe(403);
    expect((await database.query('SELECT id FROM organizations')).rows).toEqual([]);
  });
});
