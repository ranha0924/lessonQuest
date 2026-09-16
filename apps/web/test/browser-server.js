// Test-only loopback server with disposable SQL storage and synthetic local authentication.
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { convertRewrites } from '@vercel/routing-utils';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '@lessonquest/api';
import { LocalAuthProvider } from '@lessonquest/auth';
import {
  initializeSchema,
  TenantRepository,
  LearningRepository,
  LessonInputRepository,
  TeacherSessionRepository,
} from '@lessonquest/db';
import { createServerHandler } from '@lessonquest/api/server-runtime';
const origin = 'http://127.0.0.1:4181';
const db = new PGlite();
await initializeSchema(db);
const teacher = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d101',
  platformRole: 'TEACHER',
  memberships: [],
};
const tenants = new TenantRepository(db);
await tenants.upsertUser(teacher);
await tenants.createOrganization(teacher, '브라우저 테스트 수업 공간');
const app = createApp({
  auth: new LocalAuthProvider({
    environment: 'test',
    sessions: new Map([[`dev_${'t'.repeat(32)}`, teacher]]),
  }),
  repository: tenants,
  learningRepository: new LearningRepository(db),
  lessonInputRepository: new LessonInputRepository(db),
  teacherSessionRepository: new TeacherSessionRepository(db),
  trustedOrigin: origin,
  diagnostics: { record() {} },
});
const gateway = createServerHandler(() =>
  Promise.resolve({ origin, fetch: (request) => app.fetch(request), close: () => db.close() }),
);
const directory = resolve('apps/web/dist-live-test');
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const route = convertRewrites([config.rewrites[0]])[0];
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (url.pathname.startsWith('/api/')) {
      const matched = new RegExp(route.src).exec(url.pathname);
      if (!matched) {
        response.writeHead(404).end();
        return;
      }
      const target = new URL(
        route.dest.replace(/\$(\d+)/g, (_value, index) => matched[Number(index)] ?? ''),
        origin,
      );
      target.searchParams.forEach((value, key) => url.searchParams.append(key, value));
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const result = await gateway(
        new globalThis.Request(url, {
          method: request.method,
          headers: request.headers,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
        }),
      );
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    const selectedDirectory = url.pathname.startsWith('/live-build/')
      ? resolve('apps/web/dist-live')
      : directory;
    const pathname = url.pathname.startsWith('/live-build/')
      ? url.pathname.slice('/live-build'.length)
      : url.pathname;
    const file = resolve(selectedDirectory, pathname === '/' ? 'index.html' : '.' + pathname);
    if (!file.startsWith(selectedDirectory + '/')) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      ...headers,
      'content-type':
        extname(file) === '.js'
          ? 'text/javascript'
          : extname(file) === '.css'
            ? 'text/css'
            : 'text/html',
      'cache-control': 'no-store',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500).end();
  }
}).listen(4181, '127.0.0.1');
