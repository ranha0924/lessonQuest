// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { scienceBlockSpecSchema } from '@lessonquest/contracts';

import { StudioWorkbench } from '../src/components/studio-workbench.js';
import { StudentPlay } from '../src/components/student-play.js';
import { TeacherProgress } from '../src/components/teacher-progress.js';
import { ClassBossCard } from '../src/components/class-boss-card.js';
import { RasaHintPanel } from '../src/components/rasa-hint-panel.js';
import { BossCampaignPanel } from '../src/components/boss-campaign-panel.js';
import type { LessonQuestApi, StudentScienceSpecification } from '../src/api-client.js';

const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c101';
const classId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c102';
const assignmentId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c103';
const versionId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c104';
const attemptId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c105';
const submittedEvents: Array<{ type: string; sequence: number; optionId?: string }> = [];

afterEach(() => {
  cleanup();
});

const specification: StudentScienceSpecification = {
  schemaVersion: 1,
  title: '힘과 운동',
  gradeBand: 'middle1',
  unit: 'force_and_motion',
  learningObjectives: [{ id: 'objective_force', text: '힘과 운동을 설명한다.' }],
  blocks: [
    {
      id: 'concept_force',
      kind: 'CONCEPT_CARD',
      title: '힘은 움직임을 바꿔요',
      body: '가벼운 물체가 더 크게 움직여요.',
      objectiveIds: ['objective_force'],
    },
    {
      id: 'predict_force',
      kind: 'PREDICTION',
      prompt: '어느 손수레가 더 멀리 갈까요?',
      choices: [
        { id: 'light', label: '가벼운 손수레' },
        { id: 'heavy', label: '무거운 손수레' },
      ],
      objectiveIds: ['objective_force'],
    },
    {
      id: 'simulate_force',
      kind: 'SIMULATION',
      model: 'FORCE_MOTION',
      prompt: '이동 거리를 비교해 보세요.',
      parameters: { massKg: 2, forceN: 6, durationSec: 3 },
      objectiveIds: ['objective_force'],
    },
    {
      id: 'quiz_force',
      kind: 'QUIZ',
      question: '가속도가 더 큰 물체는?',
      options: [
        { id: 'light', label: '질량 2 kg' },
        { id: 'heavy', label: '질량 6 kg' },
      ],
      objectiveIds: ['objective_force'],
    },
    {
      id: 'reflect_force',
      kind: 'REFLECTION',
      prompt: '생활 속 예를 적어 보세요.',
      objectiveIds: ['objective_force'],
    },
  ],
};

const teacherSpecification = scienceBlockSpecSchema.parse({
  ...specification,
  blocks: specification.blocks.map((block) =>
    block.kind === 'QUIZ'
      ? {
          ...block,
          options: block.options.map((option, index) => ({ ...option, correct: index === 0 })),
          explanation: '가벼운 물체가 같은 힘에서 더 크게 가속합니다.',
        }
      : block,
  ),
});

