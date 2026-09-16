import { generateKeyPairSync } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { readServerConfiguration } from '../src/server-config.js';
import { createServerHandler } from '../src/server-runtime.js';
const origin = 'https://web-phi-lyart-72.vercel.app';
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const valid = {
  LESSONQUEST_FIREBASE_PROJECT_ID: 'lessonquest-df4b0',
  LESSONQUEST_TRUSTED_ORIGIN: origin,
  LESSONQUEST_DATABASE_URL:
    'postgresql://lq_app:synthetic@ep-test.neon.tech/lessonquest?sslmode=require',
  LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: 'service_account',
    project_id: 'lessonquest-df4b0',
    client_email: 'runtime@lessonquest-df4b0.iam.gserviceaccount.com',
    private_key: privateKey,
    token_uri: 'https://untrusted.invalid',
  }),
};
it('validates dedicated config, projects, credentials and TLS without trusting credential URLs', () => {
  const config = readServerConfiguration(valid);
  expect(config.projectId).toBe('lessonquest-df4b0');
  expect(Object.keys(config.serviceAccount).sort()).toEqual([
    'clientEmail',
    'privateKey',
    'projectId',
  ]);
  for (const change of [
    { LESSONQUEST_FIREBASE_PROJECT_ID: 'other-project' },
    { LESSONQUEST_TRUSTED_ORIGIN: 'http://example.com' },
    { LESSONQUEST_TRUSTED_ORIGIN: origin + '/path' },
    { LESSONQUEST_DATABASE_URL: undefined, DATABASE_URL: valid.LESSONQUEST_DATABASE_URL },
    { LESSONQUEST_DATABASE_URL: 'postgres://a:b@localhost/db' },
    { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' },
    {
      LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON:
        valid.LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON.replaceAll(
          'lessonquest-df4b0',
          'other-project',
        ),
    },
    { LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON: 'private secret' },
  ])
    expect(() => readServerConfiguration({ ...valid, ...change })).toThrow(
      'Server configuration is unavailable',
    );
});
it('reads no OpenAI or owner fallback key', () => {
  const accessed: string[] = [];
  const environment = new Proxy(valid, {
    get(target, key) {
      accessed.push(String(key));
      if (String(key).includes('OPENAI') || key === 'DATABASE_URL')
        throw new Error('forbidden key');
      return Reflect.get(target, key) as string | undefined;
    },
  });
  readServerConfiguration(environment);
  expect(accessed).not.toContain('OPENAI_API_KEY');
});
it('single-flights initialization, preserves streaming body, origin, authorization and abort signal', async () => {
  let release!: () => void;
  const ready = new Promise<void>((r) => {
    release = r;
  });
  const forwarded: Request[] = [];
  const build = vi.fn(async () => {
    await ready;
    return {
      origin,
      fetch: async (req: Request) => {
        forwarded.push(req);
        return Response.json({
          path: new URL(req.url).pathname,
          body: await req.text(),
          auth: req.headers.get('authorization'),
        });
      },
      close: () => Promise.resolve(),
    };
  });
  const handler = createServerHandler(build);
  const abort = new AbortController();
  const path = '/api/organizations/018f72a4-cc52-7c5a-a6f9-8b21aa27d101/lesson-inputs';
  const first = handler(
    new Request(origin + path, {
      method: 'POST',
      body: '{"title":"수업"}',
      headers: { origin, authorization: 'Bearer synthetic' },
      signal: abort.signal,
    }),
  );
  const second = handler(new Request(origin + '/api/health'));
  release();
  const response = await first;
  await second;
  expect(build).toHaveBeenCalledTimes(1);
  expect(await response.json()).toMatchObject({
    path: path.slice(4),
    body: '{"title":"수업"}',
    auth: 'Bearer synthetic',
  });
  expect(response.headers.get('cache-control')).toBe('no-store');
  abort.abort();
  expect(forwarded[0]!.signal.aborted).toBe(true);
});
it('rejects unknown routes, methods and different request origins without trusting forwarding headers', async () => {
  const serve = vi.fn(() => Promise.resolve(Response.json({ ok: true })));
  const build = vi.fn(() =>
    Promise.resolve({ origin, fetch: serve, close: () => Promise.resolve() }),
  );
  const handler = createServerHandler(build);
  for (const path of [
    '/api/organizations',
    '/api/admin',
    '/api/session/',
    '/api/session?token=x',
    '/api/organizations/a/lesson-inputs',
    '/api/health/extra',
  ])
    expect((await handler(new Request(origin + path))).status).toBe(404);
  expect(build).not.toHaveBeenCalled();
  expect((await handler(new Request(origin + '/api/session', { method: 'POST' }))).status).toBe(
    404,
  );
  expect(
    (
      await handler(
        new Request('https://evil.invalid/api/session', {
          headers: { 'x-forwarded-host': new URL(origin).host },
        }),
      )
    ).status,
  ).toBe(403);
  expect(serve).not.toHaveBeenCalled();
});
it('returns safe unavailable errors with cooldown and never leaks raw configuration or SDK failures', async () => {
  const build = vi.fn(() => Promise.reject(new Error('PRIVATE KEY synthetic secret')));
  const handler = createServerHandler(build);
  for (let n = 0; n < 2; n++) {
    const r = await handler(new Request(origin + '/api/session'));
    expect(r.status).toBe(503);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = await r.text();
    expect(body).not.toContain('PRIVATE');
    expect((JSON.parse(body) as { error: { traceId: string } }).error.traceId).toMatch(
      /^[a-f0-9-]{36}$/,
    );
  }
  expect(build).toHaveBeenCalledTimes(1);
});
it('bounds pending initialization, retains its slot until settlement and closes late resources', async () => {
  vi.useFakeTimers();
  try {
    let complete!: (runtime: {
      origin: string;
      fetch: (request: Request) => Promise<Response>;
      close: () => Promise<void>;
    }) => void;
    const close = vi.fn(() => Promise.resolve());
    const build = vi.fn(
      () =>
        new Promise<{
          origin: string;
          fetch: (request: Request) => Promise<Response>;
          close: () => Promise<void>;
        }>((r) => {
          complete = r;
        }),
    );
    const handler = createServerHandler(build);
    const request = handler(new Request(origin + '/api/session'));
    await vi.advanceTimersByTimeAsync(30001);
    expect((await request).status).toBe(503);
    expect((await handler(new Request(origin + '/api/session'))).status).toBe(503);
    expect(build).toHaveBeenCalledTimes(1);
    complete({ origin, fetch: () => Promise.resolve(Response.json({})), close });
    await vi.advanceTimersByTimeAsync(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect((await handler(new Request(origin + '/api/session'))).status).toBe(503);
    expect(build).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
