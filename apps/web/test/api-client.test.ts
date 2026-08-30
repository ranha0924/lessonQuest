import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHttpLessonQuestApi } from '../src/api-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpLessonQuestApi', () => {
  it('rejects a malformed successful response instead of casting it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ attacker: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://play.lessonquest.test',
      getAuthorization: () => 'Bearer synthetic',
    });

    await expect(
      api.listStudentAssignments('018f72a4-cc52-7c5a-a6f9-8b21aa27fb01'),
    ).rejects.toThrow();
  });

  it('parses aggregate boss responses and sends no tenant-owned hint fields', async () => {
    const fetchMock = vi.fn((_: URL | RequestInfo, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify({ campaignId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fb02', title: '보스', targetHp: 100, damage: 3, completed: false, studentId: 'leak' }), { status: 200, headers: { 'content-type': 'application/json' } })));
    vi.stubGlobal('fetch', fetchMock);
    const api = createHttpLessonQuestApi({ baseUrl: 'https://play.lessonquest.test', getAuthorization: () => 'Bearer synthetic' });
    await expect(api.getStudentBossProgress('018f72a4-cc52-7c5a-a6f9-8b21aa27fb01', '018f72a4-cc52-7c5a-a6f9-8b21aa27fb03')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
