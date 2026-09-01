import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { measureTheme } from './measurements.js';

const test = base.extend<{ expectedAssetFailure: boolean; allowCrossOriginRedirect: boolean }>({
  expectedAssetFailure: [false, { option: true }],
  allowCrossOriginRedirect: [false, { option: true }],
  page: async ({ page, context, baseURL, expectedAssetFailure, allowCrossOriginRedirect }, use) => {
    if (baseURL !== 'http://127.0.0.1:4179') throw new Error('Only the managed preview is allowed');
    const external: string[] = [],
      errors: string[] = [];
    // Playwright's serviceWorkers:block init script reads the forbidden getter
    // inside srcdoc's opaque sandbox. Observe unexpected registrations instead.
    context.on('serviceworker', (worker) => {
      if (worker.url() !== `${baseURL}/service-worker.js`) {
        errors.push(`Unexpected service worker: ${worker.url()}`);
      }
    });
    context.on('request', (request) => {
      const origin = new URL(request.url()).origin;
      if (origin !== baseURL && !(allowCrossOriginRedirect && origin === 'http://127.0.0.1:4180'))
        external.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !(expectedAssetFailure && message.text().includes('Failed to load resource'))
      )
        errors.push(message.text());
    });
    await context.route('**/*', (route) => {
      const origin = new URL(route.request().url()).origin;
      return origin === baseURL || (allowCrossOriginRedirect && origin === 'http://127.0.0.1:4180')
        ? route.continue()
        : route.abort();
    });
    await context.routeWebSocket(/.*/, async (socket) => {
      external.push(socket.url());
      await socket.close();
    });
    await use(page);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      context
        .serviceWorkers()
        .map((worker) => worker.url())
        .filter((url) => url !== `${baseURL}/service-worker.js`),
    ).toEqual([]);
  },
});

async function ready(page: Page) {
  await expect(page.getByRole('heading', { name: '개발용 서비스 미리보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '학생 화면' })).toBeEnabled();
  await expect(page.getByText(/새로고침하면 초기화/)).toBeVisible();
}

async function queuedRecordCount(page: Page) {
  return (await queuedRecords(page)).length;
}

interface StoredOfflineRecord {
  readonly key: string;
  readonly accountStorageKey: string;
  readonly organizationId: string;
  readonly createdAt: number;
  readonly event: {
    readonly eventId: string;
    readonly organizationId: string;
    readonly type: string;
    readonly payload: Record<string, unknown>;
  };
  readonly [key: string]: unknown;
}

async function queuedRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<StoredOfflineRecord[]>((resolve, reject) => {
        const request = indexedDB.open('lessonquest-offline-v1', 1);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('learning-events', 'readonly');
          const records = transaction.objectStore('learning-events').getAll();
          records.onerror = () => reject(records.error ?? new Error('IndexedDB read failed'));
          records.onsuccess = () => {
            database.close();
            resolve(records.result as StoredOfflineRecord[]);
          };
        };
      }),
  );
}

async function insertForeignExpiredRecord(page: Page, source: StoredOfflineRecord) {
  const accountStorageKey = `lqs_${'d'.repeat(64)}`;
  const organizationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await page.evaluate(
    ({ accountStorageKey, organizationId, source }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lessonquest-offline-v1', 1);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('learning-events', 'readwrite');
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('IndexedDB transaction failed'));
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.objectStore('learning-events').put({
            ...source,
            key: `${accountStorageKey}:${organizationId}:${source.event.eventId}`,
            accountStorageKey,
            organizationId,
            createdAt: 0,
            event: { ...source.event, organizationId },
          });
        };
      }),
    { accountStorageKey, organizationId, source },
  );
  return accountStorageKey;
}

test('PWA shell installs safely and reopens after the first online load', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await ready(page);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()['content-type']).toBe('application/manifest+json');
  expect(await manifest.json()).toMatchObject({
    name: 'LessonQuest',
    display: 'standalone',
    start_url: '/',
  });
  const icon = await page.request.get('/pwa-icon.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toBe('image/svg+xml');
  const worker = await page.request.get('/service-worker.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toBe('text/javascript');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller === null) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });
  expect(context.serviceWorkers().map((item) => item.url())).toEqual([
    'http://127.0.0.1:4179/service-worker.js',
  ]);
  const foreignCacheResponse = await page.evaluate(async () => {
    const foreign = await caches.open('foreign-app-cache');
    await foreign.put('/foreign-only.js', new Response('foreign cache sentinel'));
    const body = await (await fetch('/foreign-only.js')).text();
    await caches.delete('foreign-app-cache');
    return body;
  });
  expect(foreignCacheResponse).not.toBe('foreign cache sentinel');
  await context.setOffline(true);
  try {
    await page.reload();
    await ready(page);
  } finally {
    await context.setOffline(false);
  }
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return { names: await caches.keys(), urls };
  });
  expect(cached.names).toEqual([expect.stringMatching(/^lessonquest-shell-/)]);
  expect(cached.urls.some((url) => new URL(url).pathname.startsWith('/organizations/'))).toBe(
    false,
  );
});

