// @vitest-environment jsdom
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalAuthProvider } from '@lessonquest/auth';
import { createApp } from '../../../services/api/src/app.js';
import { createClassroomFixture } from '../../../packages/db/test/classroom-fixture.js';
import { createHttpLessonQuestApi } from '../src/api-client.js';
import { ClassroomManager } from '../src/components/classroom-manager.js';
import { JoinClass } from '../src/components/join-class.js';
import { StudentPlay } from '../src/components/student-play.js';

const origin = 'https://classrooms.lessonquest.test';
let f: Awaited<ReturnType<typeof createClassroomFixture>>;
let app: ReturnType<typeof createApp>;
let failAfterJoin = false;
let failAfterIssue = false;
let failDashboard = false;
const token = (role: string) => `dev_${role.repeat(32)}`;
beforeEach(async () => {
  f = await createClassroomFixture();
  app = createApp({
    repository: f.tenants,
    learningRepository: f.learning,
    classroomRepository: f.classrooms,
    auth: new LocalAuthProvider({
      environment: 'test',
      sessions: new Map([
        [token('t'), f.teacher],
        [token('s'), f.student],
      ]),
    }),
    trustedOrigin: origin,
    diagnostics: { record() {} },
  });
  failAfterJoin = false;
  failAfterIssue = false;
  failDashboard = false;
});
afterEach(async () => {
  cleanup();
  await f?.database.close();
});
const api = (role: string) =>
  createHttpLessonQuestApi({
    baseUrl: origin,
    getAuthorization: () => `Bearer ${token(role)}`,
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (failDashboard && url.endsWith('/dashboard')) throw new TypeError('synthetic offline');
      const headers = new Headers(init?.headers);
      headers.set('origin', origin);
      const response = await app.request(url, { ...init, headers });
      if (failAfterJoin && url.endsWith('/redeem')) {
        failAfterJoin = false;
        throw new TypeError('synthetic lost response');
      }
      if (failAfterIssue && url.endsWith('/invitations')) {
        failAfterIssue = false;
        throw new TypeError('synthetic lost response');
      }
      return response;
    },
  });

describe('classroom UI through HTTP and PGlite', () => {
  it('publishes to a new class, enrolls through an invite, plays, and reads real dashboard counts', async () => {
    const teacherApi = api('t'),
      studentApi = api('s');
    let selected = f.lessonClass.id;
    const view = render(
      <ClassroomManager
        api={teacherApi}
        organizationId={f.organization.id}
        classId={selected}
        onSelect={(id) => {
          selected = id;
        }}
      />,
    );
    await screen.findByText('현재 학생 0명');
    fireEvent.change(screen.getByLabelText('새 반 이름'), { target: { value: '별빛 탐험반' } });
    fireEvent.click(screen.getByRole('button', { name: '반 만들기' }));
    await waitFor(() => expect(selected).not.toBe(f.lessonClass.id));
    view.rerender(
      <ClassroomManager
        api={teacherApi}
        organizationId={f.organization.id}
        classId={selected}
        onSelect={() => undefined}
      />,
    );
    await screen.findByRole('heading', { name: '별빛 탐험반 현황' });
    fireEvent.click(screen.getByRole('button', { name: '초대 코드 발급' }));
    const code = (await screen.findByLabelText('발급된 초대 코드')).textContent ?? '';
    expect(code).toMatch(/^lqi_/);
    const generatedSpecText = await readFile(
      'packages/science-studio/test/fixtures/force-motion.json',
      'utf8',
    );
    const version = await teacherApi.createScienceExperience(f.organization.id, {
      title: '새 반 학습',
      generatedSpecText,
    });
    await teacherApi.validateExperienceVersion(f.organization.id, version.versionId);
    await teacherApi.reviewExperienceVersion(f.organization.id, version.versionId, {
      decision: 'APPROVE',
    });
    const assignment = await teacherApi.createAssignment(f.organization.id, selected, {
      experienceVersionId: version.versionId,
    });
    view.unmount();
    let joined = 0;
    const joinView = render(
      <JoinClass
        api={studentApi}
        organizationId={f.organization.id}
        onJoined={() => {
          joined++;
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText('초대 코드'), { target: { value: code } });
    failAfterJoin = true;
    fireEvent.click(screen.getByRole('button', { name: '반 참여하기' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '반 참여하기' }));
    await waitFor(() => expect(joined).toBe(1));
    expect(screen.getByLabelText<HTMLInputElement>('초대 코드').value).toBe('');
    joinView.unmount();
    const player = render(<StudentPlay api={studentApi} organizationId={f.organization.id} />);
    fireEvent.click(await screen.findByRole('button', { name: '탐험 시작' }));
    fireEvent.click(await screen.findByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('정답이에요!');
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('탐험을 완료했습니다!');
    player.unmount();
    const result = await teacherApi.getClassDashboard(f.organization.id, selected);
    expect(result).toMatchObject({
      memberCount: 1,
      invitation: { uses: 1 },
      assignments: [
        {
          assignmentId: assignment.id,
          startedCount: 1,
          completedCount: 1,
          wrongAnswers: 0,
          retries: 0,
          hintsUsed: 0,
        },
      ],
    });
    render(
      <ClassroomManager
        api={teacherApi}
        organizationId={f.organization.id}
        classId={selected}
        onSelect={() => undefined}
      />,
    );
    await screen.findByText('완료 1 / 1명');
    expect(screen.queryByText(f.student.userId)).toBeNull();
    // Removing current membership excludes that student's historic projection.
    await f.database.query(
      "UPDATE class_members SET status='DISABLED' WHERE class_id=$1 AND user_id=$2",
      [selected, f.student.userId],
    );
    fireEvent.click(screen.getByRole('button', { name: '반 현황 새로고침' }));
    await screen.findByText('완료 0 / 0명');
  });

  it('recovers a lost issuance by rotating, revokes, and clears stale private content on read failure', async () => {
    const teacherApi = api('t');
    render(
      <ClassroomManager
        api={teacherApi}
        organizationId={f.organization.id}
        classId={f.lessonClass.id}
        onSelect={() => undefined}
      />,
    );
    await screen.findByText('현재 학생 0명');
    failAfterIssue = true;
    fireEvent.click(screen.getByRole('button', { name: '초대 코드 발급' }));
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('발급된 초대 코드')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /초대 코드 (발급|재발급)/ }));
    const code = (await screen.findByLabelText('발급된 초대 코드')).textContent ?? '';
    expect(
      (
        await f.database.query(
          "SELECT count(*)::int n FROM class_invitations WHERE status='ACTIVE'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
    fireEvent.click(screen.getByRole('button', { name: '초대 취소' }));
    await screen.findByText('초대를 취소했습니다.');
    expect(screen.queryByLabelText('발급된 초대 코드')).toBeNull();
    await expect(
      f.classrooms.redeemInvitation(f.student, f.organization.id, { code }, randomUUID()),
    ).rejects.toThrow();
    failDashboard = true;
    fireEvent.click(screen.getByRole('button', { name: '반 현황 새로고침' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: '탐험 1반 현황' })).toBeNull();
  });
});
