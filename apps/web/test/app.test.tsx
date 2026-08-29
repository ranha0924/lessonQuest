// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StudioWorkbench } from '../src/components/studio-workbench.js';
import { StudentPlay } from '../src/components/student-play.js';
import { TeacherProgress } from '../src/components/teacher-progress.js';
import type { LessonQuestApi } from '../src/api-client.js';

const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c101';
const classId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c102';
const assignmentId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c103';
const versionId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c104';
const attemptId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c105';
const submittedEventTypes: string[] = [];

afterEach(() => {
  cleanup();
});

const specification = {
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
} as const;

function createApi(): LessonQuestApi {
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
        specification,
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
          attemptStatus: null,
        },
      ]);
    },
    startAttempt() {
      return Promise.resolve({ id: attemptId, assignmentId, status: 'READY', resumed: false });
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
      submittedEventTypes.push(event.type);
      return Promise.resolve({ accepted: true, duplicate: false });
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
          updatedAt: '2026-08-29T12:00:00.000Z',
        },
      ]);
    },
  };
}

describe('StudioWorkbench', () => {
  it('moves a teacher through generated, validated, previewed, approved, and assigned states', async () => {
    render(<StudioWorkbench api={createApi()} organizationId={organizationId} classId={classId} />);

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
  });
});

describe('StudentPlay', () => {
  it('shows student home, starts the player, records the retry path, and completes accessibly', async () => {
    submittedEventTypes.length = 0;
    render(<StudentPlay api={createApi()} organizationId={organizationId} />);

    const card = await screen.findByRole('article', { name: '힘과 운동' });
    fireEvent.click(within(card).getByRole('button', { name: '탐험 시작' }));
    expect(await screen.findByRole('heading', { name: '힘과 운동' })).toBeTruthy();
    expect(screen.getByText('탐험 진행 중')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
    expect(await screen.findByText('다시 생각해 볼까요?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 도전' }));
    expect(await screen.findByText('재도전 성공')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    expect(await screen.findByText('탐험을 완료했습니다!')).toBeTruthy();
    await waitFor(() => {
      expect(submittedEventTypes).toEqual([
        'EXPERIENCE_STARTED',
        'QUESTION_ANSWERED',
        'ANSWER_RETRIED',
        'EXPERIENCE_COMPLETED',
      ]);
    });
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