test.describe('service worker cache safety', () => {
  test.use({ allowCrossOriginRedirect: true });

  test('keeps API navigations and redirected cross-origin responses out of the shell cache', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller === null) {
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          }),
        );
      }
    });

    await page.goto('/health');
    await expect(page.locator('body')).toContainText('SENSITIVE HEALTH SENTINEL');
    expect(
      await page.evaluate(async () => {
        const name = (await caches.keys()).find((value) => value.startsWith('lessonquest-shell-'));
        if (name === undefined) return '';
        return (await (await caches.open(name)).match('/'))?.text();
      }),
    ).not.toContain('SENSITIVE HEALTH SENTINEL');

    await context.addCookies([{ name: 'lessonquest_private', value: '1', url: baseURL! }]);
    await page.goto('/organizations/private/report');
    await expect(page.locator('body')).toContainText('private');
    expect(
      await page.evaluate(async () => {
        const name = (await caches.keys()).find((value) => value.startsWith('lessonquest-shell-'));
        if (name === undefined) return '';
        return (await (await caches.open(name)).match('/'))?.text();
      }),
    ).not.toContain('"student":"private"');

    await page.goto('/?cross-origin-cache-test=1');
    await ready(page);
    expect(
      await page.evaluate(() => fetch('/redirect-static.js').then((response) => response.text())),
    ).toBe('CROSS_ORIGIN_STATIC');
    expect(
      await page.evaluate(async () => {
        const name = (await caches.keys()).find((value) => value.startsWith('lessonquest-shell-'));
        if (name === undefined) return null;
        return (await (await caches.open(name)).match('/redirect-static.js'))?.text() ?? null;
      }),
    ).toBeNull();

    await context.setOffline(true);
    try {
      await page.goto('/');
      await ready(page);
      await expect(page.locator('body')).not.toContainText('SENSITIVE HEALTH SENTINEL');
      await expect(page.locator('body')).not.toContainText('"student":"private"');
    } finally {
      await context.setOffline(false);
    }
  });
});

