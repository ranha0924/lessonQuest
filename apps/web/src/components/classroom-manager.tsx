import { useEffect, useRef, useState } from 'react';
import type { ClassDashboard, ClassroomSummary, StudentProgress } from '@lessonquest/contracts';
import type { ClassroomApi, LessonQuestApi } from '../api-client.js';
import { TeacherProgress } from './teacher-progress.js';
import '../classrooms.css';

export function ClassroomManager({
  api,
  organizationId,
  classId,
  onSelect,
  active = true,
}: {
  readonly api: ClassroomApi & Pick<LessonQuestApi, 'listTeacherProgress'>;
  readonly organizationId: string;
  readonly classId: string;
  readonly onSelect: (classId: string) => void;
  readonly active?: boolean;
}) {
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [dashboard, setDashboard] = useState<ClassDashboard | null>(null);
  const [name, setName] = useState('');
  const [maxUses, setMaxUses] = useState(30);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [progress, setProgress] = useState<StudentProgress[] | null>(null);
  const epoch = useRef(0);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const current = ++epoch.current;
    setClasses([]);
    setDashboard(null);
    setCode(null);
    setProgress(null);
    setError('');
    setMessage('');
    setBusy(active);
    if (active) {
      void api
        .listClasses(organizationId)
        .then(async (items) => {
          if (epoch.current !== current) return;
          setClasses(items);
          if (!items.some((item) => item.id === classId)) {
            const first = items[0];
            if (first !== undefined) select.current(first.id);
            return;
          }
          const result = await api.getClassDashboard(organizationId, classId);
          if (epoch.current === current) setDashboard(result);
        })
        .catch(() => {
          if (epoch.current === current) {
            setClasses([]);
            setDashboard(null);
            setError('반 현황을 불러오지 못했습니다. 권한과 연결을 확인하고 다시 시도해 주세요.');
          }
        })
        .finally(() => {
          if (epoch.current === current) setBusy(false);
        });
    }
    return () => {
      epoch.current++;
    };
  }, [api, organizationId, classId, revision, active]);

  const run = async (operation: (current: number) => Promise<void>) => {
    if (busy) return;
    const current = epoch.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation(current);
    } catch {
      if (current === epoch.current)
        setError(
          '요청 결과를 확인하지 못했습니다. 다시 시도하거나 반 현황을 새로고침해 주세요. 초대 재발급은 이전 코드를 취소합니다.',
        );
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  };

  return (
    <section className="classroom-manager" aria-label="반 관리">
      <header className="classroom-heading">
        <div>
          <p className="eyebrow">CLASSROOM STATION</p>
          <h2>우리 반 관리</h2>
          <p>초대로 모이고, 함께 배운 과정을 확인하세요.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setDashboard(null);
            setCode(null);
            setProgress(null);
            setRevision((value) => value + 1);
          }}
        >
          반 현황 새로고침
        </button>
      </header>
      <div className="classroom-controls panel">
        <label>
          수업할 반
          <select
            aria-label="수업할 반"
            value={classes.some((item) => item.id === classId) ? classId : ''}
            disabled={busy || classes.length === 0}
            onChange={(event) => onSelect(event.target.value)}
          >
            {classes.length === 0 ? (
              <option value="">반을 만들어 주세요</option>
            ) : (
              classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async (current) => {
              const created = await api.createClass(organizationId, { name });
              if (current === epoch.current) {
                setClasses((items) => [...items, created]);
                setName('');
                onSelect(created.id);
              }
            });
          }}
        >
          <label>
            새 반 이름
            <input
              value={name}
              maxLength={80}
              required
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || name.trim() === ''}>
            반 만들기
          </button>
        </form>
      </div>
      {busy ? <p role="status">반 정보를 확인하고 있습니다.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {dashboard ? (
        <div className="panel classroom-dashboard">
          <header>
            <h3>{dashboard.lessonClass.name} 현황</h3>
            <p>현재 학생 {dashboard.memberCount}명</p>
          </header>
          <details className="classroom-invite" open>
            <summary>학생 초대</summary>
            <p>코드는 24시간 동안 유효합니다. 재발급하면 이전 코드는 사용할 수 없습니다.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setCode(null);
                void run(async (current) => {
                  const issued = await api.issueClassInvitation(organizationId, classId, {
                    maxUses,
                  });
                  if (current === epoch.current) {
                    setCode(issued.code);
                    setDashboard((value) =>
                      value === null ? null : { ...value, invitation: issued.invitation },
                    );
                  }
                });
              }}
            >
              <label>
                초대 인원 한도
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  disabled={busy}
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.valueAsNumber)}
                />
              </label>
              <button type="submit" disabled={busy}>
                {dashboard.invitation ? '초대 코드 재발급' : '초대 코드 발급'}
              </button>
              {dashboard.invitation ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const invitationId = dashboard.invitation?.id;
                    if (!invitationId) return;
                    setCode(null);
                    void run(async (current) => {
                      await api.revokeClassInvitation(organizationId, classId, invitationId);
                      if (current === epoch.current) {
                        setDashboard((value) =>
                          value === null ? null : { ...value, invitation: null },
                        );
                        setMessage('초대를 취소했습니다.');
                      }
                    });
                  }}
                >
                  초대 취소
                </button>
              ) : null}
            </form>
            {dashboard.invitation ? (
              <p>
                새로 참여한 학생 {dashboard.invitation.uses} / {dashboard.invitation.maxUses}명 ·
                만료 {new Date(dashboard.invitation.expiresAt).toLocaleString('ko-KR')}
              </p>
            ) : null}
            {code ? (
              <div className="invitation-secret">
                <p>
                  아래 코드를 복사해 학생에게 전달하세요. 이 화면을 벗어나면 다시 표시하지 않습니다.
                </p>
                <output aria-label="발급된 초대 코드">{code}</output>
              </div>
            ) : null}
          </details>
          <h3>반 과제 현황</h3>
          <p>현재 활성 학생의 학습 기록입니다. 개인 순위를 표시하지 않습니다.</p>
          {dashboard.assignments.length === 0 ? (
            <p>아직 배포한 과제가 없습니다. 교사 화면의 제작소에서 탐험을 준비하세요.</p>
          ) : (
            dashboard.assignments.map((item) => (
              <article
                className="classroom-assignment"
                key={item.assignmentId}
                aria-label={`${item.title} 반 현황`}
              >
                <h4>{item.title}</h4>
                <p>
                  시작 {item.startedCount}명 ·{' '}
                  <strong>
                    완료 {item.completedCount} / {dashboard.memberCount}명
                  </strong>
                </p>
                <p>
                  오답 합계 {item.wrongAnswers}회 · 재도전 합계 {item.retries}회 · 힌트 합계{' '}
                  {item.hintsUsed}회
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setProgress(null);
                    void run(async (current) => {
                      const items = await api.listTeacherProgress(
                        organizationId,
                        classId,
                        item.assignmentId,
                      );
                      if (current === epoch.current) setProgress(items);
                    });
                  }}
                >
                  학습 과정 보기: {item.title}
                </button>
              </article>
            ))
          )}
          {progress !== null ? <TeacherProgress items={progress} /> : null}
        </div>
      ) : null}
    </section>
  );
}
