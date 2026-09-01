import { PGlite } from '@electric-sql/pglite';
import { createApp } from '@lessonquest/api';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import {
  GamificationRepository,
  ClassroomRepository,
  initializeSchema,
  LearningRepository,
  RasaRepository,
  TenantRepository,
} from '@lessonquest/db';
import { LocalRasaProvider } from '@lessonquest/rasa';
import { createHttpLessonQuestApi } from '../api-client.js';
// Original LessonQuest synthetic fixture; no reference repository or student data.
import sampleText from '../../../../packages/science-studio/test/fixtures/force-motion.json?raw';

const origin = 'https://preview.lessonquest.invalid';
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fd01',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fd02',
  platformRole: 'STUDENT',
  memberships: [],
};
const teacherToken = `dev_${'t'.repeat(32)}`;
const studentToken = `dev_${'s'.repeat(32)}`;
const studentOfflineQueueKey = `lqs_${'2'.repeat(64)}`;

async function createDatabase() {
  if (typeof window === 'undefined') return new PGlite('memory://');
  // Fetch and compile before constructing PGlite. Its default parallel asset loader
  // does not reliably settle waitReady after a failed request in a browser.
  const urls = [
    new URL('../../node_modules/@electric-sql/pglite/dist/pglite.wasm', import.meta.url),
    new URL('../../node_modules/@electric-sql/pglite/dist/initdb.wasm', import.meta.url),
    new URL('../../node_modules/@electric-sql/pglite/dist/pglite.data', import.meta.url),
  ];
  const responses = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Preview database asset unavailable');
      return response;
    }),
  );
  const main = responses[0],
    init = responses[1],
    data = responses[2];
  if (main === undefined || init === undefined || data === undefined)
    throw new Error('Preview assets missing');
  const [pgliteWasmModule, initdbWasmModule, fsBundle] = await Promise.all([
    main.arrayBuffer().then((bytes) => WebAssembly.compile(bytes)),
    init.arrayBuffer().then((bytes) => WebAssembly.compile(bytes)),
    data.blob(),
  ]);
  return new PGlite({ dataDir: 'memory://', pgliteWasmModule, initdbWasmModule, fsBundle });
}

export async function createPreviewRuntime() {
  const database = await createDatabase();
  try {
    await database.waitReady;
    await initializeSchema(database);
    const tenants = new TenantRepository(database);
    const learning = new LearningRepository(database);
    const gamification = new GamificationRepository(database);
    await tenants.upsertUser(teacher);
    await tenants.upsertUser(student);
    const organization = await tenants.createOrganization(teacher, '가상 개발 학교');
    const lessonClass = await tenants.createClass(teacher, organization.id, '개발 체험반');
    await tenants.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);
    await gamification.createCampaign(
      teacher,
      organization.id,
      lessonClass.id,
      {
        title: '개발 체험 공동 보스',
        period: { kind: 'SPECIAL', version: 1 },
        targetHp: 100,
        policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
      },
      crypto.randomUUID(),
    );
    const app = createApp({
      auth: new LocalAuthProvider({
        environment: 'development',
        sessions: new Map([
          [teacherToken, teacher],
          [studentToken, student],
        ]),
      }),
      repository: tenants,
      classroomRepository: new ClassroomRepository(database),
      learningRepository: learning,
      rasaRepository: new RasaRepository(database),
      gamificationRepository: gamification,
      rasaProvider: new LocalRasaProvider(),
      trustedOrigin: origin,
      // No telemetry, prompts, learner text or tokens leave this synthetic runtime.
      diagnostics: { record() {} },
    });
    let closing = false;
    let closePromise: Promise<void> | undefined;
    const pending = new Set<Promise<Response>>();
    const transport: typeof fetch = (input, init) => {
      if (closing) return Promise.reject(new Error('Preview runtime is closed'));
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.origin !== origin || url.username !== '' || url.password !== '') {
        return Promise.reject(new TypeError('Preview transport origin rejected'));
      }
      // Browser Request headers reject scripted Origin. A detached Headers object
      // carries the synthetic origin solely to Hono in memory; never to fetch().
      const headers = new Headers(request.headers);
      headers.set('origin', origin);
      Object.defineProperty(request, 'headers', { value: headers });
      const work = Promise.resolve(app.fetch(request));
      pending.add(work);
      void work.then(
        () => pending.delete(work),
        () => pending.delete(work),
      );
      return work;
    };
    const api = (token: string) =>
      createHttpLessonQuestApi({
        baseUrl: origin,
        getAuthorization: () => `Bearer ${token}`,
        fetch: transport,
      });
    return {
      organizationId: organization.id,
      classId: lessonClass.id,
      teacherApi: api(teacherToken),
      studentApi: api(studentToken),
      studentOfflineQueueKey,
      sampleDraft: { title: '가벼운 손수레 탐험', generatedSpecText: sampleText },
      close() {
        closing = true;
        closePromise ??= (async () => {
          await Promise.allSettled([...pending]);
          // The API schedules projection after ingestion; drain its serial queue before closing.
          try {
            await gamification.drainPendingJobs(100);
          } finally {
            await database.close();
          }
        })();
        return closePromise;
      },
    };
  } catch {
    await database.close().catch(() => undefined);
    throw new Error('Development preview initialization failed');
  }
}

export type PreviewRuntime = Awaited<ReturnType<typeof createPreviewRuntime>>;
