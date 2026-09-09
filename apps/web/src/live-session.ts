import type { BrowserIdentity } from './firebase-browser-auth.js';
import { createHttpLessonQuestApi } from './api-client.js';
export function createLiveSession(
  identity: BrowserIdentity,
  isCurrent: () => boolean,
  origin: string,
  transport: typeof fetch = fetch,
) {
  const controller = new AbortController();
  const assertSession = () => {
    if (controller.signal.aborted || !isCurrent()) throw new Error('로그인 상태가 변경되었습니다.');
  };
  const api = createHttpLessonQuestApi({
    baseUrl: origin,
    pathPrefix: '/api',
    assertSession,
    signal: controller.signal,
    secureTransport: true,
    getAuthorization: async () => {
      assertSession();
      let token: string;
      try {
        token = await identity.getIdToken();
      } catch {
        throw new Error('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');
      }
      assertSession();
      return `Bearer ${token}`;
    },
    fetch: async (input, init) => {
      assertSession();
      try {
        return await transport(input, init);
      } catch {
        assertSession();
        throw new Error('서버에 연결하지 못했습니다. 연결을 확인해 주세요.');
      }
    },
  });
  return { api, dispose: () => controller.abort() };
}
