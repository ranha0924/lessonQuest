import type * as postgres from '@lessonquest/db/postgres';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  close: vi.fn(() => Promise.resolve()),
  readiness: vi.fn(() => Promise.resolve()),
  constructed: vi.fn(),
  auth: vi.fn(() => ({ resolve: vi.fn(), close: vi.fn(() => Promise.resolve()) })),
  query: vi.fn(() => Promise.reject(new Error('unexpected query'))),
  exec: vi.fn(() => Promise.reject(new Error('DDL forbidden'))),
}));
vi.mock('@lessonquest/db/postgres', async (original) => {
  const actual = await original<typeof postgres>();
  return {
    ...actual,
    PostgresDatabase: class {
      constructor(options: unknown) {
        state.constructed(options);
      }
      query = state.query;
      exec = state.exec;
      close = state.close;
    },
  };
});
vi.mock('@lessonquest/db/runtime-readiness', () => ({ requireRuntimeReadiness: state.readiness }));
vi.mock('@lessonquest/auth/firebase', () => ({ createFirebaseAuthProvider: state.auth }));
import { createProductionRuntime } from '../src/server-runtime.js';
const key = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
beforeEach(() => {
  vi.clearAllMocks();
  state.readiness.mockResolvedValue(undefined);
  vi.stubEnv('LESSONQUEST_FIREBASE_PROJECT_ID', 'lessonquest-df4b0');
  vi.stubEnv('LESSONQUEST_TRUSTED_ORIGIN', 'https://lessonquest.test');
  vi.stubEnv(
    'LESSONQUEST_DATABASE_URL',
    'postgres://lq_app:synthetic@ep-test.neon.tech/lessonquest?sslmode=require',
  );
  vi.stubEnv(
    'LESSONQUEST_FIREBASE_SERVICE_ACCOUNT_JSON',
    JSON.stringify({
      type: 'service_account',
      project_id: 'lessonquest-df4b0',
      client_email: 'runtime@lessonquest-df4b0.iam.gserviceaccount.com',
      private_key: key,
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('constructs only restricted-schema runtime, checks readiness before auth and never performs startup DDL or network work', async () => {
  const network = vi.fn(() => Promise.reject(new Error('network forbidden')));
  vi.stubGlobal('fetch', network);
  const runtime = await createProductionRuntime();
  expect(state.constructed).toHaveBeenCalledWith(
    expect.objectContaining({ schema: 'lessonquest' }),
  );
  expect(state.readiness).toHaveBeenCalledTimes(1);
  expect(state.auth.mock.invocationCallOrder[0]).toBeGreaterThan(
    state.readiness.mock.invocationCallOrder[0]!,
  );
  const health = await runtime.fetch(new Request('https://lessonquest.test/health'));
  expect(health.status).toBe(200);
  expect(state.exec).not.toHaveBeenCalled();
  expect(state.query).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
  await runtime.close();
  expect(state.close).toHaveBeenCalledTimes(1);
});
it('closes pool on readiness failure before constructing auth; missing config creates no pool', async () => {
  state.readiness.mockRejectedValueOnce(new Error('raw secret SQL'));
  await expect(createProductionRuntime()).rejects.toThrow('Server is unavailable');
  expect(state.close).toHaveBeenCalledTimes(1);
  expect(state.auth).not.toHaveBeenCalled();
  vi.stubEnv('LESSONQUEST_DATABASE_URL', undefined);
  await expect(createProductionRuntime()).rejects.toThrow('Server configuration is unavailable');
  expect(state.constructed).toHaveBeenCalledTimes(1);
});