function createApi(
  options: {
    attempt?: Awaited<ReturnType<LessonQuestApi['startAttempt']>>;
    assignmentAttemptStatus?: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | null;
  } = {},
): LessonQuestApi {
  return {
    createScienceExperience() {
      return Promise.resolve({
        experienceId: assignmentId,
        publicId: 'science_force_01',
        versionId,
        version: 1,
        status: 'GENERATED',
        contentHash: `sha256:${'a'.repeat(64)}`,
      });
    },
    validateExperienceVersion() {
      return Promise.resolve({
        versionId,
        status: 'VALIDATED',
        report: { policyVersion: 'science-validator-1', verdict: 'PASS', findings: [] },
      });
    },
    getExperiencePreview() {
      return Promise.resolve({
        versionId,
        status: 'VALIDATED',
        contentHash: `sha256:${'a'.repeat(64)}`,
        specification: teacherSpecification,
        sandboxDocument: '<!doctype html><p>안전한 미리보기</p>',
        validationReport: { policyVersion: 'science-validator-1', verdict: 'PASS', findings: [] },
      });
    },
    reviewExperienceVersion() {
      return Promise.resolve({ versionId, status: 'APPROVED' });
    },
    createAssignment() {
      return Promise.resolve({
        id: assignmentId,
        organizationId,
        classId,
        experienceVersionId: versionId,
        startsAt: '2026-08-29T12:00:00.000Z',
        dueAt: null,
        status: 'ACTIVE',
      });
    },
    listStudentAssignments() {
      return Promise.resolve([
        {
          id: assignmentId,
          organizationId,
          classId,
          experienceVersionId: versionId,
          startsAt: '2026-08-29T12:00:00.000Z',
          dueAt: null,
          status: 'ACTIVE',
          title: '힘과 운동',
          attemptStatus: options.assignmentAttemptStatus ?? null,
        },
      ]);
    },
    startAttempt() {
      return Promise.resolve(
        options.attempt ?? {
          id: attemptId,
          assignmentId,
          status: 'READY',
          resumed: false,
          nextSequence: 0,
          answers: [],
          rasa: { enabled: true, maxHintLevel: 2, hints: [] },
        },
      );
    },
    getPlayer() {
      return Promise.resolve({
        assignmentId,
        attemptId,
        experienceId: 'science_force_01',
        experienceVersion: 1,
        contentHash: `sha256:${'a'.repeat(64)}`,
        specification,
        sandboxDocument: '<!doctype html><p>플레이어</p>',
      });
    },
    ingestEvent(event) {
      const optionId =
        event.type === 'QUESTION_ANSWERED' || event.type === 'ANSWER_RETRIED'
          ? event.payload.optionId
          : undefined;
      submittedEvents.push(
        optionId === undefined
          ? { type: event.type, sequence: event.sequence }
          : { type: event.type, sequence: event.sequence, optionId },
      );
      return Promise.resolve({
        accepted: true,
        duplicate: false,
        answer:
          event.type === 'QUESTION_ANSWERED' || event.type === 'ANSWER_RETRIED'
            ? {
                stepId: event.stepId,
                attempt: event.payload.attempt,
                correct: optionId === 'light',
              }
            : null,
        nextSequence: event.sequence + 1,
      });
    },
    listTeacherProgress() {
      return Promise.resolve([
        {
          assignmentId,
          studentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c106',
          started: true,
          wrongAnswers: 1,
          retries: 1,
          completed: true,
          lastSequence: 3,
          lastStepId: 'complete',
          projectionVersion: 4,
          hintsUsed: 0,
          updatedAt: '2026-08-29T12:00:00.000Z',
        },
      ]);
    },
    requestRasaHint() {
      return Promise.reject(new Error('not configured'));
    },
    getStudentBossProgress() {
      return Promise.resolve(null);
    },
    createBossCampaign() {
      return Promise.reject(new Error('not configured'));
    },
    endBossCampaign() {
      return Promise.reject(new Error('not configured'));
    },
    getTeacherBossDetail() {
      return Promise.reject(new Error('not configured'));
    },
  };
}

describe('BossCampaignPanel', () => {
  it('loads and ends an active campaign, then offers a special replacement', async () => {
    const api = createApi();
    const detail = {
      campaign: {
        campaignId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c190',
        title: '관성 보스',
        targetHp: 600,
        damage: 12,
        completed: false,
        status: 'ACTIVE' as const,
        policy: {
          amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 },
        },
      },
      contributions: [],
      projectionHealth: { pending: 0, failed: 0 },
    };
    api.getTeacherBossDetail = vi.fn().mockResolvedValue(detail);
    const endBossCampaign = vi
      .fn<LessonQuestApi['endBossCampaign']>()
      .mockResolvedValue({ ...detail, campaign: { ...detail.campaign, status: 'ENDED' } });
    api.endBossCampaign = endBossCampaign;
    render(<BossCampaignPanel api={api} organizationId={organizationId} classId={classId} />);
    expect(await screen.findByText('12 / 600')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '보스 종료' }));
    expect(await screen.findByRole('button', { name: '보스 시작' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('캠페인 유형'), { target: { value: 'SPECIAL' } });
    expect(screen.getByLabelText('특별 캠페인 버전')).toBeTruthy();
    expect(endBossCampaign).toHaveBeenCalledOnce();
  });
});

describe('StudioWorkbench', () => {
  it('moves a teacher through generated, validated, previewed, approved, and assigned states', async () => {
    render(<StudioWorkbench api={createApi()} organizationId={organizationId} classId={classId} />);
    expect(screen.getByLabelText('Rasa 힌트 사용')).toHaveProperty('checked', true);
    expect(screen.getByLabelText('최대 힌트 단계')).toHaveProperty('value', '2');

    fireEvent.change(screen.getByLabelText('체험 제목'), { target: { value: '힘과 운동' } });
    fireEvent.change(screen.getByLabelText('생성된 과학 JSON'), {
      target: { value: '{"schemaVersion":1}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    expect(await screen.findByText('초안이 생성됐습니다.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '독립 검증' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('검증 통과'));
    const preview = screen.getByTitle('과학 체험 격리 미리보기');
    expect(preview.getAttribute('sandbox')).toBe('allow-scripts');

    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(await screen.findByText('교사 승인 완료')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '반에 배포' }));
    expect(await screen.findByText('반 배포 완료')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '교사 결과 보기' }));
    expect(await screen.findByRole('heading', { name: '학습 과정 기록' })).toBeTruthy();
    expect(screen.getByText('오답 1회')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('체험 제목'), { target: { value: '새 초안' } });
    fireEvent.change(screen.getByLabelText('생성된 과학 JSON'), {
      target: { value: '{"schemaVersion":1,"title":"새 초안"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('초안이 생성됐습니다.'),
    );
    expect(screen.queryByTitle('과학 체험 격리 미리보기')).toBeNull();
    expect(screen.getByRole('button', { name: '반에 배포' })).toHaveProperty('disabled', true);
  });
});

