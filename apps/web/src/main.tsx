import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import { createHttpLessonQuestApi } from './api-client.js';
import { DemoShell } from './demo-shell.js';
import { registerLessonQuestServiceWorker, warmLessonQuestServiceWorker } from './pwa.js';
import './styles.css';
import './demo-shell.css';
import './cosmic-service.css';

declare global {
  interface Window {
    lessonQuestSession?: {
      readonly authorization: string;
      readonly role: 'TEACHER' | 'STUDENT';
      readonly organizationId: string;
      readonly classId: string;
      readonly offlineQueueKey?: string;
    };
  }
}

const rootElement = document.querySelector('#root');
if (rootElement === null) {
  throw new Error('LessonQuest root element is missing');
}

const environment = import.meta.env as unknown as Record<string, unknown>;
const demoMode = environment['VITE_DEMO_MODE'] === 'true';
const developmentPreview = import.meta.env.VITE_DEV_PREVIEW === 'true';
const session = window.lessonQuestSession;
void registerLessonQuestServiceWorker(developmentPreview || (!demoMode && session !== undefined))
  .then((registration) =>
    registration === null ? undefined : warmLessonQuestServiceWorker().catch(() => undefined),
  )
  .catch(() => undefined);
if (developmentPreview) {
  const root = createRoot(rootElement);
  root.render(
    <main className="configuration-notice">
      <h1>개발용 서비스 미리보기</h1>
      <p role="status">개발 화면을 불러오고 있습니다.</p>
    </main>,
  );
  void import('./dev-preview/mount.js')
    .then(({ mountDevelopmentPreview }) => mountDevelopmentPreview(root))
    .catch(() => {
      root.render(
        <main className="configuration-notice">
          <h1>개발 화면을 불러오지 못했습니다.</h1>
          <p>연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button type="button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </main>,
      );
    });
} else if (demoMode) {
  createRoot(rootElement).render(
    <StrictMode>
      <DemoShell />
    </StrictMode>,
  );
} else if (session === undefined) {
  createRoot(rootElement).render(
    <main className="configuration-notice">
      <h1>LessonQuest</h1>
      <p>로컬 인증 호스트에서 세션을 준비한 뒤 다시 열어 주세요.</p>
    </main>,
  );
} else {
  const configuredBaseUrl: unknown = environment['VITE_API_BASE_URL'];
  const api = createHttpLessonQuestApi({
    baseUrl: typeof configuredBaseUrl === 'string' ? configuredBaseUrl : window.location.origin,
    getAuthorization: () => session.authorization,
  });
  createRoot(rootElement).render(
    <StrictMode>
      <App
        api={api}
        classroomApi={api}
        role={session.role}
        organizationId={session.organizationId}
        classId={session.classId}
        {...(session.offlineQueueKey === undefined
          ? {}
          : { offlineQueueKey: session.offlineQueueKey })}
      />
    </StrictMode>,
  );
}
