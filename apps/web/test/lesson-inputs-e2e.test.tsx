// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { createApp } from '@lessonquest/api';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor, CreateLessonInputInput, UpdateLessonInputInput } from '@lessonquest/contracts';
import {
  ClassroomRepository,
  GamificationRepository,
  initializeSchema,
  LearningRepository,
  LessonInputRepository,
  RasaRepository,
  TenantRepository,
} from '@lessonquest/db';
import { LocalRasaProvider } from '@lessonquest/rasa';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createHttpLessonQuestApi } from '../src/api-client.js';
import { StudioWorkbench } from '../src/components/studio-workbench.js';

const origin = 'https://lesson-inputs.lessonquest.test';
const teacherToken = `dev_${'t'.repeat(32)}`;
const studentToken = `dev_${'s'.repeat(32)}`;
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e501',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e502',
  platformRole: 'STUDENT',
  memberships: [],
};

type Delivery = {
  readonly method: string;
  readonly path: string;
  readonly body: string | undefined;
};

async function createFixture(options: { loseCreateAndUpdateOnce?: boolean } = {}) {
  const database = new PGlite();
  await initializeSchema(database);
  const tenants = new TenantRepository(database);
  const learning = new LearningRepository(database);
  const gamification = new GamificationRepository(database);
  const lessonInputs = new LessonInputRepository(database);
  await tenants.upsertUser(teacher);
  await tenants.upsertUser(student);
  const organization = await tenants.createOrganization(teacher, 'F01 합성 학교');
  const lessonClass = await tenants.createClass(teacher, organization.id, 'F01 합성반');
  await tenants.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);
  const app = createApp({
    auth: new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [teacherToken, teacher],
        [studentToken, student],
      ]),
    }),
    repository: tenants,
    classroomRepository: new ClassroomRepository(database),
    learningRepository: learning,
    lessonInputRepository: lessonInputs,
    rasaRepository: new RasaRepository(database),
    gamificationRepository: gamification,
    rasaProvider: new LocalRasaProvider(),
    trustedOrigin: origin,
    diagnostics: { record() {} },
  });
  const deliveries: Delivery[] = [];
  let loseCreate = options.loseCreateAndUpdateOnce === true;
  let loseUpdate = options.loseCreateAndUpdateOnce === true;
  const transport: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set('origin', origin);
    const method = request.method;
    const path = new URL(request.url).pathname;
    const body = typeof init?.body === 'string' ? init.body : undefined;
    deliveries.push({ method, path, body });
    const response = await app.request(request.url, { ...init, method, headers });
    if (method === 'POST' && path.endsWith('/lesson-inputs') && loseCreate) {
      loseCreate = false;
      throw new TypeError('create response lost after commit');
    }
    if (method === 'PUT' && path.includes('/lesson-inputs/') && loseUpdate) {
      loseUpdate = false;
      throw new TypeError('update response lost after commit');
    }
    return response;
  };
  const api = (token: string) =>
    createHttpLessonQuestApi({
      baseUrl: origin,
      getAuthorization: () => `Bearer ${token}`,
      fetch: transport,
    });
  return {
    database,
    organization,
    lessonClass,
    teacherApi: api(teacherToken),
    studentApi: api(studentToken),
    deliveries,
    async close() {
      await database.close();
    },
  };
}

function fillLessonInput(
  fields: {
    title?: string;
    gradeBand?: string;
    learningContent?: string;
    objectives?: string;
  } = {},
) {
  fireEvent.change(screen.getByLabelText('수업 제목'), {
    target: { value: fields.title ?? '합성 힘과 운동 수업' },
  });
  fireEvent.change(screen.getByLabelText('대상 학년'), {
    target: { value: fields.gradeBand ?? 'middle1' },
  });
  fireEvent.change(screen.getByLabelText('학습 내용'), {
    target: { value: fields.learningContent ?? '합성 자료로 힘과 질량의 관계를 비교한다.' },
  });
  fireEvent.change(screen.getByLabelText('학습목표 (한 줄에 하나)'), {
    target: {
      value: fields.objectives ?? '힘과 질량의 관계를 설명한다.\n관찰 결과를 근거로 예측한다.',
    },
  });
}

