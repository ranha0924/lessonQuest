import type { LessonQuestApi } from './api-client.js';
import { StudentPlay } from './components/student-play.js';
import { StudioWorkbench } from './components/studio-workbench.js';

interface AppProps {
  readonly api: LessonQuestApi;
  readonly role: 'TEACHER' | 'STUDENT';
  readonly organizationId: string;
  readonly classId: string;
}

export function App({ api, role, organizationId, classId }: AppProps) {
  return role === 'TEACHER' ? (
    <StudioWorkbench api={api} organizationId={organizationId} classId={classId} />
  ) : (
    <StudentPlay api={api} organizationId={organizationId} />
  );
}
