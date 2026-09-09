import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type Credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { actorSchema, type Actor } from '@lessonquest/contracts';
import { AuthenticationError } from './local-auth.js';
import type { AuthProvider } from './provider.js';

export interface FirebaseIdentityStore {
  findActor(projectId: string, uid: string): Promise<Actor | null>;
}
export interface FirebaseTokenVerifier {
  verifyIdToken(token: string, checkRevoked: true): Promise<unknown>;
}
export interface FirebaseAuthOptions {
  projectId: string;
  verifier: FirebaseTokenVerifier;
  identities: FirebaseIdentityStore;
  timeoutMs?: number;
}
export class FirebaseAuthConfigurationError extends Error {
  constructor() {
    super('Firebase authentication configuration is invalid');
    this.name = 'FirebaseAuthConfigurationError';
  }
}
const projectPattern = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const uidPattern = /^[A-Za-z0-9:_-]{1,128}$/;
function validateOptions(options: Pick<FirebaseAuthOptions, 'projectId' | 'timeoutMs'>): number {
  const timeout = options.timeoutMs ?? 10_000;
  if (
    typeof options.projectId !== 'string' ||
    !projectPattern.test(options.projectId) ||
    !Number.isInteger(timeout) ||
    timeout < 1000 ||
    timeout > 30_000 ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined
  ) {
    throw new FirebaseAuthConfigurationError();
  }
  return timeout;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function verifiedUid(value: unknown, projectId: string): string {
  const now = Math.floor(Date.now() / 1000);
  if (
    !record(value) ||
    typeof value.uid !== 'string' ||
    !uidPattern.test(value.uid) ||
    value.sub !== value.uid ||
    value.aud !== projectId ||
    value.iss !== `https://securetoken.google.com/${projectId}` ||
    value.email_verified !== true ||
    !record(value.firebase) ||
    value.firebase.sign_in_provider !== 'google.com' ||
    value.firebase.tenant !== undefined
  )
    throw new AuthenticationError();
  for (const field of ['exp', 'iat', 'auth_time']) {
    const timestamp = value[field];
    if (
      typeof timestamp !== 'number' ||
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      (field === 'exp' ? timestamp <= now : timestamp > now)
    )
      throw new AuthenticationError();
  }
  return value.uid;
}
export class FirebaseAuthProvider implements AuthProvider {
  readonly #options: FirebaseAuthOptions;
  readonly #timeoutMs: number;
  #active = 0;
  #closed = false;
  constructor(options: FirebaseAuthOptions) {
    this.#timeoutMs = validateOptions(options);
    this.#options = { ...options };
  }
  dispose(): void {
    this.#closed = true;
  }
  async resolve(header: string | undefined): Promise<Actor> {
    if (
      this.#closed ||
      this.#active >= 16 ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined ||
      header === undefined ||
      header.length > 16_384 ||
      !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header) ||
      header.endsWith('\n')
    )
      throw new AuthenticationError();
    this.#active++;
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const requireLive = () => {
      if (expired || this.#closed || process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined)
        throw new AuthenticationError();
    };
    const operation = (async () => {
      const claims = await this.#options.verifier.verifyIdToken(header.slice(7), true);
      requireLive();
      const uid = verifiedUid(claims, this.#options.projectId);
      const actor = await this.#options.identities.findActor(this.#options.projectId, uid);
      requireLive();
      const parsed = actorSchema.safeParse(actor);
      if (!parsed.success) throw new AuthenticationError();
      return structuredClone(parsed.data);
    })();
    // Retain the slot after a timeout until the underlying SDK/DB work settles.
    void operation.then(
      () => {
        this.#active--;
      },
      () => {
        this.#active--;
      },
    );
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(new AuthenticationError());
          }, this.#timeoutMs);
        }),
      ]);
    } catch {
      throw new AuthenticationError();
    } finally {
      expired = true;
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
export function createFirebaseAuthProvider(
  options: Omit<FirebaseAuthOptions, 'verifier'> & { credential: Credential },
) {
  validateOptions(options);
  if (!options.credential || typeof options.credential.getAccessToken !== 'function')
    throw new FirebaseAuthConfigurationError();
  try {
    const app = initializeApp(
      { projectId: options.projectId, credential: options.credential },
      `lessonquest-${randomUUID()}`,
    );
    const provider = new FirebaseAuthProvider({ ...options, verifier: getAuth(app) });
    let closePromise: Promise<void> | undefined;
    return {
      resolve: (header: string | undefined) => provider.resolve(header),
      close: () => {
        provider.dispose();
        return (closePromise ??= deleteApp(app));
      },
    };
  } catch {
    throw new FirebaseAuthConfigurationError();
  }
}
