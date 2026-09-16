import { randomUUID } from 'node:crypto';

import { LocalAuthProvider } from '@lessonquest/auth';
import { LearningRepository, LessonInputRepository, TenantRepository } from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import type { createApp } from '../src/app.js';

import { createLessonInputFixture } from '../../../packages/db/test/lesson-input-fixture.js';

const origin = 'https://studio.lessonquest.test';
const token = (role: string) => `dev_${role.repeat(32)}`;
const requestBody = () => ({ mutationId: randomUUID(), expectedRevision: 1 });

describe('AI generation is denied until billing is implemented', () => {
  let fixture: Awaited<ReturnType<typeof createLessonInputFixture>>;
  let app: ReturnType<typeof createApp>;
  let path: string;
  let lessonInputId: string;
  let externalFetch: MockInstance<typeof fetch>;

  beforeEach(async () => {
    // Set before importing/constructing the API. This is deliberately not a real key.
    vi.stubEnv('OPENAI_API_KEY', 'synthetic-key-must-not-enable-generation');
    vi.stubEnv('AI_ENABLED', 'true');
    fixture = await createLessonInputFixture();
    const saved = await fixture.inputs.create(fixture.teacher, fixture.organization.id, {
      mutationId: randomUUID(),
      title: '비공개 합성 수업',
      gradeBand: 'middle1',
      learningContent: '합성 자료로 힘과 질량의 관계를 비교한다.',
      learningObjectives: ['힘과 질량의 관계를 설명한다.'],
    });
    lessonInputId = saved.lessonInput.id;
    path = `/organizations/${fixture.organization.id}/lesson-inputs/${lessonInputId}/generations`;
    externalFetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected external request'));
    const { createApp } = await import('../src/app.js');
    app = createApp({
      repository: new TenantRepository(fixture.database),
      learningRepository: new LearningRepository(fixture.database),
      lessonInputRepository: new LessonInputRepository(fixture.database),
      auth: new LocalAuthProvider({
        environment: 'test',
        sessions: new Map([
          [token('t'), fixture.teacher],
          [token('a'), fixture.admin],
          [token('s'), fixture.student],
        ]),
      }),
      trustedOrigin: origin,
      diagnostics: { record() {} },
    });
  });
  afterEach(async () => {
    try {
      expect(externalFetch).not.toHaveBeenCalled();
      expect((await fixture.database.query('SELECT revision FROM lesson_inputs')).rows).toEqual([
        { revision: 1 },
      ]);
      expect(
        (await fixture.database.query('SELECT mutation_id FROM lesson_input_mutations')).rows,
      ).toHaveLength(1);
      expect((await fixture.database.query('SELECT id FROM experiences')).rows).toEqual([]);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      await fixture.close();
    }
  });
  function request(
    options: {
      role?: string;
      body?: unknown;
      headers?: Record<string, string>;
      target?: string;
    } = {},
  ) {
    return app.request(`${origin}${options.target ?? path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token(options.role ?? 't')}`,
        origin,
        'content-type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body ?? requestBody()),
    });
  }

  it.each(['t', 'a'])(
    'denies approved account %s even when a server key and enable flag exist',
    async (role) => {
      const response = await request({ role });
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.json()).toEqual({
        error: {
          code: 'AI_BILLING_NOT_CONFIGURED',
          message: 'AI 생성은 결제 연동이 준비된 뒤 이용할 수 있습니다.',
          retryable: false,
          traceId: response.headers.get('x-trace-id'),
        },
      });
      expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
  it.each(['', 'Bearer forged', `Bearer ${token('x')}`])(
    'rejects absent or forged credentials %#',
    async (authorization) => {
      const response = await request({ headers: { authorization } });
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toContain('no-store');
    },
  );
  it('does not disclose cross-tenant input data', async () => {
    const response = await request({
      target: `/organizations/${fixture.otherOrganization.id}/lesson-inputs/${lessonInputId}/generations`,
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('비공개 합성 수업');
  });
  it.each(['student', 'disabled', 'downgraded'])(
    'checks current access for %s before the billing response',
    async (kind) => {
      if (kind === 'disabled')
        await fixture.database.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
          fixture.teacher.userId,
        ]);
      if (kind === 'downgraded')
        await fixture.database.query("UPDATE users SET platform_role='STUDENT' WHERE id=$1", [
          fixture.teacher.userId,
        ]);
      expect((await request({ role: kind === 'student' ? 's' : 't' })).status).toBe(404);
    },
  );
  it.each([
    { paid: true },
    { role: 'SUPER_ADMIN' },
    { provider: 'openai' },
    { apiKey: 'synthetic-client-key' },
    { paymentStatus: 'succeeded' },
  ])('rejects client bypass fields %#', async (extra) => {
    expect((await request({ body: { ...requestBody(), ...extra } })).status).toBe(400);
  });
  it('keeps origin, content-type and body limits enforced', async () => {
    expect((await request({ headers: { origin: 'https://untrusted.example' } })).status).toBe(403);
    expect((await request({ headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await request({ body: { text: 'x'.repeat(70_000) } })).status).toBe(413);
  });
  it('does not accept a forged billing success callback', async () => {
    expect((await request({ target: '/billing/success', body: { paid: true } })).status).toBe(404);
    expect((await request()).status).toBe(403);
  });
});
