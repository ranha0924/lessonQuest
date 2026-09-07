import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  createLessonInputInputSchema,
  updateLessonInputInputSchema,
  type CreateLessonInputInput,
  type LessonInput,
  type LessonInputSummary,
  type SupportedGradeBand,
  type UpdateLessonInputInput,
} from '@lessonquest/contracts';

import { LessonQuestApiError, type LessonInputApi } from '../api-client.js';
import '../lesson-inputs.css';

const gradeBands: ReadonlyArray<{ value: SupportedGradeBand; label: string }> = [
  { value: 'elementary1', label: '초등학교 1학년' },
  { value: 'elementary2', label: '초등학교 2학년' },
  { value: 'elementary3', label: '초등학교 3학년' },
  { value: 'elementary4', label: '초등학교 4학년' },
  { value: 'elementary5', label: '초등학교 5학년' },
  { value: 'elementary6', label: '초등학교 6학년' },
  { value: 'middle1', label: '중학교 1학년' },
  { value: 'middle2', label: '중학교 2학년' },
  { value: 'middle3', label: '중학교 3학년' },
  { value: 'high1', label: '고등학교 1학년' },
  { value: 'high2', label: '고등학교 2학년' },
  { value: 'high3', label: '고등학교 3학년' },
];

type FieldName = 'title' | 'gradeBand' | 'learningContent' | 'learningObjectives';
type FieldErrors = Partial<Record<FieldName, string>>;
type PendingMutation =
  | { readonly kind: 'create'; readonly input: CreateLessonInputInput }
  | {
      readonly kind: 'update';
      readonly lessonInputId: string;
      readonly input: UpdateLessonInputInput;
    };
type Recovery = 'retry' | 'conflict' | null;

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

function toSummary(resource: LessonInput): LessonInputSummary {
  return {
    id: resource.id,
    title: resource.title,
    gradeBand: resource.gradeBand,
    revision: resource.revision,
    updatedAt: resource.updatedAt,
  };
}

function validationMessage(field: FieldName): string {
  switch (field) {
    case 'title':
      return '수업 제목은 120자 이내로 입력해 주세요.';
    case 'gradeBand':
      return '지원하는 대상 학년을 선택해 주세요.';
    case 'learningContent':
      return '학습 내용은 32,768자 이내로 입력해 주세요.';
    case 'learningObjectives':
      return '학습목표는 중복 없이 8개까지, 한 줄당 300자 이내로 입력해 주세요.';
  }
}

