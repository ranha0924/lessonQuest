import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  LocalAuthConfigurationError,
  LocalAuthProvider,
} from '../src/local-auth.js';

const token = `dev_${'a'.repeat(32)}`;
const actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c701',
  platformRole: 'TEACHER',
  memberships: [],
} as const;

const createProvider = () =>
  new LocalAuthProvider({
    environment: 'test',
    sessions: new Map([[token, actor]]),
  });

describe('LocalAuthProvider', () => {
  it('resolves an opaque bearer token to a server-owned actor', () => {
    expect(createProvider().resolve(`Bearer ${token}`)).toEqual(actor);
  });

  it.each([undefined, '', 'Basic abc', 'Bearer attacker-role-ADMIN', `Bearer dev_short`])(
    'rejects a missing, malformed, or unknown credential: %s',
    (authorizationHeader) => {
      expect(() => createProvider().resolve(authorizationHeader)).toThrow(AuthenticationError);
    },
  );

  it('returns copies so request code cannot mutate the session registry', () => {
    const provider = createProvider();
    const first = provider.resolve(`Bearer ${token}`);
    first.memberships.push({
      organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c702',
      role: 'ORG_ADMIN',
    });

    expect(provider.resolve(`Bearer ${token}`).memberships).toEqual([]);
  });

  it('rejects malformed server session actors during construction', () => {
    expect(
      () =>
        new LocalAuthProvider({
          environment: 'test',
          sessions: new Map([[token, { ...actor, platformRole: 'OWNER' }]]),
        }),
    ).toThrow(LocalAuthConfigurationError);
  });

  it('refuses to initialize in production', () => {
    expect(
      () =>
        new LocalAuthProvider({
          environment: 'production',
          sessions: new Map([[token, actor]]),
        }),
    ).toThrow(LocalAuthConfigurationError);
  });
});