describe('StudentPlay', () => {
  it('shows student home, starts the player, records the retry path, and completes accessibly', async () => {
    submittedEvents.length = 0;
    render(<StudentPlay api={createApi()} organizationId={organizationId} />);

    const card = await screen.findByRole('article', { name: '힘과 운동' });
    fireEvent.click(within(card).getByRole('button', { name: '탐험 시작' }));
    expect(await screen.findByRole('heading', { name: '힘과 운동' })).toBeTruthy();
    expect(screen.getByText('탐험 진행 중')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
    expect(await screen.findByText('다시 생각해 볼까요?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    expect(await screen.findByText('재도전 성공')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    expect(await screen.findByText('탐험을 완료했습니다!')).toBeTruthy();
    await waitFor(() => {
      expect(submittedEvents).toEqual([
        { type: 'EXPERIENCE_STARTED', sequence: 0 },
        { type: 'QUESTION_ANSWERED', sequence: 1, optionId: 'heavy' },
        { type: 'ANSWER_RETRIED', sequence: 2, optionId: 'light' },
        { type: 'EXPERIENCE_COMPLETED', sequence: 3 },
      ]);
    });
  });

  it('resumes an in-progress wrong answer without sending a second start event', async () => {
    submittedEvents.length = 0;
    const api = createApi({
      assignmentAttemptStatus: 'IN_PROGRESS',
      attempt: {
        id: attemptId,
        assignmentId,
        status: 'IN_PROGRESS',
        resumed: true,
        nextSequence: 2,
        answers: [{ stepId: 'quiz_force', attempts: 1, correct: false }],
        rasa: { enabled: true, maxHintLevel: 2, hints: [] },
      },
    });
    render(<StudentPlay api={api} organizationId={organizationId} />);

    const card = await screen.findByRole('article', { name: '힘과 운동' });
    fireEvent.click(within(card).getByRole('button', { name: '이어하기' }));
    expect(await screen.findByText('다시 생각해 볼까요?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    expect(await screen.findByText('재도전 성공')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));

    await waitFor(() => {
      expect(submittedEvents).toEqual([
        { type: 'ANSWER_RETRIED', sequence: 2, optionId: 'light' },
        { type: 'EXPERIENCE_COMPLETED', sequence: 3 },
      ]);
    });
  });

  it('marks completed assignments without reopening the player', async () => {
    render(
      <StudentPlay
        api={createApi({ assignmentAttemptStatus: 'COMPLETED' })}
        organizationId={organizationId}
      />,
    );

    const card = await screen.findByRole('article', { name: '힘과 운동' });
    expect(within(card).getByRole('button', { name: '완료됨' })).toHaveProperty('disabled', true);
  });
});

describe('TeacherProgress', () => {
  it('shows process evidence without exposing a public student rank', () => {
    render(
      <TeacherProgress
        items={[
          {
            assignmentId,
            studentId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c106',
            started: true,
            wrongAnswers: 1,
            retries: 1,
            completed: true,
            lastSequence: 3,
            lastStepId: 'complete',
            projectionVersion: 4,
            hintsUsed: 0,
            updatedAt: '2026-08-29T12:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('오답 1회')).toBeTruthy();
    expect(screen.getByText('재도전 1회')).toBeTruthy();
    expect(screen.getByText('완료')).toBeTruthy();
    expect(screen.queryByText(/1위|순위|랭킹/)).toBeNull();
  });
});

describe('M5/M6 student components', () => {
  it('renders hint content as text and only aggregate boss progress', () => {
    render(
      <>
        <RasaHintPanel
          hints={[{ stepId: 'quiz_force', level: 1, content: '<img src=x onerror=alert(1)>' }]}
          available
          pending={false}
          exhausted={false}
          onRequest={() => undefined}
        />
        <ClassBossCard
          progress={{
            campaignId: assignmentId,
            title: '관성 보스',
            targetHp: 100,
            damage: 25,
            completed: false,
          }}
        />
      </>,
    );
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('25 / 100')).toBeTruthy();
    expect(screen.queryByText(/순위|학생 ID|기여 목록/)).toBeNull();
  });
});
