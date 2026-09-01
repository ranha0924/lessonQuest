import {
  createOfflineEventQueue,
  offlineEventQueueScopeSchema,
  type OfflineEventQueue,
} from '@lessonquest/experience-sdk';

import { LessonQuestApiError, type LessonQuestApi } from '../api-client.js';
import { createIndexedDbOfflineEventStore } from './indexeddb-event-store.js';

export function canUseBrowserOfflineQueue() {
  return typeof indexedDB !== 'undefined';
}

export function bindOfflineQueueSessionLifecycle(queue: OfflineEventQueue) {
  let sessionEnded = false;
  const handleSessionEnded = () => {
    if (sessionEnded) return;
    sessionEnded = true;
    void queue.clear().finally(() => queue.dispose());
  };
  window.addEventListener('lessonquest:session-ended', handleSessionEnded);
  return () => {
    window.removeEventListener('lessonquest:session-ended', handleSessionEnded);
    if (!sessionEnded) queue.dispose();
  };
}

export function createBrowserOfflineEventQueue(options: {
  readonly accountStorageKey: string;
  readonly organizationId: string;
  readonly api: LessonQuestApi;
}): OfflineEventQueue {
  const scope = offlineEventQueueScopeSchema.parse({
    accountStorageKey: options.accountStorageKey,
    organizationId: options.organizationId,
  });
  return createOfflineEventQueue({
    scope,
    store: createIndexedDbOfflineEventStore(),
    deliver: (event) => options.api.ingestEvent(event),
    classifyFailure: (error) => {
      if (!(error instanceof LessonQuestApiError)) return 'RETRY';
      return error.retryable || error.status === 429 || error.status >= 500 ? 'RETRY' : 'TERMINAL';
    },
    isOnline: () => navigator.onLine,
    onOnline: (listener) => {
      window.addEventListener('online', listener);
      return () => window.removeEventListener('online', listener);
    },
  });
}
