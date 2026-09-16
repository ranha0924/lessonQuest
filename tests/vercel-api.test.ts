import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { convertRewrites, type Rewrite } from '@vercel/routing-utils';
import { createServerHandler } from '../services/api/src/server-runtime.js';
import entry from '../api/index.js';
it('serves actual Vercel Fetch entry with safe unavailable response before configuration and no SPA fallback', async () => {
  vi.stubEnv('LESSONQUEST_DATABASE_URL', undefined);
  try {
    const response = await entry.fetch(
      new Request('https://web-phi-lyart-72.vercel.app/api/session'),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      (await entry.fetch(new Request('https://web-phi-lyart-72.vercel.app/api/admin'))).status,
    ).toBe(404);
  } finally {
    vi.unstubAllEnvs();
  }
});
it('routes API ahead of SPA and isolates live mode from the synthetic preview', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8')) as {
    rewrites: unknown[];
    buildCommand: string;
    headers: { headers: { key: string; value: string }[] }[];
  };
  expect(config.rewrites[0]).toEqual({ source: '/api/(.*)', destination: '/api' });
  expect(config.buildCommand).toContain('VITE_LIVE_MODE=true');
  expect(config.buildCommand).toContain('VITE_DEV_PREVIEW=false');
  expect(config.buildCommand).toContain('VITE_DEMO_MODE=false');
  const csp = config.headers[0]!.headers.find(
    (header: { key: string }) => header.key === 'Content-Security-Policy',
  )!.value;
  expect(csp).toContain('frame-src https://lessonquest-df4b0.firebaseapp.com');
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toContain('https://*');
});

it('uses the official Vercel converter without adding a query that blocks every live route', async () => {
  const configuration = JSON.parse(await readFile('vercel.json', 'utf8')) as {
    rewrites: Rewrite[];
  };
  const route = convertRewrites([configuration.rewrites[0]!])[0]!;
  if (!('src' in route) || !route.dest) throw new Error('Missing API rewrite');
  const origin = 'https://web-phi-lyart-72.vercel.app';
  const received: string[] = [];
  const handler = createServerHandler(() =>
    Promise.resolve({
      origin,
      fetch: (request) => {
        received.push(request.method + ' ' + new URL(request.url).pathname);
        return Promise.resolve(Response.json({ ok: true }));
      },
      close: () => Promise.resolve(),
    }),
  );
  const org = '018f72a4-cc52-7c5a-a6f9-8b21aa27d111',
    lesson = '018f72a4-cc52-7c5a-a6f9-8b21aa27d112';
  const cases = [
    ['GET', '/api/session'],
    ['GET', '/api/health'],
    ['GET', `/api/organizations/${org}/lesson-inputs`],
    ['POST', `/api/organizations/${org}/lesson-inputs`],
    ['GET', `/api/organizations/${org}/lesson-inputs/${lesson}`],
    ['PUT', `/api/organizations/${org}/lesson-inputs/${lesson}`],
    ['POST', `/api/organizations/${org}/lesson-inputs/${lesson}/generations`],
  ] as const;
  for (const [method, path] of cases) {
    const match = new RegExp(route.src).exec(path);
    expect(match).not.toBeNull();
    const target = new URL(
      route.dest.replace(/\$(\d+)/g, (_value, index: string) => match?.[Number(index)] ?? ''),
      origin,
    );
    const original = new URL(path, origin);
    target.searchParams.forEach((value, key) => original.searchParams.append(key, value));
    const result = await handler(
      new Request(original, {
        method,
        headers: { origin },
        ...(['POST', 'PUT'].includes(method) ? { body: '{}' } : {}),
      }),
    );
    expect(result.status, `${method} ${path} after Vercel conversion`).toBe(200);
  }
  expect(route.dest).toBe('/api');
  expect(received).toHaveLength(cases.length);
  expect((await handler(new Request(origin + '/api/session?path=health'))).status).toBe(404);
});
