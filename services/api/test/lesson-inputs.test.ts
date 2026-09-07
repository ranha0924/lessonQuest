import { LocalAuthProvider } from '@lessonquest/auth';
import {
  lessonInputListSchema,
  lessonInputMutationResultSchema,
  lessonInputSchema,
  type CreateLessonInputInput,
} from '@lessonquest/contracts';
import { LearningRepository, LessonInputRepository, TenantRepository } from '@lessonquest/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLessonInputFixture } from '../../../packages/db/test/lesson-input-fixture.js';
import { createApp } from '../src/app.js';

const origin = 'https://studio.lessonquest.test';
const token = (subject: string) => `dev_${subject.repeat(32)}`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unknownOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa270901';
const unknownLessonInputId = '018f72a4-cc52-7c5a-a6f9-8b21aa270902';

const validCreate: CreateLessonInputInput = {
  mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270201',
  title: '힘과 운동 수업',
  gradeBand: 'middle1',
  learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
  learningObjectives: ['힘과 질량의 관계를 설명한다.', '실험 결과를 근거로 예측한다.'],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function expectSafeError(value: unknown, code?: string): void {
  const envelope = asRecord(value);
  expect(Object.keys(envelope)).toEqual(['error']);
  const error = asRecord(envelope['error']);
  expect(Object.keys(error).sort()).toEqual(['code', 'message', 'retryable', 'traceId'].sort());
  expect(error['code']).toEqual(code ?? expect.any(String));
  expect(error['message']).toEqual(expect.any(String));
  expect(error['retryable']).toEqual(expect.any(Boolean));
  expect(error['traceId']).toMatch(uuidPattern);
}

describe('lesson input API', () => {
  let f: Awaited<ReturnType<typeof createLessonInputFixture>>;
  let diagnosticEvents: Array<Record<string, unknown>>;

  function buildApp(maxBodyBytes?: number) {
    return createApp({
      repository: new TenantRepository(f.database),
      learningRepository: new LearningRepository(f.database),
      lessonInputRepository: new LessonInputRepository(f.database),
      auth: new LocalAuthProvider({
        environment: 'test',
        sessions: new Map([
          [token('t'), f.teacher],
          [token('o'), f.otherTeacher],
          [token('a'), f.admin],
          [token('s'), f.student],
        ]),
      }),
      trustedOrigin: origin,
      diagnostics: {
        record(event: unknown) {
          diagnosticEvents.push(asRecord(event));
        },
      },
      ...(maxBodyBytes === undefined ? {} : { maxBodyBytes }),
    });
  }

  function headers(role: string, contentType = 'application/json') {
    return {
      authorization: `Bearer ${token(role)}`,
      origin,
      'content-type': contentType,
    };
  }

  async function request(
    app: ReturnType<typeof createApp>,
    method: string,
    path: string,
    body?: unknown,
    role = 't',
  ) {
    return app.request(`${origin}${path}`, {
      method,
      headers: headers(role),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  beforeEach(async () => {
    f = await createLessonInputFixture();
    diagnosticEvents = [];
  });

  afterEach(async () => {
    await f.close();
  });

  it('creates idempotently, lists, reads, updates, and replays through strict contracts', async () => {
    const app = buildApp();
    const collection = `/organizations/${f.organization.id}/lesson-inputs`;
    const createdResponse = await request(app, 'POST', collection, validCreate);
    const created = lessonInputMutationResultSchema.parse(await createdResponse.json());

    expect(createdResponse.status).toBe(201);
    expect(createdResponse.headers.get('x-trace-id')).toMatch(uuidPattern);
    expect(createdResponse.headers.get('cache-control')).toContain('no-store');
    expect(created).toMatchObject({ duplicate: false, lessonInput: { revision: 1 } });

    const replayResponse = await request(app, 'POST', collection, validCreate);
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.headers.get('cache-control')).toContain('no-store');
    expect(lessonInputMutationResultSchema.parse(await replayResponse.json())).toEqual({
      lessonInput: created.lessonInput,
      duplicate: true,
    });

    const listResponse = await request(app, 'GET', collection);
    expect(listResponse.status).toBe(200);
    expect(listResponse.headers.get('cache-control')).toContain('no-store');
    expect(lessonInputListSchema.parse(await listResponse.json())).toEqual([
      {
        id: created.lessonInput.id,
        title: validCreate.title,
        gradeBand: validCreate.gradeBand,
        revision: 1,
        updatedAt: created.lessonInput.updatedAt,
      },
    ]);

    const detail = `${collection}/${created.lessonInput.id}`;
    const detailResponse = await request(app, 'GET', detail);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.headers.get('cache-control')).toContain('no-store');
    expect(lessonInputSchema.parse(await detailResponse.json())).toEqual(created.lessonInput);

    f.advance();
    const update = {
      ...validCreate,
      mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270202',
      expectedRevision: 1,
      title: '수정된 힘과 운동 수업',
    };
    const updateResponse = await request(app, 'PUT', detail, update);
    const updated = lessonInputMutationResultSchema.parse(await updateResponse.json());
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.headers.get('cache-control')).toContain('no-store');
    expect(updated).toMatchObject({
      duplicate: false,
      lessonInput: { revision: 2, title: '수정된 힘과 운동 수업' },
    });

    const updateReplay = await request(app, 'PUT', detail, update);
    expect(updateReplay.status).toBe(200);
    expect(updateReplay.headers.get('cache-control')).toContain('no-store');
    expect(lessonInputMutationResultSchema.parse(await updateReplay.json())).toEqual({
      lessonInput: updated.lessonInput,
      duplicate: true,
    });
  });

  it('preserves repository role boundaries for teacher administrators and platform administrators', async () => {
    const app = buildApp();
    const collection = `/organizations/${f.organization.id}/lesson-inputs`;
    const created = lessonInputMutationResultSchema.parse(
      await (await request(app, 'POST', collection, validCreate)).json(),
    );
    const detail = `${collection}/${created.lessonInput.id}`;

    const deniedCreate = await request(
      app,
      'POST',
      collection,
      { ...validCreate, mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270203' },
      'a',
    );
    expect(deniedCreate.status).toBe(404);
    expect(deniedCreate.headers.get('cache-control')).toContain('no-store');
    expectSafeError(await deniedCreate.json(), 'RESOURCE_NOT_FOUND');

    const adminRead = await request(app, 'GET', detail, undefined, 'a');
    expect(adminRead.status).toBe(200);
    expect(lessonInputSchema.parse(await adminRead.json())).toEqual(created.lessonInput);

    const adminUpdate = await request(
      app,
      'PUT',
      detail,
      {
        ...validCreate,
        mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270204',
        expectedRevision: 1,
        title: '관리자가 수정한 수업',
      },
      'a',
    );
    expect(adminUpdate.status).toBe(200);
    expect(lessonInputMutationResultSchema.parse(await adminUpdate.json())).toMatchObject({
      lessonInput: { revision: 2, title: '관리자가 수정한 수업' },
    });

    await f.database.query(
      "UPDATE organization_members SET role = 'ORG_ADMIN' WHERE organization_id = $1 AND user_id = $2",
      [f.organization.id, f.otherTeacher.userId],
    );
    const teacherAdminCreate = await request(
      app,
      'POST',
      collection,
      {
        ...validCreate,
        mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270205',
        title: '교사 기관관리자의 수업',
      },
      'o',
    );
    expect(teacherAdminCreate.status).toBe(201);
    expect(lessonInputMutationResultSchema.parse(await teacherAdminCreate.json())).toMatchObject({
      lessonInput: { ownerTeacherId: f.otherTeacher.userId },
    });
  });

  it('keeps every security and strict-validation failure safe, private, and uncached', async () => {
    const app = buildApp();
    const collection = `/organizations/${f.organization.id}/lesson-inputs`;
    const created = lessonInputMutationResultSchema.parse(
      await (await request(app, 'POST', collection, validCreate)).json(),
    );
    const detail = `${collection}/${created.lessonInput.id}`;
    const secretTitle = '절대 노출하면 안 되는 수업 제목';
    const secretContent = '절대 노출하면 안 되는 학습 본문';
    const secretObjective = '절대 노출하면 안 되는 독특한 학습목표';
    const invalidBody = {
      ...validCreate,
      title: secretTitle,
      learningContent: secretContent,
      learningObjectives: [secretObjective],
      role: 'ORG_ADMIN',
    };
    const cases = [
      app.request(`${origin}${collection}`, { method: 'GET' }),
      app.request(`${origin}${collection}`, {
        method: 'GET',
        headers: { authorization: 'Basic invalid' },
      }),
      app.request(`${origin}${collection}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token('x')}` },
      }),
      app.request(`${origin}${collection}`, {
        method: 'POST',
        headers: { ...headers('t'), origin: 'https://attacker.example' },
        body: JSON.stringify(validCreate),
      }),
      app.request(`${origin}${collection}`, {
        method: 'POST',
        headers: { ...headers('t'), 'content-type': 'text/plain' },
        body: JSON.stringify(validCreate),
      }),
      app.request(`${origin}${collection}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token('t')}`, origin },
        body: JSON.stringify(validCreate),
      }),
      app.request(`${origin}${collection}`, {
        method: 'POST',
        headers: headers('t'),
        body: JSON.stringify(invalidBody),
      }),
      request(app, 'GET', `/organizations/not-a-uuid/lesson-inputs`),
      request(app, 'GET', `${collection}/not-a-uuid`),
      request(app, 'GET', `${collection}/${unknownLessonInputId}`),
      request(app, 'GET', detail, undefined, 'o'),
      request(app, 'GET', detail, undefined, 's'),
      request(
        app,
        'GET',
        `/organizations/${f.otherOrganization.id}/lesson-inputs/${created.lessonInput.id}`,
      ),
      request(
        app,
        'GET',
        `/organizations/${unknownOrganizationId}/lesson-inputs/${created.lessonInput.id}`,
      ),
      request(app, 'PUT', detail, {
        ...validCreate,
        mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270206',
        expectedRevision: 2,
      }),
      request(app, 'POST', collection, { ...validCreate, title: '충돌 입력' }),
    ];
    const responses = await Promise.all(cases.map((response) => Promise.resolve(response)));
    const expectedStatuses = [
      401, 401, 401, 403, 415, 415, 400, 404, 404, 404, 404, 404, 404, 404, 409, 409,
    ];

    expect(responses.map((response) => response.status)).toEqual(expectedStatuses);
    for (const response of responses) {
      expect(response.headers.get('cache-control')).toContain('no-store');
      const value = (await response.json()) as unknown;
      expectSafeError(value);
      const serialized = JSON.stringify(value);
      expect(serialized).not.toContain(secretTitle);
      expect(serialized).not.toContain(secretContent);
      expect(serialized).not.toContain(secretObjective);
      expect(serialized).not.toContain(validCreate.learningContent);
    }
    const serializedDiagnostics = JSON.stringify(diagnosticEvents);
    expect(serializedDiagnostics).not.toContain(secretTitle);
    expect(serializedDiagnostics).not.toContain(secretContent);
    expect(serializedDiagnostics).not.toContain(secretObjective);
    expect(serializedDiagnostics).not.toContain(validCreate.learningContent);
    const serializedAudit = JSON.stringify(
      (await f.database.query('SELECT * FROM audit_logs ORDER BY occurred_at, id')).rows,
    );
    expect(serializedAudit).not.toContain(secretTitle);
    expect(serializedAudit).not.toContain(secretContent);
    expect(serializedAudit).not.toContain(secretObjective);
    expect(diagnosticEvents).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        organizationId: f.organization.id,
        resourceId: created.lessonInput.id,
        status: 404,
      }),
    );
  });

  it('allows PUT preflight only to advertise access to the exact trusted origin', async () => {
    const app = buildApp();
    const detail = `/organizations/${f.organization.id}/lesson-inputs/${unknownLessonInputId}`;
    const trusted = await app.request(`${origin}${detail}`, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'Authorization, Content-Type',
      },
    });
    const untrusted = await app.request(`${origin}${detail}`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://attacker.example',
        'access-control-request-method': 'PUT',
      },
    });

    expect(trusted.status).toBe(204);
    expect(trusted.headers.get('access-control-allow-origin')).toBe(origin);
    expect(trusted.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(trusted.headers.get('cache-control')).toContain('no-store');
    expect(untrusted.headers.get('access-control-allow-origin')).toBeNull();
    expect(untrusted.headers.get('cache-control')).toContain('no-store');
  });

  it('accepts maximum Korean and maximally JSON-escaped contract-valid lesson text', async () => {
    const app = buildApp();
    const collection = `/organizations/${f.organization.id}/lesson-inputs`;
    const korean = {
      ...validCreate,
      mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270207',
      learningContent: '가'.repeat(32_768),
      learningObjectives: Array.from({ length: 8 }, (_, index) =>
        `${index}${'목'.repeat(299)}`.slice(0, 300),
      ),
    };
    const escaped = {
      ...validCreate,
      mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270208',
      learningContent: '\u0001'.repeat(32_768),
      learningObjectives: Array.from({ length: 8 }, (_, index) =>
        String.fromCharCode(index + 1).repeat(300),
      ),
    };

    expect(new TextEncoder().encode(JSON.stringify(korean)).byteLength).toBeGreaterThan(64 * 1024);
    expect(new TextEncoder().encode(JSON.stringify(escaped)).byteLength).toBeGreaterThan(200_000);
    const koreanResponse = await request(app, 'POST', collection, korean);
    const escapedResponse = await request(app, 'POST', collection, escaped);

    expect(koreanResponse.status).toBe(201);
    expect(lessonInputMutationResultSchema.parse(await koreanResponse.json())).toMatchObject({
      lessonInput: { learningContent: korean.learningContent },
    });
    expect(escapedResponse.status).toBe(201);
    expect(lessonInputMutationResultSchema.parse(await escapedResponse.json())).toMatchObject({
      lessonInput: { learningContent: escaped.learningContent },
    });
  });

  it('rejects declared and streamed F01 bodies above 256 KiB', async () => {
    const app = buildApp();
    const collection = `/organizations/${f.organization.id}/lesson-inputs`;
    const oversized = JSON.stringify({ ...validCreate, learningContent: 'x'.repeat(270_000) });
    const declared = await app.request(`${origin}${collection}`, {
      method: 'POST',
      headers: {
        ...headers('t'),
        'content-length': String(new TextEncoder().encode(oversized).byteLength),
      },
      body: oversized,
    });
    const chunks = [new Uint8Array(140_000), new Uint8Array(140_000)];
    const streamedRequestInit: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: headers('t'),
      body: new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = chunks.shift();
          if (chunk === undefined) {
            controller.close();
          } else {
            controller.enqueue(chunk);
          }
        },
      }),
      duplex: 'half',
    };
    const streamedRequest = new Request(`${origin}${collection}`, streamedRequestInit);
    const streamed = await app.request(streamedRequest);

    expect(declared.status).toBe(413);
    expect(streamed.status).toBe(413);
    for (const response of [declared, streamed]) {
      expect(response.headers.get('cache-control')).toContain('no-store');
      expectSafeError(await response.json(), 'PAYLOAD_TOO_LARGE');
    }
  });

  it('retains the 64 KiB cap elsewhere and makes an explicit cap authoritative everywhere', async () => {
    const defaultApp = buildApp();
    const legacy = await defaultApp.request(`${origin}/organizations`, {
      method: 'POST',
      headers: headers('t'),
      body: JSON.stringify({ name: '가'.repeat(70_000) }),
    });
    expect(legacy.status).toBe(413);

    const explicitApp = buildApp(1_024);
    const f01 = await explicitApp.request(
      `${origin}/organizations/${f.organization.id}/lesson-inputs`,
      {
        method: 'POST',
        headers: headers('t'),
        body: JSON.stringify({ ...validCreate, learningContent: '가'.repeat(500) }),
      },
    );
    const explicitLegacy = await explicitApp.request(`${origin}/organizations`, {
      method: 'POST',
      headers: headers('t'),
      body: JSON.stringify({ name: '가'.repeat(500) }),
    });

    expect(f01.status).toBe(413);
    expect(f01.headers.get('cache-control')).toContain('no-store');
    expect(explicitLegacy.status).toBe(413);
  });
});