export function LessonInputWorkspace({
  api,
  organizationId,
}: {
  readonly api: LessonInputApi;
  readonly organizationId: string;
}) {
  const [items, setItems] = useState<LessonInputSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loaded, setLoaded] = useState<LessonInput | null>(null);
  const [title, setTitle] = useState('');
  const [gradeBand, setGradeBand] = useState<SupportedGradeBand | ''>('');
  const [learningContent, setLearningContent] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<Recovery>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('저장된 수업 자료를 불러오는 중입니다.');
  const generationRef = useRef(0);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    const request = ++listRequestRef.current;
    detailRequestRef.current += 1;
    setItems([]);
    setSelectedId('');
    setLoaded(null);
    setTitle('');
    setGradeBand('');
    setLearningContent('');
    setObjectivesText('');
    setPendingMutation(null);
    setBusy(false);
    setRecovery(null);
    setFieldErrors({});
    setError(null);
    setStatus('저장된 수업 자료를 불러오는 중입니다.');
    void api
      .listLessonInputs(organizationId)
      .then((nextItems) => {
        if (generationRef.current !== generation || listRequestRef.current !== request) return;
        setItems(nextItems);
        setStatus(
          nextItems.length === 0
            ? '아직 저장된 수업 자료가 없습니다.'
            : `저장된 수업 자료 ${nextItems.length}개를 불러왔습니다.`,
        );
      })
      .catch((caught: unknown) => {
        if (generationRef.current !== generation || listRequestRef.current !== request) return;
        setError(messageFrom(caught));
        setStatus('새 수업 자료는 계속 작성할 수 있습니다.');
      });
    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [api, organizationId]);

  const applyResource = (resource: LessonInput) => {
    setLoaded(resource);
    setSelectedId(resource.id);
    setTitle(resource.title);
    setGradeBand(resource.gradeBand);
    setLearningContent(resource.learningContent);
    setObjectivesText(resource.learningObjectives.join('\n'));
    setItems((current) => {
      const next = [toSummary(resource), ...current.filter((item) => item.id !== resource.id)];
      return next.sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id),
      );
    });
  };

  const clearEditor = () => {
    setLoaded(null);
    setSelectedId('');
    setTitle('');
    setGradeBand('');
    setLearningContent('');
    setObjectivesText('');
    setPendingMutation(null);
    setRecovery(null);
    setFieldErrors({});
    setError(null);
    setStatus('새 수업 자료를 작성해 주세요.');
  };

  const openSelected = (authoritativeConflictReload = false) => {
    const lessonInputId = authoritativeConflictReload
      ? pendingMutation?.kind === 'update'
        ? pendingMutation.lessonInputId
        : loaded?.id
      : selectedId;
    if (lessonInputId === undefined || lessonInputId === '') return;
    const generation = generationRef.current;
    const request = ++detailRequestRef.current;
    setBusy(true);
    setError(null);
    setStatus('수업 자료를 다시 불러오는 중입니다.');
    void api
      .getLessonInput(organizationId, lessonInputId)
      .then((resource) => {
        if (generationRef.current !== generation || detailRequestRef.current !== request) return;
        listRequestRef.current += 1;
        applyResource(resource);
        setPendingMutation(null);
        setRecovery(null);
        setFieldErrors({});
        setStatus(`서버 저장본을 다시 열었습니다. 개정 ${resource.revision}`);
      })
      .catch((caught: unknown) => {
        if (generationRef.current !== generation || detailRequestRef.current !== request) return;
        setError(messageFrom(caught));
        setStatus('현재 작성 중인 내용은 그대로 유지했습니다.');
      })
      .finally(() => {
        if (generationRef.current === generation && detailRequestRef.current === request) {
          setBusy(false);
        }
      });
  };

  const buildMutation = (): PendingMutation | null => {
    if (pendingMutation !== null) return pendingMutation;
    const learningObjectives = objectivesText
      .split('\n')
      .map((objective) => objective.trim())
      .filter((objective) => objective.length > 0);
    const requiredErrors: FieldErrors = {};
    if (title.trim().length === 0) requiredErrors.title = '수업 제목을 입력해 주세요.';
    if (gradeBand === '') requiredErrors.gradeBand = '대상 학년을 선택해 주세요.';
    if (learningContent.trim().length === 0) {
      requiredErrors.learningContent = '학습 내용을 입력해 주세요.';
    }
    if (learningObjectives.length === 0) {
      requiredErrors.learningObjectives = '학습목표를 한 줄 이상 입력해 주세요.';
    }
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      setError('입력 항목을 확인해 주세요.');
      setStatus('표시된 항목을 고친 뒤 다시 저장해 주세요.');
      return null;
    }
    const fields = {
      mutationId: crypto.randomUUID(),
      title,
      gradeBand,
      learningContent,
      learningObjectives,
    };
    const parsed =
      loaded === null
        ? createLessonInputInputSchema.safeParse(fields)
        : updateLessonInputInputSchema.safeParse({
            ...fields,
            expectedRevision: loaded.revision,
          });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === 'title' ||
          field === 'gradeBand' ||
          field === 'learningContent' ||
          field === 'learningObjectives'
        ) {
          nextErrors[field] = validationMessage(field);
        }
      }
      setFieldErrors(nextErrors);
      setError('입력 항목을 확인해 주세요.');
      setStatus('표시된 항목을 고친 뒤 다시 저장해 주세요.');
      return null;
    }
    return loaded === null
      ? { kind: 'create', input: parsed.data }
      : {
          kind: 'update',
          lessonInputId: loaded.id,
          input: parsed.data as UpdateLessonInputInput,
        };
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const mutation = buildMutation();
    if (mutation === null) return;
    const generation = generationRef.current;
    setPendingMutation(mutation);
    setBusy(true);
    setRecovery(null);
    setFieldErrors({});
    setError(null);
    setStatus('수업 자료를 저장하는 중입니다.');
    const operation =
      mutation.kind === 'create'
        ? api.createLessonInput(organizationId, mutation.input)
        : api.updateLessonInput(organizationId, mutation.lessonInputId, mutation.input);
    void operation
      .then(({ lessonInput, duplicate }) => {
        if (generationRef.current !== generation) return;
        listRequestRef.current += 1;
        detailRequestRef.current += 1;
        applyResource(lessonInput);
        setPendingMutation(null);
        setRecovery(null);
        setStatus(
          duplicate
            ? `저장 결과를 확인했습니다. 개정 ${lessonInput.revision}`
            : `수업 자료를 저장했습니다. 개정 ${lessonInput.revision}`,
        );
      })
      .catch((caught: unknown) => {
        if (generationRef.current !== generation) return;
        if (
          caught instanceof LessonQuestApiError &&
          caught.status === 409 &&
          caught.code === 'RESOURCE_CONFLICT'
        ) {
          setRecovery('conflict');
          setError(
            '다른 저장본과 충돌했습니다. 현재 입력은 그대로 유지했습니다. 서버 저장본을 다시 불러와 확인해 주세요.',
          );
          setStatus('서버 저장본을 확인하기 전에는 이 입력을 변경하거나 다시 저장할 수 없습니다.');
          return;
        }
        if (!(caught instanceof LessonQuestApiError) || caught.retryable) {
          setRecovery('retry');
          setError(
            `${messageFrom(caught)} 저장 결과를 확인할 수 없습니다. 같은 내용으로 다시 저장해 주세요.`,
          );
          setStatus('입력은 잠겼으며 같은 요청을 안전하게 다시 보낼 수 있습니다.');
          return;
        }
        setPendingMutation(null);
        setRecovery(null);
        setError(messageFrom(caught));
        setStatus('입력 내용을 고친 뒤 새 저장 요청을 보낼 수 있습니다.');
      })
      .finally(() => {
        if (generationRef.current === generation) setBusy(false);
      });
  };

  const editorLocked = busy || recovery !== null;
  const saveDisabled = busy || recovery === 'conflict';

  return (
    <section className="lesson-input-workspace" aria-labelledby="lesson-input-title">
      <header className="lesson-input-workspace__heading">
        <div>
          <p>교사 수업 설계 노트</p>
          <h2 id="lesson-input-title">수업 자료 준비</h2>
        </div>
        {loaded === null ? null : (
          <span className="lesson-input-workspace__revision">개정 {loaded.revision}</span>
        )}
      </header>

      <div className="lesson-input-workspace__grid">
        <aside className="lesson-input-workspace__library">
          <label htmlFor="lesson-input-library">저장된 수업 자료</label>
          <select
            id="lesson-input-library"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={busy || recovery !== null}
          >
            <option value="">자료를 선택하세요</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · 개정 {item.revision}
              </option>
            ))}
          </select>
          <div className="lesson-input-workspace__library-actions">
            <button type="button" onClick={clearEditor} disabled={busy || recovery !== null}>
              새 수업 자료
            </button>
            <button
              type="button"
              onClick={() => openSelected(false)}
              disabled={busy || recovery !== null || selectedId === ''}
            >
              수업 자료 다시 열기
            </button>
          </div>
          <p>저장본을 선택한 뒤 다시 열면 서버의 최신 내용을 확인합니다.</p>
        </aside>

        <form className="lesson-input-workspace__editor" onSubmit={save} noValidate>
          <label htmlFor="lesson-input-title-field">수업 제목</label>
          <input
            id="lesson-input-title-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={editorLocked}
            aria-invalid={fieldErrors.title === undefined ? undefined : true}
            aria-describedby={fieldErrors.title === undefined ? undefined : 'lesson-title-error'}
          />
          {fieldErrors.title === undefined ? null : (
            <p className="lesson-input-workspace__field-error" id="lesson-title-error">
              {fieldErrors.title}
            </p>
          )}

          <label htmlFor="lesson-input-grade">대상 학년</label>
          <select
            id="lesson-input-grade"
            value={gradeBand}
            onChange={(event) => setGradeBand(event.target.value as SupportedGradeBand | '')}
            disabled={editorLocked}
            aria-invalid={fieldErrors.gradeBand === undefined ? undefined : true}
            aria-describedby={
              fieldErrors.gradeBand === undefined ? undefined : 'lesson-grade-error'
            }
          >
            <option value="">대상 학년을 선택하세요</option>
            {gradeBands.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
          {fieldErrors.gradeBand === undefined ? null : (
            <p className="lesson-input-workspace__field-error" id="lesson-grade-error">
              {fieldErrors.gradeBand}
            </p>
          )}

          <label htmlFor="lesson-input-content">학습 내용</label>
          <textarea
            id="lesson-input-content"
            value={learningContent}
            onChange={(event) => setLearningContent(event.target.value)}
            disabled={editorLocked}
            rows={10}
            aria-invalid={fieldErrors.learningContent === undefined ? undefined : true}
            aria-describedby={
              fieldErrors.learningContent === undefined ? undefined : 'lesson-content-error'
            }
          />
          {fieldErrors.learningContent === undefined ? null : (
            <p className="lesson-input-workspace__field-error" id="lesson-content-error">
              {fieldErrors.learningContent}
            </p>
          )}

          <label htmlFor="lesson-input-objectives">학습목표 (한 줄에 하나)</label>
          <textarea
            id="lesson-input-objectives"
            value={objectivesText}
            onChange={(event) => setObjectivesText(event.target.value)}
            disabled={editorLocked}
            rows={6}
            aria-invalid={fieldErrors.learningObjectives === undefined ? undefined : true}
            aria-describedby={
              fieldErrors.learningObjectives === undefined ? undefined : 'lesson-objectives-error'
            }
          />
          {fieldErrors.learningObjectives === undefined ? null : (
            <p className="lesson-input-workspace__field-error" id="lesson-objectives-error">
              {fieldErrors.learningObjectives}
            </p>
          )}

          <div className="lesson-input-workspace__save-actions">
            <button className="primary" type="submit" disabled={saveDisabled}>
              {loaded === null ? '수업 자료 저장' : '수정 내용 저장'}
            </button>
            {recovery === 'conflict' ? (
              <button type="button" onClick={() => openSelected(true)} disabled={busy}>
                서버 저장본 다시 불러오기
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {error === null ? null : (
        <p className="lesson-input-workspace__alert" role="alert">
          {error}
        </p>
      )}
      <p className="lesson-input-workspace__status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
