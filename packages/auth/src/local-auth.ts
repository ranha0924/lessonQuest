import { actorSchema, type Actor } from '@lessonquest/contracts';

const developmentTokenPattern = /^dev_[A-Za-z0-9_-]{32,128}$/;

export class AuthenticationError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthenticationError';
  }
}

export class LocalAuthConfigurationError extends Error {
  constructor() {
    super('Local authentication is not available in this environment');
    this.name = 'LocalAuthConfigurationError';
  }
}

export interface LocalAuthOptions {
  environment: 'development' | 'test' | 'production';
  sessions: ReadonlyMap<string, unknown>;
}

export class LocalAuthProvider {
  readonly #sessions = new Map<string, Actor>();

  constructor(options: LocalAuthOptions) {
    if (options.environment === 'production') {
      throw new LocalAuthConfigurationError();
    }

    for (const [token, actor] of options.sessions) {
      if (!developmentTokenPattern.test(token)) {
        throw new LocalAuthConfigurationError();
      }

      const parsedActor = actorSchema.safeParse(actor);
      if (!parsedActor.success) {
        throw new LocalAuthConfigurationError();
      }
      this.#sessions.set(token, structuredClone(parsedActor.data));
    }
  }

  resolve(authorizationHeader: string | undefined): Actor {
    if (authorizationHeader === undefined) {
      throw new AuthenticationError();
    }

    const match = /^Bearer (dev_[A-Za-z0-9_-]{32,128})$/.exec(authorizationHeader);
    if (match === null) {
      throw new AuthenticationError();
    }

    const token = match[1];
    const actor = token === undefined ? undefined : this.#sessions.get(token);
    if (actor === undefined) {
      throw new AuthenticationError();
    }

    return structuredClone(actor);
  }
}
