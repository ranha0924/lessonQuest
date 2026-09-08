import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHttpLessonQuestApi, type LessonInputApi } from '../src/api-client.js';

const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27fb01';
const lessonInputId = '018f72a4-cc52-7c5a-a6f9-8b21aa27fb11';
const mutationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27fb12';
const lessonInput = {
  id: lessonInputId,
  organizationId,
  ownerTeacherId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fb13',
  title: '힘과 운동',
  gradeBand: 'middle1' as const,
  learningContent: '힘은 물체의 운동을 바꿉니다.',
  learningObjectives: ['힘의 효과를 설명한다.'],
  revision: 1,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createHttpLessonQuestApi', () => {
  it('exposes all parsed lesson-input requests without changing the existing API capability', async () => {
    const responses = [
      [
        {
          id: lessonInput.id,
          title: lessonInput.title,
          gradeBand: lessonInput.gradeBand,
          revision: lessonInput.revision,
          updatedAt: lessonInput.updatedAt,
        },
      ],
      { lessonInput, duplicate: false },
      lessonInput,
      { lessonInput: { ...lessonInput, revision: 2 }, duplicate: false },
    ];
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const api: LessonInputApi = createHttpLessonQuestApi({
      baseUrl: 'https://play.lessonquest.test',
      getAuthorization: () => 'Bearer synthetic',
      fetch: (input, init) => {
        requests.push({
          url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        });
        return Promise.resolve(
          new Response(JSON.stringify(responses.shift()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      },
    });
    const createInput = {
      mutationId,
      title: lessonInput.title,
      gradeBand: lessonInput.gradeBand,
      learningContent: lessonInput.learningContent,
      learningObjectives: lessonInput.learningObjectives,
    };

    await expect(api.listLessonInputs(organizationId)).resolves.toHaveLength(1);
    await expect(api.createLessonInput(organizationId, createInput)).resolves.toMatchObject({
      lessonInput: { revision: 1 },
      duplicate: false,
    });
    await expect(api.getLessonInput(organizationId, lessonInputId)).resolves.toEqual(lessonInput);
    await expect(
      api.updateLessonInput(organizationId, lessonInputId, {
        ...createInput,
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ lessonInput: { revision: 2 } });
    expect(requests).toEqual([
      {
        url: `https://play.lessonquest.test/organizations/${organizationId}/lesson-inputs`,
        method: 'GET',
        body: undefined,
      },
      {
        url: `https://play.lessonquest.test/organizations/${organizationId}/lesson-inputs`,
        method: 'POST',
        body: createInput,
      },
      {
        url: `https://play.lessonquest.test/organizations/${organizationId}/lesson-inputs/${lessonInputId}`,
        method: 'GET',
        body: undefined,
      },
      {
        url: `https://play.lessonquest.test/organizations/${organizationId}/lesson-inputs/${lessonInputId}`,
        method: 'PUT',
        body: { ...createInput, expectedRevision: 1 },
      },
    ]);
  });

  it('rejects malformed successful lesson-input values at the HTTP boundary', async () => {
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://play.lessonquest.test',
      getAuthorization: () => null,
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify([{ ...lessonInput, privateTeacherNote: 'leak' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
    });

    await expect(api.listLessonInputs(organizationId)).rejects.toThrow();
  });

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

  it('never accepts leaked invitation data from a dashboard response', async () => {
    const org = '018f72a4-cc52-7c5a-a6f9-8b21aa27fb01',
      classId = '018f72a4-cc52-7c5a-a6f9-8b21aa27fb02';
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://play.lessonquest.test',
      getAuthorization: () => null,
      fetch: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              lessonClass: { id: classId, organizationId: org, name: '합성반' },
              memberCount: 0,
              assignments: [],
              invitation: null,
              code: 'private',
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        ),
    });
    await expect(api.getClassDashboard(org, classId)).rejects.toThrow();
  });

  it('parses aggregate boss responses and sends no tenant-owned hint fields', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            campaignId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fb02',
            title: '보스',
            targetHp: 100,
            damage: 3,
            completed: false,
            studentId: 'leak',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createHttpLessonQuestApi({
      baseUrl: 'https://play.lessonquest.test',
      getAuthorization: () => 'Bearer synthetic',
    });
    await expect(
      api.getStudentBossProgress(
        '018f72a4-cc52-7c5a-a6f9-8b21aa27fb01',
        '018f72a4-cc52-7c5a-a6f9-8b21aa27fb03',
      ),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
