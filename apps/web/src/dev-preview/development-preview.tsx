import { useMemo, useState } from 'react';
import { StudioWorkbench } from '../components/studio-workbench.js';
import { StudentPlay } from '../components/student-play.js';
import type { PreviewRuntime } from './runtime.js';
import { CosmicShell } from '../components/cosmic-shell.js';
import { ClassroomManager } from '../components/classroom-manager.js';
import { JoinClass } from '../components/join-class.js';
import './preview.css';

export function DevelopmentPreview({
  runtime,
  reset,
}: {
  readonly runtime: PreviewRuntime;
  readonly reset: () => void;
}) {
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [teacherVisit, setTeacherVisit] = useState(0);
  const [classId, setClassId] = useState(runtime.classId);
  const [classroomsOpen, setClassroomsOpen] = useState(false);
  const [studentVisit, setStudentVisit] = useState(0);
  // A refreshed client reference reloads the existing boss panel when the teacher returns.
  // The method closures always retain the same teacher identity, including in-flight work.
  const teacherApi = useMemo(() => ({ ...runtime.teacherApi }), [runtime, teacherVisit]);
  const selectTeacher = () => {
    setClassroomsOpen(false);
    if (role !== 'TEACHER') {
      setTeacherVisit((value) => value + 1);
      setRole('TEACHER');
    }
  };
  return (
    <CosmicShell
      role={role}
      previewControls={
        <nav className="cosmic-role-nav" aria-label="개발 미리보기 역할">
          <button
            type="button"
            aria-pressed={role === 'TEACHER' && !classroomsOpen}
            onClick={selectTeacher}
          >
            <span aria-hidden="true">◇</span>교사 화면
          </button>
          <button
            type="button"
            aria-pressed={role === 'TEACHER' && classroomsOpen}
            onClick={() => {
              if (role !== 'TEACHER') setTeacherVisit((value) => value + 1);
              setRole('TEACHER');
              setClassroomsOpen(true);
            }}
          >
            반 관리
          </button>
          <button
            type="button"
            aria-pressed={role === 'STUDENT'}
            onClick={() => setRole('STUDENT')}
          >
            <span aria-hidden="true">↗</span>학생 화면
          </button>
          <button className="cosmic-reset" type="button" onClick={reset}>
            데이터 초기화
          </button>
        </nav>
      }
    >
      <div className="development-preview">
        <aside className="preview-notice" aria-label="개발 환경 안내">
          <div>
            <h2>개발용 서비스 미리보기</h2>
            <p>가상 데이터 · 새로고침하면 초기화됩니다. 실제 학생 정보를 입력하지 마세요.</p>
          </div>
          <details>
            <summary>이용 안내</summary>
            <p>
              가상 교사·학생 계정과 데이터가 이 탭 안에서만 동작합니다. 실제 로그인·영구 저장·외부
              AI는 연결되지 않았습니다. Rasa는 정해진 로컬 힌트를 제공합니다.
            </p>
            <p>
              샘플 JSON을 저장 → 검증 → 승인 → 반에 배포한 뒤 학생 화면에서 플레이하고, 교사
              화면으로 돌아와 결과를 확인하세요.
            </p>
          </details>
        </aside>
        {role === 'TEACHER' && classroomsOpen ? (
          <ClassroomManager
            api={teacherApi}
            organizationId={runtime.organizationId}
            classId={classId}
            onSelect={setClassId}
          />
        ) : null}
        <div hidden={role !== 'TEACHER' || classroomsOpen}>
          <StudioWorkbench
            key={classId}
            api={teacherApi}
            organizationId={runtime.organizationId}
            classId={classId}
            initialDraft={runtime.sampleDraft}
          />
        </div>
        {role === 'STUDENT' ? (
          <>
            <StudentPlay
              key={studentVisit}
              api={runtime.studentApi}
              organizationId={runtime.organizationId}
            />
            <JoinClass
              api={runtime.studentApi}
              organizationId={runtime.organizationId}
              onJoined={() => setStudentVisit((value) => value + 1)}
            />
          </>
        ) : null}
      </div>
    </CosmicShell>
  );
}
