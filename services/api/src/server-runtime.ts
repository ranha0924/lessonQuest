import { randomUUID } from 'node:crypto';
import { cert } from 'firebase-admin/app';
import { createFirebaseAuthProvider } from '@lessonquest/auth/firebase';
import {
  FirebaseIdentityRepository,
  TeacherSessionRepository,
  TenantRepository,
  LearningRepository,
  LessonInputRepository,
} from '@lessonquest/db';
import { PostgresDatabase } from '@lessonquest/db/postgres';
import { requireRuntimeReadiness } from '@lessonquest/db/runtime-readiness';
import { createApp } from './app.js';
import { readServerConfiguration } from './server-config.js';

export interface ServerRuntime {
  readonly origin: string;
  fetch(request: Request): Promise<Response>;
  close(): Promise<void>;
}
export async function createProductionRuntime(): Promise<ServerRuntime> {
  const config = readServerConfiguration(process.env);
  const database = new PostgresDatabase({
    connectionString: config.databaseUrl,
    schema: 'lessonquest',
  });
  let auth: ReturnType<typeof createFirebaseAuthProvider> | undefined;
  try {
    await requireRuntimeReadiness(database);
    auth = createFirebaseAuthProvider({
      projectId: config.projectId,
      credential: cert(config.serviceAccount),
      identities: new FirebaseIdentityRepository(database),
    });
    const app = createApp({
      auth,
      repository: new TenantRepository(database),
      learningRepository: new LearningRepository(database),
      lessonInputRepository: new LessonInputRepository(database),
      teacherSessionRepository: new TeacherSessionRepository(database),
      trustedOrigin: config.origin,
      diagnostics: {
        record(event) {
          console.error(JSON.stringify(event));
        },
      },
    });
    const provider = auth;
    return {
      origin: config.origin,
      fetch: async (request) => app.fetch(request),
      close: async () => {
        await Promise.allSettled([provider.close(), database.close()]);
      },
    };
  } catch {
    await Promise.allSettled([database.close(), ...(auth ? [auth.close()] : [])]);
    throw new Error('Server is unavailable');
  }
}
function problem(status: number, code: string): Response {
  const traceId = randomUUID();
  return Response.json(
    {
      error: {
        code,
        message:
          status === 503
            ? '서버 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.'
            : '요청을 처리할 수 없습니다.',
        retryable: status === 503,
        traceId,
      },
    },
    { status, headers: { 'cache-control': 'no-store', 'x-trace-id': traceId } },
  );
}
function allowed(url: URL, method: string): boolean {
  if (url.search) return false;
  if (['/api/session', '/api/health'].includes(url.pathname)) return method === 'GET';
  const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  const base = `/api/organizations/${uuid}/lesson-inputs`;
  return (
    (new RegExp(`^${base}$`).test(url.pathname) && ['GET', 'POST'].includes(method)) ||
    (new RegExp(`^${base}/${uuid}$`).test(url.pathname) && ['GET', 'PUT'].includes(method)) ||
    (new RegExp(`^${base}/${uuid}/generations$`).test(url.pathname) && method === 'POST')
  );
}
export function createServerHandler(build: () => Promise<ServerRuntime> = createProductionRuntime) {
  let runtime: ServerRuntime | undefined;
  let pending: Promise<ServerRuntime> | undefined;
  let retryAt = 0;
  function ready(): Promise<ServerRuntime> {
    if (runtime) return Promise.resolve(runtime);
    if (pending) return pending;
    if (Date.now() < retryAt) return Promise.reject(new Error());
    let expired = false;
    let timer: ReturnType<typeof setTimeout>;
    const operation = Promise.resolve().then(build);
    pending = Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error());
        }, 30000);
      }),
    ]);
    void operation
      .then(
        async (value) => {
          if (expired) await value.close();
          else runtime = value;
        },
        () => {},
      )
      .finally(() => {
        clearTimeout(timer);
        pending = undefined;
        retryAt = Date.now() + 5000;
      })
      .catch(() => {});
    return pending;
  }
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (!allowed(url, request.method)) return problem(404, 'RESOURCE_NOT_FOUND');
      const active = await ready();
      if (
        url.origin !== active.origin ||
        (request.headers.has('origin') && request.headers.get('origin') !== active.origin)
      )
        return problem(403, 'ORIGIN_FORBIDDEN');
      url.pathname = url.pathname.slice(4);
      const response = await active.fetch(new Request(url, request));
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return problem(503, 'SERVER_NOT_READY');
    }
  };
}
