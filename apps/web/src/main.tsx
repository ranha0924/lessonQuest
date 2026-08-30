import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import { createHttpLessonQuestApi } from './api-client.js';
import { DemoShell } from './demo-shell.js';
import './styles.css';

declare global {
  interface Window {
    lessonQuestSession?: {
      readonly authorization: string;
      readonly role: 'TEACHER' | 'STUDENT';
      readonly organizationId: string;
      readonly classId: string;
    };
  }
}

const rootElement = document.querySelector('#root');
if (rootElement === null) {
  throw new Error('LessonQuest root element is missing');
}

const environment = import.meta.env as unknown as Record<string, unknown>;
const demoMode = environment['VITE_DEMO_MODE'] === 'true';
const session = window.lessonQuestSession;
if (demoMode) {
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
        role={session.role}
        organizationId={session.organizationId}
        classId={session.classId}
      />
    </StrictMode>,
  );
}