test('an offline answer survives a player remount and sends once when online', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await ready(page);
  await publish(page, '오프라인 재전송 탐험');
  await enterStudent(page, '오프라인 재전송 탐험');
  let queuedRecord: StoredOfflineRecord | undefined;
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
    await expect(
      page.getByText('오프라인 대기 기록 1건 · 연결되면 자동 전송합니다.'),
    ).toBeVisible();
    const records = await queuedRecords(page);
    expect(records).toHaveLength(1);
    const queued = records[0]!;
    queuedRecord = queued;
    expect(queued.accountStorageKey).toMatch(/^lqs_[a-f0-9]{64}$/);
    expect(queued.event).toMatchObject({
      organizationId: queued.organizationId,
      type: 'QUESTION_ANSWERED',
      payload: {
        attempt: 1,
        elapsedMs: 1_000,
        optionId: 'light',
      },
    });
    expect(JSON.stringify(queued)).not.toMatch(/authorization|bearer|correct|hint|title/i);
    await page.getByRole('button', { name: '교사 화면' }).click();
    await page.getByRole('button', { name: '학생 화면' }).click();
    await page
      .getByRole('article', { name: '오프라인 재전송 탐험' })
      .getByRole('button', { name: '이어하기' })
      .click();
    await expect(page.getByText('대기 중인 학습 기록을 먼저 전송해 주세요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '질량 6 kg 선택' })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
  await expect(page.getByText('대기하던 학습 기록을 전송했습니다.')).toBeVisible();
  await expect(page.getByText('정답이에요!')).toBeVisible();
  expect(await queuedRecordCount(page)).toBe(0);
  await page.getByRole('button', { name: '탐험 완료', exact: true }).click();
  await expect(page.getByText('탐험을 완료했습니다!')).toBeVisible();
  expect(queuedRecord).toBeDefined();
  const foreignAccount = await insertForeignExpiredRecord(page, queuedRecord);
  await page.getByRole('button', { name: '데이터 초기화' }).click();
  await ready(page);
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
  expect((await queuedRecords(page)).map(({ accountStorageKey }) => accountStorageKey)).toEqual([
    foreignAccount,
  ]);
});

test('classroom invitations connect a new class to student play and teacher dashboard', async ({
  page,
}, info) => {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: '반 관리', exact: true }).click();
  await expect(page.getByText('현재 학생 1명')).toBeVisible();
  await page.getByLabel('새 반 이름').fill('우주 협동반');
  await page.getByRole('button', { name: '반 만들기' }).click();
  await expect(page.getByRole('heading', { name: '우주 협동반 현황' })).toBeVisible();
  await page.getByRole('button', { name: '초대 코드 발급' }).click();
  const oldCode = await page.getByLabel('발급된 초대 코드').textContent();
  await page.getByRole('button', { name: '초대 코드 재발급' }).click();
  await expect(page.getByLabel('발급된 초대 코드')).not.toHaveText(oldCode ?? '');
  const code = await page.getByLabel('발급된 초대 코드').textContent();
  expect(code).toMatch(/^lqi_[a-f0-9]{64}$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('phase2-classroom.png'), fullPage: true });
  await page.getByRole('button', { name: '교사 화면' }).click();
  await publish(page, '협동반 첫 탐험');
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
  await page.getByLabel('초대 코드', { exact: true }).fill(oldCode ?? '');
  await page.getByRole('button', { name: '반 참여하기' }).click();
  await expect(page.getByRole('alert')).toContainText('참여 결과를 확인하지 못했습니다.');
  await page.getByLabel('초대 코드', { exact: true }).fill(code ?? '');
  await page.getByRole('button', { name: '반 참여하기' }).click();
  await expect(page.getByText('우주 협동반에 참여했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '탐험 시작' }).click();
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await expect(page.getByText('정답이에요!')).toBeVisible();
  await page.getByRole('button', { name: '탐험 완료', exact: true }).click();
  await expect(page.getByText('탐험을 완료했습니다!')).toBeVisible();
  await page.getByRole('button', { name: '반 관리', exact: true }).click();
  await expect(page.getByText('완료 1 / 1명')).toBeVisible();
  await expect(page.getByLabel('발급된 초대 코드')).toHaveCount(0);
  await page.getByLabel('수업할 반').selectOption({ label: '개발 체험반' });
  await expect(page.getByRole('heading', { name: '개발 체험반 현황' })).toBeVisible();
  await expect(
    page.getByText('아직 배포한 과제가 없습니다. 교사 화면의 제작소에서 탐험을 준비하세요.'),
  ).toBeVisible();
});

async function publish(page: Page, title: string) {
  await page.getByLabel('체험 제목', { exact: true }).fill(title);
  await page.getByRole('button', { name: '초안 저장' }).click();
  await expect(page.getByText('초안이 생성됐습니다.')).toBeVisible();
  await page.getByRole('button', { name: '독립 검증' }).click();
  await expect(page.getByRole('button', { name: '승인', exact: true })).toBeEnabled();
  const frame = page.frameLocator('iframe[title="과학 체험 격리 미리보기"]');
  await expect(
    frame.getByRole('heading', { name: '가벼운 손수레가 더 빨리 움직이는 이유' }),
  ).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await page.getByRole('button', { name: '반에 배포', exact: true }).click();
  await expect(page.getByText('반 배포 완료')).toBeVisible();
}

async function enterStudent(page: Page, title: string) {
  await page.getByRole('button', { name: '학생 화면' }).click();
  await page
    .getByRole('article', { name: title })
    .getByRole('button', { name: '탐험 시작' })
    .click();
  await expect(page.getByRole('button', { name: '질량 6 kg 선택' })).toBeVisible();
}

