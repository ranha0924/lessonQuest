import { useMemo, useState } from 'react';
import { CosmicShell } from './components/cosmic-shell.js';
import type { LessonQuestApi, ClassroomApi } from './api-client.js';
import { StudentPlay } from './components/student-play.js';
import { StudioWorkbench } from './components/studio-workbench.js';
import { ClassroomManager } from './components/classroom-manager.js';
import { JoinClass } from './components/join-class.js';

interface AppProps {
  readonly api: LessonQuestApi;
  readonly role: 'TEACHER' | 'STUDENT';
  readonly organizationId: string;
  readonly classId: string;
  readonly classroomApi?: ClassroomApi;
}

export function App(props: AppProps) {
  return <AppSession key={`${props.organizationId}:${props.role}:${props.classId}`} {...props} />;
}

function AppSession({ api, role, organizationId, classId, classroomApi }: AppProps) {
  const [selectedClassId, setSelectedClassId] = useState(classId);
  const [classroomsOpen, setClassroomsOpen] = useState(false);
  const [studentVisit, setStudentVisit] = useState(0);
  const managerApi = useMemo(
    () =>
      classroomApi === undefined
        ? undefined
        : { ...classroomApi, listTeacherProgress: api.listTeacherProgress.bind(api) },
    [api, classroomApi],
  );
  return (
    <CosmicShell role={role}>
      {role === 'TEACHER' ? (
        <>
          {managerApi ? (
            <div className="classroom-manager">
              <button type="button" onClick={() => setClassroomsOpen((value) => !value)}>
                {classroomsOpen ? '제작소로 돌아가기' : '반 관리'}
              </button>
            </div>
          ) : null}
          {managerApi && classroomsOpen ? (
            <ClassroomManager
              api={managerApi}
              organizationId={organizationId}
              classId={selectedClassId}
              onSelect={setSelectedClassId}
            />
          ) : null}
          <div hidden={classroomsOpen}>
            <StudioWorkbench
              key={selectedClassId}
              api={api}
              organizationId={organizationId}
              classId={selectedClassId}
            />
          </div>
        </>
      ) : (
        <>
          <StudentPlay key={studentVisit} api={api} organizationId={organizationId} />
          {classroomApi ? (
            <JoinClass
              api={classroomApi}
              organizationId={organizationId}
              onJoined={() => setStudentVisit((value) => value + 1)}
            />
          ) : null}
        </>
      )}
    </CosmicShell>
  );
}
