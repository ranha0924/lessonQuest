import { expect, it, vi } from 'vitest';
import { createLiveSession } from '../src/live-session.js';
import { createHttpLessonQuestApi } from '../src/api-client.js';
it('awaits authorization, uses /api same-origin no-store transport and invalidates late token work', async () => {
  let token!: (value: string) => void;
  const getIdToken = () =>
    new Promise<string>((r) => {
      token = r;
    });
  const transport = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([])));
  const live = createLiveSession(
    { uid: 'synthetic-uid', getIdToken },
    () => true,
    'https://lessonquest.test',
    transport,
  );
  const request = live.api.listLessonInputs('org');
  expect(transport).not.toHaveBeenCalled();
  live.dispose();
  token('never-sent-token');
  await expect(request).rejects.toThrow('로그인 상태가 변경되었습니다.');
  expect(transport).not.toHaveBeenCalled();
});
it('checks session after body decoding even when transport ignores abort', async () => {
  let decode!: (v: unknown) => void;
  const transport = vi.fn<typeof fetch>(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        new Promise((r) => {
          decode = r;
        }),
    } as Response),
  );
  const live = createLiveSession(
    { uid: 'u', getIdToken: () => Promise.resolve('synthetic-token') },
    () => true,
    'https://lessonquest.test',
    transport,
  );
  const request = live.api.listLessonInputs('org');
  await vi.waitFor(() => expect(decode).toBeTypeOf('function'));
  expect((transport.mock.calls[0]?.[0] as URL).href).toBe(
    'https://lessonquest.test/api/organizations/org/lesson-inputs',
  );
  expect(transport.mock.calls[0]?.[1]).toMatchObject({
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
  });
  live.dispose();
  decode([]);
  await expect(request).rejects.toThrow('로그인 상태가 변경되었습니다.');
  expect(transport.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});
it('preserves legacy sync client defaults and awaits optional async tokens', async () => {
  const transport = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([])));
  const api = createHttpLessonQuestApi({
    baseUrl: 'https://lessonquest.test',
    getAuthorization: () => Promise.resolve('Bearer async'),
    fetch: transport,
  });
  await api.listLessonInputs('org');
  expect((transport.mock.calls[0]?.[0] as URL).href).toBe(
    'https://lessonquest.test/organizations/org/lesson-inputs',
  );
  expect(new Headers(transport.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
    'Bearer async',
  );
});
it('dispatches existing synchronous authorization before returning so preview shutdown can drain accepted requests', async () => {
  const transport = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([])));
  const api = createHttpLessonQuestApi({
    baseUrl: 'https://lessonquest.test',
    getAuthorization: () => 'Bearer existing-sync',
    fetch: transport,
  });
  const pending = api.listLessonInputs('org');
  expect(transport).toHaveBeenCalledTimes(1);
  await pending;
});