test('real teacher authoring, sandbox, student hint/retry and teacher persisted evidence', async ({
  page,
}, testInfo) => {
  const assets: { path: string; type: string | undefined }[] = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (/\.(wasm|data)$/.test(path))
      assets.push({ path, type: response.headers()['content-type'] });
  });
  await page.goto('/');
  await ready(page);
  expect(assets).toHaveLength(3);
  for (const asset of assets) {
    // Chromium can discard captured WASM bodies after compilation. Re-read the
    // observed same-origin resource through the test client to verify its binary.
    const url = new URL(asset.path, 'http://127.0.0.1:4179');
    expect(url.origin).toBe('http://127.0.0.1:4179');
    const response = await page.request.get(url.href, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const bytes = await response.body();
    expect(bytes.length).toBeGreaterThan(100_000);
    expect(asset.type).toBe(
      asset.path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
    );
    if (asset.path.endsWith('.wasm')) expect([...bytes.subarray(0, 4)]).toEqual([0, 97, 115, 109]);
  }
  await publish(page, '브라우저 실제 과학 체험');
  await enterStudent(page, '브라우저 실제 과학 체험');
  await page.getByRole('button', { name: '질량 6 kg 선택' }).click();
  await expect(page.getByText('다시 생각해 볼까요?')).toBeVisible();
  await page.getByRole('button', { name: '힌트 받기' }).click();
  await expect(page.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.')).toBeVisible();
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await expect(page.getByText('재도전 성공')).toBeVisible();
  await page.getByRole('button', { name: '탐험 완료' }).click();
  await expect(page.getByText('탐험을 완료했습니다!')).toBeVisible();
  await page.getByRole('button', { name: '교사 화면' }).click();
  await expect(page.getByLabel('체험 제목', { exact: true })).toHaveValue(
    '브라우저 실제 과학 체험',
  );
  await page.getByRole('button', { name: '교사 결과 보기' }).click();
  await expect(page.getByText('오답 1회')).toBeVisible();
  await expect(page.getByText('재도전 1회')).toBeVisible();
  await expect(page.getByText('힌트 1회')).toBeVisible();
  await expect(page.getByText('8 / 100', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.evaluate(() => ({
      cookies: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ cookies: '', local: 0, session: 0 });
  expect((await page.evaluate(() => indexedDB.databases())).map(({ name }) => name)).toEqual([
    'lessonquest-offline-v1',
  ]);
  await page.screenshot({ path: testInfo.outputPath('teacher-results.png'), fullPage: true });
});

test('correct-first counts once, role switching refreshes assignments, reset and reload discard data', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);
  await publish(page, '첫 정답 체험');
  await enterStudent(page, '첫 정답 체험');
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await expect(page.getByText('정답이에요!')).toBeVisible();
  await page.getByRole('button', { name: '탐험 완료' }).click();
  await expect(page.getByText('탐험을 완료했습니다!')).toBeVisible();
  await page.getByRole('button', { name: '교사 화면' }).click();
  await page.getByRole('button', { name: '교사 결과 보기' }).click();
  await expect(page.getByText('오답 0회')).toBeVisible();
  await expect(page.getByText('힌트 0회')).toBeVisible();
  await expect(page.getByText('7 / 100', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByRole('button', { name: '완료됨' })).toBeDisabled();
  await page.getByRole('button', { name: '데이터 초기화' }).click();
  await ready(page);
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
});

test.describe('startup recovery', () => {
  test.use({ expectedAssetFailure: true });
  test('failed database asset load stays safe and is retryable', async ({ page }) => {
    let failed = false;
    await page.route('**/*.wasm', (route) => {
      failed = true;
      return route.abort();
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '다시 준비' })).toBeVisible();
    expect(failed).toBe(true);
    await page.unroute('**/*.wasm');
    await page.getByRole('button', { name: '다시 준비' }).click();
    await ready(page);
  });
});

test('normal build stays fail-closed and never loads preview database assets', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', (request) => assets.push(request.url()));
  await page.goto('/normal-build/');
  await expect(
    page.getByText('로컬 인증 호스트에서 세션을 준비한 뒤 다시 열어 주세요.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '학생 화면' })).toHaveCount(0);
  expect(assets.filter((url) => /\.wasm|\.data|\/mount-/.test(url))).toEqual([]);
});

test('a configured non-preview session warms its first-load hashed shell assets', async ({
  page,
}) => {
  const activeOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c101';
  const foreignOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c999';
  const offlineQueueKey = `lqs_${'e'.repeat(64)}`;
  await page.goto('/normal-build/');
  await expect(
    page.getByText('로컬 인증 호스트에서 세션을 준비한 뒤 다시 열어 주세요.'),
  ).toBeVisible();
  await page.evaluate(
    ({ activeOrganizationId, foreignOrganizationId, offlineQueueKey }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lessonquest-offline-v1', 1);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore('learning-events', { keyPath: 'key' });
          store.createIndex('scope', ['accountStorageKey', 'organizationId'], { unique: false });
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('learning-events', 'readwrite');
          transaction.onerror = () =>
            reject(transaction.error ?? new Error('IndexedDB transaction failed'));
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          const store = transaction.objectStore('learning-events');
          const eventId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c201';
          const baseEvent = {
            schemaVersion: 1,
            assignmentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c202',
            experienceId: 'science_force_01',
            experienceVersion: 1,
            type: 'QUESTION_ANSWERED',
            stepId: 'quiz_force',
            sequence: 0,
            occurredAt: '2026-09-01T00:00:00.000Z',
            payload: { optionId: 'light', attempt: 1, elapsedMs: 1_000 },
          };
          store.put({
            key: `${offlineQueueKey}:${activeOrganizationId}:${eventId}`,
            accountStorageKey: offlineQueueKey,
            organizationId: activeOrganizationId,
            event: {
              ...baseEvent,
              eventId,
              organizationId: foreignOrganizationId,
              attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c203',
            },
            createdAt: Date.now(),
            attempts: 0,
            nextAttemptAt: Date.now(),
          });
          store.put({
            key: 'corrupt-primary-key',
            accountStorageKey: offlineQueueKey,
            organizationId: activeOrganizationId,
            event: {
              ...baseEvent,
              eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c211',
              organizationId: activeOrganizationId,
              attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c212',
            },
            createdAt: Date.now(),
            attempts: 0,
            nextAttemptAt: Date.now(),
          });
          const unrelatedQueueKey = `lqs_${'f'.repeat(64)}`;
          store.put({
            key: `${unrelatedQueueKey}:${foreignOrganizationId}:018f72a4-cc52-7c5a-a6f9-8b21aa27c221`,
            accountStorageKey: unrelatedQueueKey,
            organizationId: foreignOrganizationId,
            event: {
              ...baseEvent,
              eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c221',
              organizationId: foreignOrganizationId,
              attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c222',
            },
            createdAt: Date.now(),
            attempts: 0,
            nextAttemptAt: Date.now(),
          });
        };
      }),
    { activeOrganizationId, foreignOrganizationId, offlineQueueKey },
  );
  await page.addInitScript(() => {
    Reflect.set(window, 'lessonQuestSession', {
      authorization: `dev_${'s'.repeat(32)}`,
      role: 'STUDENT',
      organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c101',
      classId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c102',
      offlineQueueKey: `lqs_${'e'.repeat(64)}`,
    });
  });
  const foreignDeliveries: string[] = [];
  const activeLearningEventDeliveries: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes(foreignOrganizationId)) {
      foreignDeliveries.push(request.url());
    }
    if (pathname === `/organizations/${activeOrganizationId}/learning-events`) {
      activeLearningEventDeliveries.push(request.url());
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '내 과학 탐험' })).toBeVisible();
  await expect(page.getByText('탐험을 불러오지 못했어요.')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const paths: string[] = [];
        for (const name of await caches.keys()) {
          for (const request of await (await caches.open(name)).keys()) {
            paths.push(new URL(request.url).pathname);
          }
        }
        const shell = paths.filter((path) => path.startsWith('/normal-build/assets/'));
        return ['.css', '.js', '.png'].every((extension) =>
          shell.some((path) => path.endsWith(extension)),
        );
      }),
    )
    .toBe(true);
  await expect
    .poll(async () => (await queuedRecords(page)).map(({ key }) => key))
    .toEqual([
      `lqs_${'f'.repeat(64)}:${foreignOrganizationId}:018f72a4-cc52-7c5a-a6f9-8b21aa27c221`,
    ]);
  expect(foreignDeliveries).toEqual([]);
  expect(activeLearningEventDeliveries).toEqual([]);
});

