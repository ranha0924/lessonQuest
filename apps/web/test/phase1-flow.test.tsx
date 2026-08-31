// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { uuidSchema } from '@lessonquest/contracts';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudioWorkbench } from '../src/components/studio-workbench.js';
import { StudentPlay } from '../src/components/student-play.js';
import { TeacherProgress } from '../src/components/teacher-progress.js';
import { ClassBossCard } from '../src/components/class-boss-card.js';
import { createM56Fixture, m56Origin, m56Student, m56TeacherToken } from './m5-m6-fixture.js';
import {
  answerWrong,
  campaignInput,
  connectPhase1,
  enterLesson,
  hintEffects,
  type Phase1Fixture,
} from './phase1-fixture.js';

describe('Phase 1 full local learning flow', () => {
  let fixture: Phase1Fixture;
  beforeEach(async () => {
    fixture = await createM56Fixture();
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await fixture.database.close();
  });

  it('creates a tenant and class through authenticated API, then authors, approves, plays and reviews through React', async () => {
    const post = (path: string, body: unknown) =>
      fixture.app.request(path, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${m56TeacherToken}`,
          origin: m56Origin,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    const organizationResponse = await post('/organizations', { name: '전체 흐름 합성학교' });
    expect(organizationResponse.status).toBe(201);
    const organization = (await organizationResponse.json()) as { id: unknown };
    const organizationId = uuidSchema.parse(organization.id);
    const classResponse = await post(`/organizations/${organizationId}/classes`, {
      name: '마무리반',
    });
    expect(classResponse.status).toBe(201);
    const lessonClass = (await classResponse.json()) as { id: unknown };
    const classId = uuidSchema.parse(lessonClass.id);
    expect(
      (
        await post(`/organizations/${organizationId}/classes/${classId}/members`, {
          userId: m56Student.userId,
        })
      ).status,
    ).toBe(204);
    const { teacherApi, studentApi } = connectPhase1(fixture);
    const teacherView = render(
      <StudioWorkbench api={teacherApi} organizationId={organizationId} classId={classId} />,
    );
    expect(screen.getByRole('button', { name: '승인' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '반에 배포' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('체험 제목'), {
      target: { value: 'Phase 1 전체 흐름' },
    });
    fireEvent.change(screen.getByLabelText('생성된 과학 JSON'), {
      target: {
        value: await readFile(
          join(process.cwd(), 'packages/science-studio/test/fixtures/force-motion.json'),
          'utf8',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    await screen.findByText('초안이 생성됐습니다.');
    fireEvent.click(screen.getByRole('button', { name: '독립 검증' }));
    const preview = await screen.findByTitle('과학 체험 격리 미리보기');
    expect(preview.getAttribute('sandbox')).toBe('allow-scripts');
    expect(preview.getAttribute('referrerpolicy')).toBe('no-referrer');
    const previewDocument = new DOMParser().parseFromString(
      preview.getAttribute('srcdoc')!,
      'text/html',
    );
    expect(
      previewDocument
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute('content'),
    ).toContain("default-src 'none'");
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    await screen.findByText('교사 승인 완료');
    fireEvent.click(screen.getByRole('button', { name: '반에 배포' }));
    await screen.findByText('반 배포 완료');
    fireEvent.change(screen.getByLabelText('캠페인 유형'), { target: { value: 'SPECIAL' } });
    fireEvent.change(screen.getByLabelText('목표 HP'), { target: { value: '100' } });
    expect(screen.getByLabelText('특별 캠페인 버전')).toHaveProperty('value', '1');
    fireEvent.change(screen.getByLabelText('캠페인 유형'), { target: { value: 'WEEKLY' } });
    expect(screen.getByLabelText('주 시작일')).toHaveProperty('value', '2026-08-24');
    fireEvent.change(screen.getByLabelText('캠페인 유형'), { target: { value: 'SPECIAL' } });
    expect(screen.getByLabelText('특별 캠페인 버전')).toHaveProperty('value', '1');
    fireEvent.click(screen.getByRole('button', { name: '보스 시작' }));
    await screen.findByText('공동 보스를 시작했습니다.');
    teacherView.container.hidden = true;

    const studentView = render(<StudentPlay api={studentApi} organizationId={organizationId} />);
    await enterLesson('Phase 1 전체 흐름');
    await answerWrong();
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
    studentView.unmount();
    const resumed = render(<StudentPlay api={studentApi} organizationId={organizationId} />);
    await enterLesson('Phase 1 전체 흐름', true);
    await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('재도전 성공');
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('탐험을 완료했습니다!');
    await fixture.gamification.drainPendingJobs();
    const aggregate = await studentApi.getStudentBossProgress(organizationId, classId);
    expect(aggregate).toMatchObject({ damage: 8, targetHp: 100 });
    expect(Object.keys(aggregate ?? {}).sort()).toEqual([
      'campaignId',
      'completed',
      'damage',
      'targetHp',
      'title',
    ]);
    const playerAssignments = await studentApi.listStudentAssignments(organizationId);
    expect(playerAssignments).toHaveLength(1);
    expect(playerAssignments[0]?.attemptStatus).toBe('COMPLETED');
    const rows = await fixture.database.query(
      'SELECT type,sequence FROM learning_events WHERE organization_id=$1 ORDER BY sequence',
      [organizationId],
    );
    expect(rows.rows).toEqual([
      { type: 'EXPERIENCE_STARTED', sequence: 0 },
      { type: 'QUESTION_ANSWERED', sequence: 1 },
      { type: 'RASA_OPENED', sequence: 2 },
      { type: 'HINT_USED', sequence: 3 },
      { type: 'ANSWER_RETRIED', sequence: 4 },
      { type: 'EXPERIENCE_COMPLETED', sequence: 5 },
    ]);
    resumed.unmount();
    teacherView.container.hidden = false;
    fireEvent.click(screen.getByRole('button', { name: '교사 결과 보기' }));
    const progress = await screen.findByRole('region', { name: '학습 과정 기록' });
    expect(within(progress).getByText('오답 1회')).toBeTruthy();
    expect(within(progress).getByText('재도전 1회')).toBeTruthy();
    expect(within(progress).getByText('힌트 1회')).toBeTruthy();
    expect(within(progress).getByText('완료')).toBeTruthy();
    expect(within(progress).queryByText(/순위|랭킹|1위/)).toBeNull();
    expect(await hintEffects(fixture)).toEqual([
      { requests: 1, actions: 1, usage: 1, hints: 1, opened: 1 },
    ]);
  });

  it('credits a genuinely correct first answer without a hint or retry and shows persisted teacher evidence', async () => {
    const { studentApi, teacherApi, deliveries } = connectPhase1(fixture);
    await teacherApi.createBossCampaign(
      fixture.organization.id,
      fixture.lessonClass.id,
      campaignInput,
    );
    const student = render(
      <StudentPlay api={studentApi} organizationId={fixture.organization.id} />,
    );
    await enterLesson();
    expect(screen.queryByRole('button', { name: '힌트 받기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('정답이에요!');
    expect(screen.queryByRole('button', { name: '힌트 받기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('탐험을 완료했습니다!');
    await fixture.gamification.drainPendingJobs();
    const aggregate = await studentApi.getStudentBossProgress(
      fixture.organization.id,
      fixture.lessonClass.id,
    );
    expect(aggregate).toMatchObject({ damage: 7, targetHp: 100 });
    const detail = await teacherApi.getTeacherBossDetail(
      fixture.organization.id,
      fixture.lessonClass.id,
    );
    expect(detail.contributions).toEqual([
      {
        studentId: m56Student.userId,
        damage: 7,
        reasons: ['answer_correct', 'experience_completed'],
      },
    ]);
    expect(await hintEffects(fixture)).toEqual([
      { requests: 0, actions: 0, usage: 0, hints: 0, opened: 0 },
    ]);
    expect(deliveries.filter(({ path }) => path.endsWith('/rasa/hints'))).toHaveLength(0);
    expect(
      (await fixture.database.query('SELECT type,sequence FROM learning_events ORDER BY sequence'))
        .rows,
    ).toEqual([
      { type: 'EXPERIENCE_STARTED', sequence: 0 },
      { type: 'QUESTION_ANSWERED', sequence: 1 },
      { type: 'EXPERIENCE_COMPLETED', sequence: 2 },
    ]);
    student.unmount();
    render(
      <>
        <ClassBossCard progress={aggregate} />
        <TeacherProgress
          items={await teacherApi.listTeacherProgress(
            fixture.organization.id,
            fixture.lessonClass.id,
            fixture.assignment.id,
          )}
        />
      </>,
    );
    expect(screen.getByText('7 / 100')).toBeTruthy();
    expect(screen.getByText('오답 0회')).toBeTruthy();
    expect(screen.getByText('재도전 0회')).toBeTruthy();
    expect(screen.getByText('힌트 0회')).toBeTruthy();
    expect(screen.getByText('완료')).toBeTruthy();
  });
});
