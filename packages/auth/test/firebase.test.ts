import { getApps, type Credential } from 'firebase-admin/app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@lessonquest/contracts';

import { AuthenticationError } from '../src/local-auth.js';
import {
  createFirebaseAuthProvider,
  FirebaseAuthConfigurationError,
  FirebaseAuthProvider,
} from '../src/firebase.js';

const projectId = 'lessonquest-test';
const header = 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln';
const actor: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d101',
  platformRole: 'TEACHER',
  memberships: [],
};
function claims() {
  const now = Math.floor(Date.now() / 1000);
  return {
    uid: 'synthetic-google-uid',
    sub: 'synthetic-google-uid',
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    iat: now - 60,
    auth_time: now - 120,
    exp: now + 3600,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
  };
}
function fixture(decoded: unknown = claims()) {
  const verifier = { verifyIdToken: vi.fn<() => Promise<unknown>>().mockResolvedValue(decoded) };
  const identities = { findActor: vi.fn<() => Promise<Actor | null>>().mockResolvedValue(actor) };
  return {
    verifier,
    identities,
    provider: new FirebaseAuthProvider({ projectId, verifier, identities, timeoutMs: 1000 }),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Firebase server identity boundary', () => {
  it('checks revocation and uses only project plus verified uid for current server authority', async () => {
    const { provider, verifier, identities } = fixture({
      ...claims(),
      platformRole: 'SUPER_ADMIN',
      memberships: [{ organizationId: 'foreign', role: 'ORG_ADMIN' }],
    });
    expect(await provider.resolve(header)).toEqual(actor);
    expect(verifier.verifyIdToken).toHaveBeenCalledWith(header.slice(7), true);
    expect(identities.findActor).toHaveBeenCalledWith(projectId, 'synthetic-google-uid');
    identities.findActor.mockResolvedValueOnce({ ...actor, platformRole: 'STUDENT' });
    expect((await provider.resolve(header)).platformRole).toBe('STUDENT');
    const copy = await provider.resolve(header);
    copy.platformRole = 'SUPER_ADMIN';
    expect((await provider.resolve(header)).platformRole).toBe('TEACHER');
  });

  it.each([
    undefined,
    '',
    'bearer a.b.c',
    'Bearer dev_abcdef',
    'Bearer a.b.',
    'Bearer a.b.c\n',
    'Bearer a.b.c\u2028',
    `Bearer ${'a'.repeat(16384)}.b.c`,
  ])('rejects malformed header without SDK or DB work: %s', async (value) => {
    const { provider, verifier, identities } = fixture();
    await expect(provider.resolve(value)).rejects.toBeInstanceOf(AuthenticationError);
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
    expect(identities.findActor).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { ...claims(), aud: 'other-project' },
    { ...claims(), iss: 'https://attacker.test' },
    { ...claims(), uid: 'other-uid' },
    { ...claims(), sub: '' },
    { ...claims(), uid: 'bad\nuid', sub: 'bad\nuid' },
    { ...claims(), uid: 'bad\n', sub: 'bad\n' },
    { ...claims(), exp: 1 },
    { ...claims(), iat: Date.now() },
    { ...claims(), auth_time: Date.now() },
    { ...claims(), exp: Infinity },
    { ...claims(), email_verified: false },
    { ...claims(), firebase: { sign_in_provider: 'password' } },
    { ...claims(), firebase: { sign_in_provider: 'google.com', tenant: 'foreign' } },
  ])('rejects invalid verified claims without identity lookup (%#)', async (value) => {
    const { provider, identities } = fixture(value);
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    expect(identities.findActor).not.toHaveBeenCalled();
  });

  it('rejects unapproved or malformed server identities', async () => {
    const { provider, identities } = fixture();
    identities.findActor.mockResolvedValueOnce(null);
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    identities.findActor.mockResolvedValueOnce({ ...actor, userId: 'invalid' });
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it.each(['verifier', 'identities'] as const)(
    'discards secret-bearing %s errors',
    async (source) => {
      const value = fixture();
      const error = new Error('PRIVATE_KEY synthetic-private-key token-secret upstream-body');
      if (source === 'verifier') value.verifier.verifyIdToken.mockRejectedValueOnce(error);
      else value.identities.findActor.mockRejectedValueOnce(error);
      await expect(value.provider.resolve(header)).rejects.toEqual(new AuthenticationError());
      try {
        if (source === 'verifier') value.verifier.verifyIdToken.mockRejectedValueOnce(error);
        else value.identities.findActor.mockRejectedValueOnce(error);
        await value.provider.resolve(header);
      } catch (caught) {
        expect(String(caught)).not.toContain('secret');
        expect(caught).not.toHaveProperty('cause');
      }
    },
  );

  it('expires verification without a late identity lookup', async () => {
    vi.useFakeTimers();
    const { provider, verifier, identities } = fixture();
    const pending = Promise.withResolvers<unknown>();
    verifier.verifyIdToken.mockReturnValueOnce(pending.promise);
    const result = expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    pending.resolve(claims());
    await vi.advanceTimersByTimeAsync(0);
    expect(identities.findActor).not.toHaveBeenCalled();
    expect(await provider.resolve(header)).toEqual(actor);
  });

  it('bounds underlying requests even after timeout and recovers when they settle', async () => {
    vi.useFakeTimers();
    const { provider, verifier, identities } = fixture();
    const pending = Promise.withResolvers<unknown>();
    verifier.verifyIdToken.mockReturnValue(pending.promise);
    const requests = Array.from({ length: 16 }, () =>
      expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(requests);
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    expect(verifier.verifyIdToken).toHaveBeenCalledTimes(16);
    pending.resolve(claims());
    await vi.advanceTimersByTimeAsync(0);
    expect(identities.findActor).not.toHaveBeenCalled();
    expect(await provider.resolve(header)).toEqual(actor);
  });

  it('times out stalled identity reads without accepting a late actor', async () => {
    vi.useFakeTimers();
    const { provider, identities } = fixture();
    const pending = Promise.withResolvers<Actor | null>();
    identities.findActor.mockReturnValueOnce(pending.promise);
    const result = expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    pending.resolve(actor);
    await vi.advanceTimersByTimeAsync(0);
    expect(await provider.resolve(header)).toEqual(actor);
  });

  it('rejects emulator configuration at construction and after construction', async () => {
    const { provider, verifier } = fixture();
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', 'localhost:9099');
    expect(() => fixture()).toThrow(FirebaseAuthConfigurationError);
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    { projectId: 'lessonquest-test\n' },
    { projectId: undefined as unknown as string },
    { projectId: '' },
    { projectId: 'other/project' },
    { timeoutMs: 0 },
    { timeoutMs: 30001 },
    { timeoutMs: NaN },
  ])('fails closed on invalid server configuration %j', (invalid) => {
    const { verifier, identities } = fixture();
    expect(() => new FirebaseAuthProvider({ projectId, verifier, identities, ...invalid })).toThrow(
      FirebaseAuthConfigurationError,
    );
  });

  it('owns an explicitly configured real Admin app, rejects invalid JWT through SDK, and disposes only that app', async () => {
    const before = getApps().map((app) => app.name);
    const getAccessToken = vi
      .fn<Credential['getAccessToken']>()
      .mockResolvedValue({ access_token: 'synthetic-unused', expires_in: 3600 });
    const credential: Credential = { getAccessToken };
    const identities = { findActor: vi.fn<() => Promise<Actor>>().mockResolvedValue(actor) };
    const provider = createFirebaseAuthProvider({ projectId, credential, identities });
    try {
      const app = getApps().find((app) => !before.includes(app.name));
      expect(app?.options.projectId).toBe(projectId);
      expect(app?.options.credential).toEqual(credential);
      await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
      expect(getAccessToken).not.toHaveBeenCalled();
      expect(identities.findActor).not.toHaveBeenCalled();
    } finally {
      await provider.close();
    }
    expect(getApps().map((app) => app.name)).toEqual(before);
    await expect(provider.resolve(header)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('never falls back to ambient credentials when explicit credentials are missing', () => {
    const before = getApps().map((app) => app.name);
    expect(() =>
      createFirebaseAuthProvider({
        projectId,
        identities: { findActor: () => Promise.resolve(null) },
        credential: undefined as unknown as Credential,
      }),
    ).toThrow(FirebaseAuthConfigurationError);
    expect(getApps().map((app) => app.name)).toEqual(before);
  });
});
