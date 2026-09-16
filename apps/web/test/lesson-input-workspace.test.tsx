// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CreateLessonInputInput,
  LessonInput,
  LessonInputMutationResult,
  LessonInputSummary,
  UpdateLessonInputInput,
} from '@lessonquest/contracts';

import { LessonQuestApiError, type LessonInputApi } from '../src/api-client.js';
import { LessonInputWorkspace } from '../src/components/lesson-input-workspace.js';

const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c201';
const otherOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c202';
const firstId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c211';
const secondId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c212';

const firstLesson: LessonInput = {
  id: firstId,
  organizationId,
  ownerTeacherId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c221',
  title: '힘과 운동',
  gradeBand: 'middle1',
  learningContent: '힘은 물체의 운동 상태를 바꿉니다.',
  learningObjectives: ['힘의 효과를 설명한다.', '힘과 운동의 관계를 관찰한다.'],
  revision: 1,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
};

function summary(value: LessonInput): LessonInputSummary {
  return {
    id: value.id,
    title: value.title,
    gradeBand: value.gradeBand,
    revision: value.revision,
    updatedAt: value.updatedAt,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class ControllableLessonInputApi implements LessonInputApi {
  listResult: Promise<LessonInputSummary[]> = Promise.resolve([]);
  details = new Map<string, LessonInput>([[firstId, firstLesson]]);
  createOutcomes: Array<(input: CreateLessonInputInput) => Promise<LessonInputMutationResult>> = [];
  updateOutcomes: Array<
    (lessonInputId: string, input: UpdateLessonInputInput) => Promise<LessonInputMutationResult>
  > = [];
  createCalls: CreateLessonInputInput[] = [];
  updateCalls: Array<{ lessonInputId: string; input: UpdateLessonInputInput }> = [];
  detailCalls: string[] = [];

  listLessonInputs(): Promise<LessonInputSummary[]> {
    return this.listResult;
  }

  createLessonInput(
    _organizationId: string,
    input: CreateLessonInputInput,
  ): Promise<LessonInputMutationResult> {
    this.createCalls.push(structuredClone(input));
    const outcome = this.createOutcomes.shift();
    if (outcome === undefined) throw new Error('Unexpected create call');
    return outcome(input);
  }

  getLessonInput(_organizationId: string, lessonInputId: string): Promise<LessonInput> {
    this.detailCalls.push(lessonInputId);
    const value = this.details.get(lessonInputId);
    return value === undefined
      ? Promise.reject(new Error('Missing controlled detail'))
      : Promise.resolve(value);
  }

  updateLessonInput(
    _organizationId: string,
    lessonInputId: string,
    input: UpdateLessonInputInput,
  ): Promise<LessonInputMutationResult> {
    this.updateCalls.push({ lessonInputId, input: structuredClone(input) });
    const outcome = this.updateOutcomes.shift();
    if (outcome === undefined) throw new Error('Unexpected update call');
    return outcome(lessonInputId, input);
  }
}

function fillEditor(
  values: {
    title?: string;
    gradeBand?: string;
    learningContent?: string;
    objectives?: string;
  } = {},
) {
  fireEvent.change(screen.getByLabelText('수업 제목'), {
    target: { value: values.title ?? '  힘과 운동 실험  ' },
  });
  fireEvent.change(screen.getByLabelText('대상 학년'), {
    target: { value: values.gradeBand ?? 'middle1' },
  });
  fireEvent.change(screen.getByLabelText('학습 내용'), {
    target: { value: values.learningContent ?? '  힘이 운동에 미치는 영향을 탐구합니다.  ' },
  });
  fireEvent.change(screen.getByLabelText('학습목표 (한 줄에 하나)'), {
    target: {
      value: values.objectives ?? '  힘의 효과를 설명한다.  \n\n 운동 변화를 관찰한다. \n   ',
    },
  });
}

afterEach(() => {
  cleanup();
});

describe('LessonInputWorkspace', () => {
  it('loads the library, exposes labeled empty fields, validates each field, and creates normalized objectives', async () => {
    const api = new ControllableLessonInputApi();
    api.listResult = Promise.resolve([summary(firstLesson)]);
    const created = { ...firstLesson, id: secondId, title: '힘과 운동 실험' };
    api.createOutcomes.push(() => Promise.resolve({ lessonInput: created, duplicate: false }));

    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);

    expect(await screen.findByRole('option', { name: /힘과 운동/ })).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '');
    expect(screen.getByLabelText('대상 학년')).toHaveProperty('value', '');
    expect(screen.getByLabelText('학습 내용')).toHaveProperty('value', '');
    expect(screen.getByLabelText('학습목표 (한 줄에 하나)')).toHaveProperty('value', '');

    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    expect(await screen.findByText('수업 제목을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByText('대상 학년을 선택해 주세요.')).toBeTruthy();
    expect(screen.getByText('학습 내용을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByText('학습목표를 한 줄 이상 입력해 주세요.')).toBeTruthy();
    expect(api.createCalls).toHaveLength(0);

    fillEditor();
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    await waitFor(() => expect(api.createCalls).toHaveLength(1));
    expect(api.createCalls[0]).toMatchObject({
      title: '힘과 운동 실험',
      gradeBand: 'middle1',
      learningContent: '힘이 운동에 미치는 영향을 탐구합니다.',
      learningObjectives: ['힘의 효과를 설명한다.', '운동 변화를 관찰한다.'],
    });
    expect(api.createCalls[0]?.mutationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('개정 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: '수정 내용 저장' })).toBeTruthy();
  });

  it('keeps unsupported text editable with actionable field guidance and saves after correction', async () => {
    const cases = [
      {
        label: '수업 제목',
        values: { title: 'before\u0000after' },
        retained: 'before\u0000after',
        corrected: '교정한 제목',
      },
      {
        label: '학습 내용',
        values: { learningContent: 'before\ud800after' },
        retained: 'before\ud800after',
        corrected: '교정한 학습 내용',
      },
      {
        label: '학습목표 (한 줄에 하나)',
        values: { objectives: 'before\udc00after' },
        retained: 'before\udc00after',
        corrected: '교정한 학습목표',
      },
    ] as const;

    for (const invalid of cases) {
      const api = new ControllableLessonInputApi();
      api.createOutcomes.push(() =>
        Promise.resolve({ lessonInput: firstLesson, duplicate: false }),
      );
      render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
      fillEditor(invalid.values);

      fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
      expect(
        await screen.findByText('지원되지 않는 문자를 지우고 다시 저장해 주세요.'),
      ).toBeTruthy();
      expect(screen.getByLabelText(invalid.label)).toHaveProperty('value', invalid.retained);
      expect(screen.getByLabelText(invalid.label)).toHaveProperty('disabled', false);
      expect(screen.getByRole('button', { name: '새 수업 자료' })).toHaveProperty(
        'disabled',
        false,
      );
      expect(screen.getByRole('button', { name: '수업 자료 저장' })).toHaveProperty(
        'disabled',
        false,
      );
      expect(api.createCalls).toHaveLength(0);

      fireEvent.change(screen.getByLabelText(invalid.label), {
        target: { value: invalid.corrected },
      });
      fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
      await waitFor(() => expect(api.createCalls).toHaveLength(1));
      cleanup();
    }
  });

  it('selects and authoritatively reopens a saved input, then updates its displayed revision', async () => {
    const api = new ControllableLessonInputApi();
    api.listResult = Promise.resolve([summary(firstLesson)]);
    const updated: LessonInput = {
      ...firstLesson,
      title: '수정한 힘과 운동',
      gradeBand: 'middle2',
      learningContent: '수정한 학습 내용',
      learningObjectives: ['수정 목표 1', '수정 목표 2'],
      revision: 2,
      updatedAt: '2026-09-07T11:00:00.000Z',
    };
    api.updateOutcomes.push(() => Promise.resolve({ lessonInput: updated, duplicate: false }));
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);

    const selector = await screen.findByLabelText('저장된 수업 자료');
    fireEvent.change(selector, { target: { value: firstId } });
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
    expect(await screen.findByDisplayValue(firstLesson.learningContent)).toBeTruthy();
    expect(screen.getByText('개정 1')).toBeTruthy();

    fillEditor({
      title: '  수정한 힘과 운동 ',
      gradeBand: 'middle2',
      learningContent: ' 수정한 학습 내용 ',
      objectives: ' 수정 목표 1 \n\n수정 목표 2 ',
    });
    fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
    await waitFor(() => expect(api.updateCalls).toHaveLength(1));
    expect(api.updateCalls[0]).toMatchObject({
      lessonInputId: firstId,
      input: {
        expectedRevision: 1,
        title: '수정한 힘과 운동',
        gradeBand: 'middle2',
        learningContent: '수정한 학습 내용',
        learningObjectives: ['수정 목표 1', '수정 목표 2'],
      },
    });
    expect(await screen.findByText('개정 2')).toBeTruthy();
  });

  it('retries an uncertain create with the identical mutation ID and complete request', async () => {
    const api = new ControllableLessonInputApi();
    const created = { ...firstLesson, id: secondId, title: '힘과 운동 실험' };
    api.createOutcomes.push(
      () =>
        Promise.reject(
          new LessonQuestApiError(503, 'INTERNAL_ERROR', '응답을 확인하지 못했습니다.', true),
        ),
      () => Promise.resolve({ lessonInput: created, duplicate: true }),
    );
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fillEditor();

    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    expect(await screen.findByText(/같은 내용으로 다시 저장/)).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '새 수업 자료' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    await waitFor(() => expect(api.createCalls).toHaveLength(2));
    expect(api.createCalls[1]).toEqual(api.createCalls[0]);
    expect(await screen.findByText('개정 1')).toBeTruthy();
  });

  it('retries an uncertain update against the same target with identical fields and revision', async () => {
    const api = new ControllableLessonInputApi();
    api.listResult = Promise.resolve([summary(firstLesson)]);
    api.updateOutcomes.push(
      () =>
        Promise.reject(new LessonQuestApiError(503, 'INTERNAL_ERROR', '연결이 끊겼습니다.', true)),
      () => Promise.resolve({ lessonInput: { ...firstLesson, revision: 2 }, duplicate: true }),
    );
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fireEvent.change(await screen.findByLabelText('저장된 수업 자료'), {
      target: { value: firstId },
    });
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
    await screen.findByDisplayValue(firstLesson.learningContent);
    fillEditor({ title: '응답 유실 수정본' });

    fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
    expect(await screen.findByText(/같은 내용으로 다시 저장/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
    await waitFor(() => expect(api.updateCalls).toHaveLength(2));
    expect(api.updateCalls[1]).toEqual(api.updateCalls[0]);
    expect(api.updateCalls[1]).toMatchObject({
      lessonInputId: firstId,
      input: { expectedRevision: 1, title: '응답 유실 수정본' },
    });
  });

  it('preserves every local field on conflict and replaces them only after explicit authoritative reload', async () => {
    const api = new ControllableLessonInputApi();
    api.listResult = Promise.resolve([summary(firstLesson)]);
    const authoritative: LessonInput = {
      ...firstLesson,
      title: '서버의 제목',
      gradeBand: 'high1',
      learningContent: '서버에 저장된 내용',
      learningObjectives: ['서버 목표'],
      revision: 3,
    };
    api.updateOutcomes.push(
      () => Promise.reject(new LessonQuestApiError(409, 'RESOURCE_CONFLICT', '개정 충돌', false)),
      () =>
        Promise.resolve({
          lessonInput: { ...authoritative, title: '충돌 뒤 수정', revision: 4 },
          duplicate: false,
        }),
    );
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fireEvent.change(await screen.findByLabelText('저장된 수업 자료'), {
      target: { value: firstId },
    });
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
    await screen.findByDisplayValue(firstLesson.learningContent);
    fillEditor({
      title: '나의 제목',
      gradeBand: 'middle3',
      learningContent: '나의 학습 내용',
      objectives: '나의 목표 1\n나의 목표 2',
    });

    fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
    expect(await screen.findByText(/서버 저장본을 다시 불러와/)).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '나의 제목');
    expect(screen.getByLabelText('대상 학년')).toHaveProperty('value', 'middle3');
    expect(screen.getByLabelText('학습 내용')).toHaveProperty('value', '나의 학습 내용');
    expect(screen.getByLabelText('학습목표 (한 줄에 하나)')).toHaveProperty(
      'value',
      '나의 목표 1\n나의 목표 2',
    );

    api.details.set(firstId, authoritative);
    fireEvent.click(screen.getByRole('button', { name: '서버 저장본 다시 불러오기' }));
    expect(await screen.findByDisplayValue('서버에 저장된 내용')).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '서버의 제목');
    expect(screen.getByLabelText('대상 학년')).toHaveProperty('value', 'high1');
    expect(screen.getByLabelText('학습목표 (한 줄에 하나)')).toHaveProperty('value', '서버 목표');
    expect(screen.getByText('개정 3')).toBeTruthy();
    const conflictedMutationId = api.updateCalls[0]?.input.mutationId;
    fireEvent.change(screen.getByLabelText('수업 제목'), { target: { value: '충돌 뒤 수정' } });
    fireEvent.click(screen.getByRole('button', { name: '수정 내용 저장' }));
    await waitFor(() => expect(api.updateCalls).toHaveLength(2));
    expect(api.updateCalls[1]?.input.mutationId).not.toBe(conflictedMutationId);
    expect(api.updateCalls[1]?.input.expectedRevision).toBe(3);
  });

  it('releases a confirmed 400 mutation so corrected input receives a new UUID', async () => {
    const api = new ControllableLessonInputApi();
    api.createOutcomes.push(
      () =>
        Promise.reject(
          new LessonQuestApiError(400, 'INVALID_INPUT', '내용을 확인해 주세요.', false),
        ),
      () => Promise.resolve({ lessonInput: firstLesson, duplicate: false }),
    );
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fillEditor();
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    expect(await screen.findByText('내용을 확인해 주세요.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('수업 제목'), { target: { value: '교정한 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    await waitFor(() => expect(api.createCalls).toHaveLength(2));
    expect(api.createCalls[1]?.mutationId).not.toBe(api.createCalls[0]?.mutationId);
    expect(api.createCalls[1]?.title).toBe('교정한 제목');
  });

  it('keeps editor text when list or detail loading fails', async () => {
    const api = new ControllableLessonInputApi();
    api.listResult = Promise.reject(new Error('목록 연결 실패'));
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fillEditor({ title: '지우면 안 되는 제목' });
    expect(await screen.findByText('목록 연결 실패')).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '지우면 안 되는 제목');

    api.listResult = Promise.resolve([summary(firstLesson)]);
    cleanup();
    render(<LessonInputWorkspace api={api} organizationId={organizationId} />);
    fillEditor({ title: '상세 실패에도 남는 제목' });
    fireEvent.change(await screen.findByLabelText('저장된 수업 자료'), {
      target: { value: firstId },
    });
    api.details.delete(firstId);
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
    expect(await screen.findByText('Missing controlled detail')).toBeTruthy();
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '상세 실패에도 남는 제목');
  });

  it('ignores stale list and detail responses after the API or organization changes and after unmount', async () => {
    const oldApi = new ControllableLessonInputApi();
    const newApi = new ControllableLessonInputApi();
    const oldDetail = deferred<LessonInput>();
    oldApi.listResult = Promise.resolve([summary(firstLesson)]);
    oldApi.getLessonInput = () => oldDetail.promise;
    newApi.listResult = Promise.resolve([]);
    const view = render(<LessonInputWorkspace api={oldApi} organizationId={organizationId} />);
    fireEvent.change(await screen.findByLabelText('저장된 수업 자료'), {
      target: { value: firstId },
    });
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 다시 열기' }));
    view.rerender(<LessonInputWorkspace api={newApi} organizationId={otherOrganizationId} />);
    oldDetail.resolve(firstLesson);
    await waitFor(() => expect(screen.queryByText(firstLesson.title)).toBeNull());
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '');

    const savingApi = new ControllableLessonInputApi();
    const nextApi = new ControllableLessonInputApi();
    const oldSave = deferred<LessonInputMutationResult>();
    savingApi.createOutcomes.push(() => oldSave.promise);
    view.rerender(<LessonInputWorkspace api={savingApi} organizationId={organizationId} />);
    fillEditor();
    fireEvent.click(screen.getByRole('button', { name: '수업 자료 저장' }));
    view.rerender(<LessonInputWorkspace api={nextApi} organizationId={otherOrganizationId} />);
    oldSave.resolve({ lessonInput: firstLesson, duplicate: false });
    await waitFor(() => expect(screen.queryByText('개정 1')).toBeNull());
    expect(screen.getByLabelText('수업 제목')).toHaveProperty('value', '');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unmountedList = deferred<LessonInputSummary[]>();
    const unmountedApi = new ControllableLessonInputApi();
    unmountedApi.listResult = unmountedList.promise;
    cleanup();
    const unmountedView = render(
      <LessonInputWorkspace api={unmountedApi} organizationId={organizationId} />,
    );
    unmountedView.unmount();
    unmountedList.resolve([summary(firstLesson)]);
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
