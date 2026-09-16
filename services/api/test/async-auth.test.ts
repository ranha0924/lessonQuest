import { PGlite } from '@electric-sql/pglite';
import { AuthenticationError } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import { initializeSchema, LearningRepository, TenantRepository } from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiDiagnosticEvent } from '../src/app.js';

const trustedOrigin = 'https://play.lessonquest.test';
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d101',
  platformRole: 'TEACHER',
  memberships: [],
};
const otherTeacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d102',
  platformRole: 'TEACHER',
  memberships: [],
};

describe('asynchronous API authentication', () => {
  let database: PGlite;
  let repository: TenantRepository;
  let learningRepository: LearningRepository;
  let events: ApiDiagnosticEvent[];

  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    repository = new TenantRepository(database);
    learningRepository = new LearningRepository(database);
    await repository.upsertUser(teacher);
    await repository.upsertUser(otherTeacher);
    events = [];
  });

  afterEach(async () => {
    await database.close();
  });

  function buildApp(auth: { resolve(header: string | undefined): Promise<Actor> }) {
    return createApp({
      auth,
      repository,
      learningRepository,
      trustedOrigin,
      diagnostics: { record: (event) => events.push(event) },
    });
  }

  function createRequest(app: ReturnType<typeof createApp>, token: string, name: string) {
    return app.request('/organizations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        origin: trustedOrigin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
  }

  it('performs no tenant write while verification is pending, then uses the resolved owner', async () => {
    const verification = Promise.withResolvers<Actor>();
    const entered = Promise.withResolvers<void>();
    const app = buildApp({
      resolve: () => {
        entered.resolve();
        return verification.promise;
      },
    });
    const pending = createRequest(app, 'synthetic-first', '과학 수업');
    await entered.promise;
    expect((await database.query('SELECT id FROM organizations')).rows).toEqual([]);
    expect((await database.query('SELECT id FROM audit_logs')).rows).toEqual([]);

    verification.resolve(teacher);
    const response = await pending;
    expect(response.status).toBe(201);
    expect((await database.query('SELECT name, created_by FROM organizations')).rows).toEqual([
      { name: '과학 수업', created_by: teacher.userId },
    ]);
    expect(events).toEqual([]);
  });

  it('returns a safe 401 for a rejected verifier and creates no tenant or audit', async () => {
    const verification = Promise.withResolvers<Actor>();
    const entered = Promise.withResolvers<void>();
    // Keep pre-await RED from causing a process-level unhandled rejection.
    void verification.promise.catch(() => undefined);
    const app = buildApp({
      resolve: () => {
        entered.resolve();
        return verification.promise;
      },
    });
    const pending = createRequest(app, 'synthetic-private-token', '실패한 요청');
    await entered.promise;
    verification.reject(new AuthenticationError());

    const response = await pending;
    expect(response.status).toBe(401);
    const traceId = response.headers.get('x-trace-id');
    expect(traceId).toMatch(/^[a-f0-9-]{36}$/);
    expect(await response.json()).toEqual({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '로그인이 필요합니다.',
        retryable: false,
        traceId,
      },
    });
    expect((await database.query('SELECT id FROM organizations')).rows).toEqual([]);
    expect((await database.query('SELECT id FROM audit_logs')).rows).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ code: 'AUTHENTICATION_REQUIRED', status: 401 });
    expect(JSON.stringify(events)).not.toContain('synthetic-private-token');
  });

  it('keeps each actor scoped to its request when concurrent verifications finish in reverse order', async () => {
    const first = Promise.withResolvers<Actor>();
    const second = Promise.withResolvers<Actor>();
    const firstEntered = Promise.withResolvers<void>();
    const secondEntered = Promise.withResolvers<void>();
    const app = buildApp({
      resolve: (header) => {
        if (header === 'Bearer synthetic-first') {
          firstEntered.resolve();
          return first.promise;
        }
        if (header === 'Bearer synthetic-second') {
          secondEntered.resolve();
          return second.promise;
        }
        throw new AuthenticationError();
      },
    });

    const firstRequest = createRequest(app, 'synthetic-first', '먼저 시작');
    const secondRequest = createRequest(app, 'synthetic-second', '먼저 완료');
    await Promise.all([firstEntered.promise, secondEntered.promise]);
    second.resolve(otherTeacher);
    expect((await secondRequest).status).toBe(201);
    first.resolve(teacher);
    expect((await firstRequest).status).toBe(201);

    expect(
      (await database.query('SELECT name, created_by FROM organizations ORDER BY name')).rows,
    ).toEqual([
      { name: '먼저 시작', created_by: teacher.userId },
      { name: '먼저 완료', created_by: otherTeacher.userId },
    ]);
    expect(events).toEqual([]);
  });
});
