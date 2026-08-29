import { PGlite } from '@electric-sql/pglite';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import { initializeSchema, LearningRepository, TenantRepository } from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

const trustedOrigin = 'https://play.lessonquest.test';
const teacherToken = `dev_${'t'.repeat(32)}`;
const otherTeacherToken = `dev_${'o'.repeat(32)}`;
const studentToken = `dev_${'s'.repeat(32)}`;

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
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d103',
  platformRole: 'STUDENT',
  memberships: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

async function readJson(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  return value;
}

function requestHeaders(token: string, origin = trustedOrigin): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    origin,
    'content-type': 'application/json',
  };
}

function expectSafeErrorEnvelope(value: unknown): void {
  const envelope = asRecord(value);
  expect(Object.keys(envelope)).toEqual(['error']);
  const error = asRecord(envelope['error']);
  expect(Object.keys(error).sort()).toEqual(['code', 'message', 'retryable', 'traceId'].sort());
  expect(error['code']).toEqual(expect.any(String));
  expect(error['message']).toEqual(expect.any(String));
  expect(error['retryable']).toEqual(expect.any(Boolean));
  expect(error['traceId']).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
}

describe('LessonQuest tenant API', () => {
  let database: PGlite;
  let repository: TenantRepository;
  let learningRepository: LearningRepository;
  let auth: LocalAuthProvider;
  let diagnosticEvents: Array<Record<string, unknown>>;
  let diagnostics: { record(event: unknown): void };

  function buildApp() {
    return createApp({ auth, repository, learningRepository, trustedOrigin, diagnostics });
  }

  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    repository = new TenantRepository(database);
    learningRepository = new LearningRepository(database);
    await repository.upsertUser(teacher);
    await repository.upsertUser(otherTeacher);
    await repository.upsertUser(student);
    auth = new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [teacherToken, teacher],
        [otherTeacherToken, otherTeacher],
        [studentToken, student],
      ]),
    });
    diagnosticEvents = [];
    diagnostics = {
      record(event: unknown) {
        diagnosticEvents.push(asRecord(event));
      },
    };
  });

  afterEach(async () => {
    await database.close();
  });

  it('serves public health with baseline security headers', async () => {
    const app = buildApp();
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ status: 'ok' });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('allows CORS only for the exact trusted origin and trusted preflight', async () => {
    const app = buildApp();
    const trusted = await app.request('/health', { headers: { origin: trustedOrigin } });
    const lookalike = await app.request('/health', {
      headers: { origin: `${trustedOrigin}.attacker.example` },
    });
    const preflight = await app.request('/organizations', {
      method: 'OPTIONS',
      headers: {
        origin: trustedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    });

    expect(trusted.headers.get('access-control-allow-origin')).toBe(trustedOrigin);
    expect(lookalike.headers.get('access-control-allow-origin')).toBeNull();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(trustedOrigin);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('rejects missing, malformed, and unknown credentials on every protected route pattern', async () => {
    const app = buildApp();
    const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27d199';
    const classId = '018f72a4-cc52-7c5a-a6f9-8b21aa27d198';
    const routes = [
      { method: 'POST', path: '/organizations' },
      { method: 'POST', path: `/organizations/${organizationId}/classes` },
      { method: 'POST', path: `/organizations/${organizationId}/classes/${classId}/members` },
      { method: 'GET', path: `/organizations/${organizationId}/classes/${classId}` },
      { method: 'POST', path: `/organizations/${organizationId}/experiences/science` },
      {
        method: 'POST',
        path: `/organizations/${organizationId}/experience-versions/${classId}/validate`,
      },
      {
        method: 'GET',
        path: `/organizations/${organizationId}/experience-versions/${classId}/preview`,
      },
      {
        method: 'POST',
        path: `/organizations/${organizationId}/experience-versions/${classId}/review`,
      },
      { method: 'POST', path: `/organizations/${organizationId}/classes/${classId}/assignments` },
      { method: 'GET', path: `/organizations/${organizationId}/student/assignments` },
      { method: 'POST', path: `/organizations/${organizationId}/assignments/${classId}/attempts` },
      { method: 'GET', path: `/organizations/${organizationId}/assignments/${classId}/player` },
      { method: 'POST', path: `/organizations/${organizationId}/learning-events` },
      {
        method: 'GET',
        path: `/organizations/${organizationId}/classes/${classId}/assignments/${classId}/progress`,
      },
    ] as const;
    const credentials = [
      undefined,
      'Basic attacker-controlled',
      `Bearer dev_${'x'.repeat(32)}`,
    ] as const;

    for (const route of routes) {
      for (const authorization of credentials) {
        const request: RequestInit =
          authorization === undefined
            ? { method: route.method }
            : { method: route.method, headers: { authorization } };
        const response = await app.request(route.path, request);
        expect(response.status).toBe(401);
        expectSafeErrorEnvelope(await readJson(response));
      }
    }
  });

  it('checks the exact origin before reading a malformed or oversized state-changing body', async () => {
    const app = buildApp();
    const response = await app.request('/organizations', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${teacherToken}`,
        'content-type': 'text/plain',
      },
      body: 'x'.repeat(9_000),
    });

    expect(response.status).toBe(403);
    const body = await readJson(response);
    expectSafeErrorEnvelope(body);
    expect(asRecord(asRecord(body)['error'])['code']).toBe('ORIGIN_FORBIDDEN');
  });

  it('rejects unsupported, malformed, unknown-field, and oversized JSON bodies', async () => {
    const app = buildApp();
    const unsupported = await app.request('/organizations', {
      method: 'POST',
      headers: { ...requestHeaders(teacherToken), 'content-type': 'text/plain' },
      body: '별빛중학교',
    });
    const malformed = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: '{',
    });
    const unknownField = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '별빛중학교', role: 'SUPER_ADMIN' }),
    });
    const oversized = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '가'.repeat(70_000) }),
    });

    expect(unsupported.status).toBe(415);
    expect(malformed.status).toBe(400);
    expect(unknownField.status).toBe(400);
    expect(oversized.status).toBe(413);
  });

  it('creates an organization and class, enrolls a synthetic student, and allows both to read', async () => {
    const app = buildApp();
    const organizationResponse = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '별빛중학교' }),
    });
    const organization = asRecord(await readJson(organizationResponse));
    const organizationId = organization['id'];
    expect(typeof organizationId).toBe('string');

    const classResponse = await app.request(`/organizations/${String(organizationId)}/classes`, {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '1학년 3반' }),
    });
    const lessonClass = asRecord(await readJson(classResponse));
    const classId = lessonClass['id'];
    expect(typeof classId).toBe('string');

    const enrollmentResponse = await app.request(
      `/organizations/${String(organizationId)}/classes/${String(classId)}/members`,
      {
        method: 'POST',
        headers: requestHeaders(teacherToken),
        body: JSON.stringify({ userId: student.userId }),
      },
    );
    const resourcePath = `/organizations/${String(organizationId)}/classes/${String(classId)}`;
    const teacherRead = await app.request(resourcePath, {
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const studentRead = await app.request(resourcePath, {
      headers: { authorization: `Bearer ${studentToken}` },
    });

    expect(organizationResponse.status).toBe(201);
    expect(classResponse.status).toBe(201);
    expect(enrollmentResponse.status).toBe(204);
    expect(teacherRead.status).toBe(200);
    expect(studentRead.status).toBe(200);
    await expect(readJson(studentRead)).resolves.toMatchObject({
      id: classId,
      organizationId,
      name: '1학년 3반',
    });
  });

  it('rejects ownership and role fields injected by a client', async () => {
    const app = buildApp();
    const marker = 'attacker-controlled-role';
    const response = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '공격 대상 기관', role: marker, ownerId: student.userId }),
    });
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(400);
    expectSafeErrorEnvelope(body);
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain(teacherToken);
    expect(serialized).not.toContain('공격 대상 기관');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('SELECT');
  });

  it('maps role denial and duplicate enrollment to safe 403 and 409 responses', async () => {
    const app = buildApp();
    const forbidden = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(studentToken),
      body: JSON.stringify({ name: '학생 기관' }),
    });

    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    await repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);
    const duplicate = await app.request(
      `/organizations/${organization.id}/classes/${lessonClass.id}/members`,
      {
        method: 'POST',
        headers: requestHeaders(teacherToken),
        body: JSON.stringify({ userId: student.userId }),
      },
    );

    expect(forbidden.status).toBe(403);
    expect(duplicate.status).toBe(409);
    expectSafeErrorEnvelope(await readJson(forbidden));
    expectSafeErrorEnvelope(await readJson(duplicate));
  });

  it('blocks a stale teacher session after the database role is downgraded to student', async () => {
    const app = buildApp();
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    await repository.upsertUser({ ...teacher, platformRole: 'STUDENT' });

    const response = await app.request(`/organizations/${organization.id}/classes`, {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: '권한이 남은 반' }),
    });

    expect(response.status).toBe(404);
    const body = await readJson(response);
    expectSafeErrorEnvelope(body);
    expect(asRecord(asRecord(body)['error'])['code']).toBe('RESOURCE_NOT_FOUND');
  });

  it('redacts an unexpected database failure from the internal error response', async () => {
    const app = buildApp();
    const marker = 'internal-database-marker';
    await database.exec('DROP TABLE organizations CASCADE');

    const response = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: marker }),
    });
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expectSafeErrorEnvelope(body);
    const error = asRecord(asRecord(body)['error']);
    const traceId = error['traceId'];
    expect(error['code']).toBe('INTERNAL_ERROR');
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain('organizations');
    expect(serialized).not.toContain('relation');
    expect(serialized).not.toContain('stack');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(diagnosticEvents).toHaveLength(1);
    expect(Object.keys(diagnosticEvents[0] ?? {}).sort()).toEqual(
      [
        'code',
        'durationMs',
        'method',
        'organizationId',
        'resourceId',
        'retryable',
        'status',
        'traceId',
        'type',
      ].sort(),
    );
    expect(diagnosticEvents[0]).toMatchObject({
      type: 'API_ERROR',
      traceId,
      code: 'INTERNAL_ERROR',
      status: 500,
      retryable: true,
      method: 'POST',
      organizationId: null,
      resourceId: null,
    });
    expect(diagnosticEvents[0]?.['durationMs']).toEqual(expect.any(Number));
    expect(JSON.stringify(diagnosticEvents)).not.toContain(marker);
    expect(JSON.stringify(diagnosticEvents)).not.toContain('organizations');
  });

  it('returns the same safe not-found shape for existing and nonexistent tenant resources', async () => {
    const app = buildApp();
    const organization = await repository.createOrganization(teacher, '비공개 기관');
    const lessonClass = await repository.createClass(teacher, organization.id, '비공개 반');
    const existing = await app.request(
      `/organizations/${organization.id}/classes/${lessonClass.id}`,
      { headers: { authorization: `Bearer ${otherTeacherToken}` } },
    );
    const nonexistent = await app.request(
      `/organizations/${organization.id}/classes/018f72a4-cc52-7c5a-a6f9-8b21aa27d197`,
      { headers: { authorization: `Bearer ${otherTeacherToken}` } },
    );
    const existingBody = await readJson(existing);
    const nonexistentBody = await readJson(nonexistent);

    expect(existing.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expectSafeErrorEnvelope(existingBody);
    expectSafeErrorEnvelope(nonexistentBody);
    const existingError = asRecord(asRecord(existingBody)['error']);
    const nonexistentError = asRecord(asRecord(nonexistentBody)['error']);
    expect({ ...existingError, traceId: undefined }).toEqual({
      ...nonexistentError,
      traceId: undefined,
    });
    expect(JSON.stringify(existingBody)).not.toContain('비공개');
    const existingAudit = await database.query<{ trace_id: string }>(
      "SELECT trace_id FROM audit_logs WHERE actor_user_id = $1 AND organization_id = $2 AND resource_id = $3 AND action = 'CLASS_READ' AND outcome = 'DENIED'",
      [otherTeacher.userId, organization.id, lessonClass.id],
    );
    expect(existingAudit.rows).toEqual([{ trace_id: existingError['traceId'] }]);
  });

  it('keeps the safe response when the diagnostic sink fails', async () => {
    const marker = 'diagnostic-sink-secret';
    const app = createApp({
      auth,
      repository,
      learningRepository,
      trustedOrigin,
      diagnostics: {
        record() {
          throw new Error(marker);
        },
      },
    });
    await database.exec('DROP TABLE organizations CASCADE');

    const response = await app.request('/organizations', {
      method: 'POST',
      headers: requestHeaders(teacherToken),
      body: JSON.stringify({ name: marker }),
    });
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expectSafeErrorEnvelope(body);
    expect(JSON.stringify(body)).not.toContain(marker);
  });

  it('rejects unsafe application configuration', () => {
    expect(() =>
      createApp({
        auth,
        repository,
        learningRepository,
        trustedOrigin: `${trustedOrigin}/path`,
        diagnostics,
      }),
    ).toThrow();
    expect(() =>
      createApp({
        auth,
        repository,
        learningRepository,
        trustedOrigin,
        diagnostics,
        maxBodyBytes: 0,
      }),
    ).toThrow();
  });
});
