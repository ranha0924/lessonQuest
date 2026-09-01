import {
  offlineEventRecordSchema,
  offlineEventQueueScopeSchema,
  type OfflineEventQueueScope,
  type OfflineEventRecord,
  type OfflineEventStore,
} from '@lessonquest/experience-sdk';

const DATABASE_NAME = 'lessonquest-offline-v1';
const STORE_NAME = 'learning-events';
const SCOPE_INDEX = 'scope';

interface StoredEventRecord extends OfflineEventRecord {
  readonly key: string;
  readonly accountStorageKey: string;
  readonly organizationId: string;
}

function key(scope: OfflineEventQueueScope, eventId: string) {
  return `${scope.accountStorageKey}:${scope.organizationId}:${eventId}`;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed')),
      {
        once: true,
      },
    );
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('IndexedDB transaction failed')),
      { once: true },
    );
  });
}

async function openDatabase() {
  if (!('indexedDB' in globalThis)) throw new Error('IndexedDB is unavailable');
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.addEventListener('upgradeneeded', () => {
    const database = request.result;
    if (database.objectStoreNames.contains(STORE_NAME)) return;
    const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    store.createIndex(SCOPE_INDEX, ['accountStorageKey', 'organizationId'], { unique: false });
  });
  return requestResult(request);
}

function parseStored(input: unknown): OfflineEventRecord {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Stored offline event is invalid');
  }
  const record = { ...(input as Record<string, unknown>) };
  delete record['key'];
  delete record['accountStorageKey'];
  delete record['organizationId'];
  return offlineEventRecordSchema.parse(record);
}

function storedMetadataMatchesScope(input: unknown, scope: OfflineEventQueueScope) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  const record = input as Record<string, unknown>;
  return (
    record['accountStorageKey'] === scope.accountStorageKey &&
    record['organizationId'] === scope.organizationId
  );
}

export function createIndexedDbOfflineEventStore(): OfflineEventStore {
  const store: OfflineEventStore = {
    list: async (scopeInput) => {
      const scope = offlineEventQueueScopeSchema.parse(scopeInput);
      const database = await openDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const index = transaction.objectStore(STORE_NAME).index(SCOPE_INDEX);
        const range = IDBKeyRange.only([scope.accountStorageKey, scope.organizationId]);
        const [values, primaryKeys] = await Promise.all([
          requestResult(index.getAll(range)),
          requestResult(index.getAllKeys(range)),
        ]);
        await transactionDone(transaction);
        const records: OfflineEventRecord[] = [];
        const invalidPrimaryKeys: IDBValidKey[] = [];
        for (const [position, value] of values.entries()) {
          try {
            const record = parseStored(value);
            const primaryKey = primaryKeys[position];
            if (
              !storedMetadataMatchesScope(value, scope) ||
              record.event.organizationId !== scope.organizationId ||
              primaryKey !== key(scope, record.event.eventId)
            ) {
              throw new Error('Stored offline event does not match its canonical scope key');
            }
            records.push(record);
          } catch {
            const primaryKey = primaryKeys[position];
            if (primaryKey !== undefined) invalidPrimaryKeys.push(primaryKey);
          }
        }
        if (invalidPrimaryKeys.length > 0) {
          const cleanupTransaction = database.transaction(STORE_NAME, 'readwrite');
          const objectStore = cleanupTransaction.objectStore(STORE_NAME);
          for (const primaryKey of invalidPrimaryKeys) objectStore.delete(primaryKey);
          await transactionDone(cleanupTransaction);
        }
        return records;
      } finally {
        database.close();
      }
    },
    put: async (scopeInput, recordInput) => {
      const scope = offlineEventQueueScopeSchema.parse(scopeInput);
      const record = offlineEventRecordSchema.parse(recordInput);
      if (record.event.organizationId !== scope.organizationId) {
        throw new Error('Offline record does not match its organization scope');
      }
      const database = await openDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put({
          ...record,
          key: key(scope, record.event.eventId),
          accountStorageKey: scope.accountStorageKey,
          organizationId: scope.organizationId,
        } satisfies StoredEventRecord);
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    },
    remove: async (scopeInput, eventId) => {
      const scope = offlineEventQueueScopeSchema.parse(scopeInput);
      const database = await openDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key(scope, eventId));
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    },
    clear: async (scopeInput) => {
      const scope = offlineEventQueueScopeSchema.parse(scopeInput);
      const database = await openDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const index = transaction.objectStore(STORE_NAME).index(SCOPE_INDEX);
        const request = index.openKeyCursor(
          IDBKeyRange.only([scope.accountStorageKey, scope.organizationId]),
        );
        request.addEventListener('success', () => {
          const cursor = request.result;
          if (cursor === null) return;
          transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
          cursor.continue();
        });
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    },
    prune: async (scopeInput, expiresBefore) => {
      const scope = offlineEventQueueScopeSchema.parse(scopeInput);
      const database = await openDatabase();
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const request = transaction
          .objectStore(STORE_NAME)
          .index(SCOPE_INDEX)
          .openCursor(IDBKeyRange.only([scope.accountStorageKey, scope.organizationId]));
        request.addEventListener('success', () => {
          const cursor = request.result;
          if (cursor === null) return;
          try {
            if (parseStored(cursor.value).createdAt <= expiresBefore) cursor.delete();
          } catch {
            cursor.delete();
          }
          cursor.continue();
        });
        await transactionDone(transaction);
      } finally {
        database.close();
      }
    },
  };
  return Object.freeze(store);
}