test('reset during a real draft write recreates an empty runtime without a stale UI', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.find((button) => button.textContent === '초안 저장')?.click();
    buttons.find((button) => button.textContent === '데이터 초기화')?.click();
  });
  await ready(page);
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
  await page.getByRole('button', { name: '교사 화면' }).click();
  await expect(page.getByRole('button', { name: '독립 검증' })).toBeDisabled();
  await expect(page.getByText('0 / 100', { exact: true })).toBeVisible();
});

async function cosmicState(page: Page, info: TestInfo, state: string) {
  const result = await measureTheme(page, {
    scope: '.cosmic-service',
    surfaceSelectors: [
      '.cosmic-service',
      '.cosmic-rail',
      '.cosmic-topbar',
      '.cosmic-hero',
      '.panel',
      '.assignment-card',
      '.player-canvas',
      '.play-block',
      '.rasa-panel',
      '.boss-card',
      '.status-banner',
      '.progress-row',
      '.empty-state',
    ],
    contrastSelectors: [
      '.cosmic-service h1',
      '.cosmic-service h2',
      '.cosmic-service h3',
      '.cosmic-service p',
      '.cosmic-service label',
      '.cosmic-service button',
      '.cosmic-service a',
      '.cosmic-service summary',
      '.cosmic-service input',
      '.cosmic-service select',
      '.cosmic-service textarea',
      '.cosmic-service .trail-step',
      '.cosmic-service .progress-row span',
      '.cosmic-service .progress-row strong',
    ],
  });
  expect(result.surfaces.length).toBeGreaterThanOrEqual(4);
  expect(result.contrasts.length).toBeGreaterThanOrEqual(8);
  console.info(
    JSON.stringify({
      state,
      width: result.width,
      minTarget: Math.min(...result.targets.map((target) => Math.min(target.width, target.height))),
      minContrast: Math.min(...result.contrasts.map((item) => item.ratio)),
      maxSurface: Math.max(...result.surfaces.map((item) => item.luminance)),
      violations: result.violations,
    }),
  );
  expect(result.violations).toEqual([]);
  await info.attach(`${state}-measurements`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  await page.screenshot({ path: info.outputPath(`${state}.png`), fullPage: true });
}

test('cosmic real service preserves readable mission controls through every learning state', async ({
  page,
}, info) => {
  await page.goto('/');
  await ready(page);
  await cosmicState(page, info, 'teacher-initial');
  const art = page.locator('.cosmic-astronaut:visible');
  await expect(art).toHaveCount(1);
  await expect
    .poll(() => art.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  expect(new URL((await art.getAttribute('src')) ?? '', page.url()).origin).toBe(
    new URL(page.url()).origin,
  );
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByText('지금 할 탐험이 없어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '탐험 시작' })).toHaveCount(0);
  await cosmicState(page, info, 'student-empty');
  await page.getByRole('button', { name: '교사 화면' }).click();
  await publish(page, '우주 항로 탐험');
  await cosmicState(page, info, 'teacher-published');
  await page.getByRole('button', { name: '학생 화면' }).click();
  await expect(page.getByRole('article', { name: '우주 항로 탐험' })).toBeVisible();
  await cosmicState(page, info, 'student-assigned');
  await page.getByRole('button', { name: '탐험 시작' }).click();
  await expect(page.getByRole('button', { name: '질량 6 kg 선택' })).toBeVisible();
  await cosmicState(page, info, 'student-play');
  await page.getByRole('button', { name: '질량 6 kg 선택' }).click();
  await page.getByRole('button', { name: '힌트 받기' }).click();
  await expect(page.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.')).toBeVisible();
  await cosmicState(page, info, 'student-hint');
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await page.getByRole('button', { name: '탐험 완료', exact: true }).click();
  await expect(page.getByText('탐험을 완료했습니다!')).toBeVisible();
  await cosmicState(page, info, 'student-completed');
  await page.getByRole('button', { name: '교사 화면' }).click();
  await page.getByRole('button', { name: '교사 결과 보기' }).click();
  await expect(page.getByText('힌트 1회')).toBeVisible();
  await cosmicState(page, info, 'teacher-results');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const controls = page.locator(
    '.cosmic-service button:visible:enabled, .cosmic-service a:visible, .cosmic-service summary:visible, .cosmic-service input:visible, .cosmic-service select:visible, .cosmic-service textarea:visible',
  );
  const visited = new Set<number>();
  for (let i = 0; i < (await controls.count()) + 3; i++) {
    await page.keyboard.press('Tab');
    const index = await controls.evaluateAll((elements) =>
      elements.findIndex((element) => element === document.activeElement),
    );
    if (index < 0) continue;
    visited.add(index);
    expect(
      await controls.nth(index).evaluate((element) => ({
        width: getComputedStyle(element).outlineWidth,
        style: getComputedStyle(element).outlineStyle,
      })),
    ).toEqual({ width: '4px', style: 'solid' });
  }
  expect(visited.size).toBe(await controls.count());
  await page.getByRole('button', { name: '학생 화면' }).hover();
  expect(
    await page
      .getByRole('button', { name: '학생 화면' })
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none');
  expect(
    await page.locator('.cosmic-service *').evaluateAll(
      (elements) =>
        elements.filter(
          (element) =>
            getComputedStyle(element).animationName !== 'none' ||
            getComputedStyle(element)
              .transitionDuration.split(',')
              .some((value) => parseFloat(value) !== 0),
        ).length,
    ),
  ).toBe(0);
});