function expectGeneratedTrailUnchanged(sampleText: string) {
  expect(screen.getByLabelText('생성된 과학 JSON')).toHaveProperty('value', sampleText);
  expect(screen.getByRole('button', { name: '초안 저장' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '독립 검증' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: '승인' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: '반에 배포' })).toHaveProperty('disabled', true);
}

afterEach(() => cleanup());

describe('lesson input real preview boundary', () => {
  it('saves, unmounts, lists, reopens, revises, and reopens revision 2 without changing generated controls', async () => {
    const fixture = await createFixture();
    const sampleText = await readFile(
      join(process.cwd(), 'packages/science-studio/test/fixtures/force-motion.json'),
      'utf8',
    );
    const studio = () => (
      <StudioWorkbench
        api={fixture.teacherApi}
        lessonInputApi={fixture.teacherApi}
        organizationId={fixture.organization.id}
        classId={fixture.lessonClass.id}
        initialDraft={{ title: '가벼운 손수레 탐험', generatedSpecText: sampleText }}
      />
    );

    try {
      const first = render(studio());
      expectGeneratedTrailUnchanged(sampleText);
      fillLessonInput();
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
      await screen.findByText('수업 자료를 저장했습니다. 개정 1');
      expectGeneratedTrailUnchanged(sampleText);

      const firstRows = await fixture.database.query<{
        title: string;
        learning_content: string;
        revision: number;
      }>('SELECT title, learning_content, revision FROM lesson_inputs');
      expect(firstRows.rows).toEqual([
        {
          title: '합성 힘과 운동 수업',
          learning_content: '합성 자료로 힘과 질량의 관계를 비교한다.',
          revision: 1,
        },
      ]);

      first.unmount();
      const second = render(studio());
      const saved = await screen.findByRole('option', { name: '합성 힘과 운동 수업 · 개정 1' });
      const savedId = saved.getAttribute('value');
      expect(savedId).toBeTruthy();
      fireEvent.change(screen.getByLabelText('저장된 수업 자료'), {
        target: { value: savedId },
      });
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
      await screen.findByText('서버 저장본을 다시 열었습니다. 개정 1');
      expect(screen.getByLabelText('학습 내용')).toHaveProperty(
        'value',
        '합성 자료로 힘과 질량의 관계를 비교한다.',
      );
      expect(screen.getByLabelText('학습목표 (한 줄에 하나)')).toHaveProperty(
        'value',
        '힘과 질량의 관계를 설명한다.\n관찰 결과를 근거로 예측한다.',
      );
      fireEvent.change(screen.getByLabelText('학습 내용'), {
        target: { value: '수정한 합성 자료로 운동 변화를 비교한다.' },
      });
      fireEvent.change(screen.getByLabelText('학습목표 (한 줄에 하나)'), {
        target: { value: '운동 변화를 설명한다.\n수정된 관찰 결과로 예측한다.' },
      });
      fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
      await screen.findByText('수업 자료를 저장했습니다. 개정 2');
      expectGeneratedTrailUnchanged(sampleText);

      const revisedRows = await fixture.database.query<{
        learning_content: string;
        learning_objectives: string[];
        revision: number;
      }>('SELECT learning_content, learning_objectives, revision FROM lesson_inputs');
      expect(revisedRows.rows).toEqual([
        {
          learning_content: '수정한 합성 자료로 운동 변화를 비교한다.',
          learning_objectives: ['운동 변화를 설명한다.', '수정된 관찰 결과로 예측한다.'],
          revision: 2,
        },
      ]);

      second.unmount();
      render(studio());
      const revised = await screen.findByRole('option', {
        name: '합성 힘과 운동 수업 · 개정 2',
      });
      fireEvent.change(screen.getByLabelText('저장된 수업 자료'), {
        target: { value: revised.getAttribute('value') },
      });
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
      await screen.findByText('서버 저장본을 다시 열었습니다. 개정 2');
      expect(screen.getByLabelText('학습 내용')).toHaveProperty(
        'value',
        '수정한 합성 자료로 운동 변화를 비교한다.',
      );
      expect(screen.getByLabelText('학습목표 (한 줄에 하나)')).toHaveProperty(
        'value',
        '운동 변화를 설명한다.\n수정된 관찰 결과로 예측한다.',
      );
    } finally {
      cleanup();
      await fixture.close();
    }
  });

  it('keeps all four F01 routes and saved teacher content unavailable to a student', async () => {
    const fixture = await createFixture();
    const create: CreateLessonInputInput = {
      mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e511',
      title: '교사만 보는 합성 제목',
      gradeBand: 'middle1',
      learningContent: '학생에게 노출되면 안 되는 합성 본문',
      learningObjectives: ['교사 전용 목표'],
    };
    try {
      const created = await fixture.teacherApi.createLessonInput(fixture.organization.id, create);
      render(
        <StudioWorkbench
          api={fixture.studentApi}
          lessonInputApi={fixture.studentApi}
          organizationId={fixture.organization.id}
          classId={fixture.lessonClass.id}
        />,
      );
      await screen.findByRole('alert');
      expect(screen.queryByText(create.title)).toBeNull();
      expect(screen.queryByDisplayValue(create.learningContent)).toBeNull();

      const studentCreate: CreateLessonInputInput = {
        ...create,
        mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e512',
        title: '학생 위조 수업',
      };
      const studentUpdate: UpdateLessonInputInput = {
        ...studentCreate,
        mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27e513',
        expectedRevision: 1,
      };
      const attempts = [
        fixture.studentApi.listLessonInputs(fixture.organization.id),
        fixture.studentApi.createLessonInput(fixture.organization.id, studentCreate),
        fixture.studentApi.getLessonInput(fixture.organization.id, created.lessonInput.id),
        fixture.studentApi.updateLessonInput(
          fixture.organization.id,
          created.lessonInput.id,
          studentUpdate,
        ),
      ];
      for (const attempt of attempts) {
        await expect(attempt).rejects.toMatchObject({
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      expect(
        (
          await fixture.database.query<{
            title: string;
            learning_content: string;
            revision: number;
          }>('SELECT title, learning_content, revision FROM lesson_inputs')
        ).rows,
      ).toEqual([
        {
          title: create.title,
          learning_content: create.learningContent,
          revision: 1,
        },
      ]);
    } finally {
      cleanup();
      await fixture.close();
    }
  });

  it('retries exact create and update mutations once after committed responses are lost', async () => {
    const fixture = await createFixture({ loseCreateAndUpdateOnce: true });
    try {
      render(
        <StudioWorkbench
          api={fixture.teacherApi}
          lessonInputApi={fixture.teacherApi}
          organizationId={fixture.organization.id}
          classId={fixture.lessonClass.id}
        />,
      );
      fillLessonInput({ title: '응답 유실 합성 수업' });
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
      await screen.findByText(/같은 내용으로 다시 저장해 주세요/);
      expect(
        (await fixture.database.query<{ revision: number }>('SELECT revision FROM lesson_inputs'))
          .rows,
      ).toEqual([{ revision: 1 }]);
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
      await screen.findByText('저장 결과를 확인했습니다. 개정 1');

      fireEvent.change(screen.getByLabelText('학습 내용'), {
        target: { value: '응답 유실 뒤 수정한 합성 내용' },
      });
      fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
      await screen.findByText(/같은 내용으로 다시 저장해 주세요/);
      expect(
        (await fixture.database.query<{ revision: number }>('SELECT revision FROM lesson_inputs'))
          .rows,
      ).toEqual([{ revision: 2 }]);
      fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
      await screen.findByText('저장 결과를 확인했습니다. 개정 2');

      const mutations = fixture.deliveries.filter(
        ({ method }) => method === 'POST' || method === 'PUT',
      );
      expect(mutations).toHaveLength(4);
      expect(mutations[1]?.body).toBe(mutations[0]?.body);
      expect(mutations[3]?.body).toBe(mutations[2]?.body);
      expect(
        (
          await fixture.database.query<{ row_count: number; revision: number }>(
            'SELECT count(*)::int AS row_count, max(revision)::int AS revision FROM lesson_inputs',
          )
        ).rows,
      ).toEqual([{ row_count: 1, revision: 2 }]);
    } finally {
      cleanup();
      await fixture.close();
    }
  });
});
