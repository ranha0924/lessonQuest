import {
  clientLearningEventSchema,
  eventIngestionResultSchema,
  uuidSchema,
  type ClientLearningEvent,
  type EventIngestionResult,
} from '@lessonquest/contracts';
import { z } from 'zod';

export const offlineAccountStorageKeySchema = z.string().regex(/^lqs_[a-f0-9]{64}$/);
export const offlineEventQueueScopeSchema = z.strictObject({
  accountStorageKey: offlineAccountStorageKeySchema,
  organizationId: uuidSchema,
});
export const offlineEventRecordSchema = z.strictObject({
  event: clientLearningEventSchema,
  createdAt: z.int().nonnegative(),
  attempts: z.int().min(0).max(1_000_000),
  nextAttemptAt: z.int().nonnegative(),
});

export type OfflineEventQueueScope = z.infer<typeof offlineEventQueueScopeSchema>;
export type OfflineEventRecord = z.infer<typeof offlineEventRecordSchema>;

export interface OfflineEventStore {
  list(scope: OfflineEventQueueScope): Promise<readonly OfflineEventRecord[]>;
  put(scope: OfflineEventQueueScope, record: OfflineEventRecord): Promise<void>;
  remove(scope: OfflineEventQueueScope, eventId: string): Promise<void>;
  clear(scope: OfflineEventQueueScope): Promise<void>;
  prune(scope: OfflineEventQueueScope, expiresBefore: number): Promise<void>;
}

export interface OfflineEventQueueState {
  readonly pendingCount: number;
  readonly sending: boolean;
  readonly nextRetryAt: number | null;
  readonly lastAttemptAt: number | null;
  readonly now: number;
}

export type OfflineEventQueueUpdate =
  | { readonly kind: 'STATE'; readonly state: OfflineEventQueueState }
  | {
      readonly kind: 'DELIVERED';
      readonly event: ClientLearningEvent;
      readonly result: EventIngestionResult;
    }
  | { readonly kind: 'REJECTED'; readonly event: ClientLearningEvent; readonly error: unknown };

export type OfflineEnqueueResult =
  | { readonly status: 'DELIVERED'; readonly result: EventIngestionResult }
  | { readonly status: 'QUEUED' };

export interface OfflineEventQueue {
  start(): Promise<void>;
  enqueue(event: ClientLearningEvent): Promise<OfflineEnqueueResult>;
  retryNow(): Promise<void>;
  flushDue(): Promise<void>;
  pendingForAttempt(attemptId: string): Promise<ClientLearningEvent | null>;
  subscribe(listener: (update: OfflineEventQueueUpdate) => void): () => void;
  clear(): Promise<void>;
  dispose(): void;
  getState(): OfflineEventQueueState;
}

export interface OfflineEventQueueOptions {
  readonly scope: OfflineEventQueueScope;
  readonly store: OfflineEventStore;
  readonly deliver: (event: ClientLearningEvent) => Promise<EventIngestionResult>;
  readonly classifyFailure: (error: unknown) => 'RETRY' | 'TERMINAL';
  readonly now?: () => number;
  readonly isOnline?: () => boolean;
  readonly setTimer?: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly onOnline?: (listener: () => void) => () => void;
  readonly maxEvents?: number;
  readonly maxAgeMs?: number;
}

const DEFAULT_MAX_EVENTS = 20;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function compareRecords(left: OfflineEventRecord, right: OfflineEventRecord) {
  return (
    left.createdAt - right.createdAt ||
    left.event.sequence - right.event.sequence ||
    left.event.eventId.localeCompare(right.event.eventId)
  );
}

function backoffMs(attempts: number) {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

export function createOfflineEventQueue(options: OfflineEventQueueOptions): OfflineEventQueue {
  const scope = offlineEventQueueScopeSchema.parse(options.scope);
  const maxEvents = z
    .int()
    .min(1)
    .max(100)
    .parse(options.maxEvents ?? DEFAULT_MAX_EVENTS);
  const maxAgeMs = z
    .int()
    .min(1_000)
    .max(7 * DEFAULT_MAX_AGE_MS)
    .parse(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
  const now = options.now ?? Date.now;
  const isOnline = options.isOnline ?? (() => true);
  const setTimer =
    options.setTimer ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
  const clearTimer = options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle as number));
  const onOnline = options.onOnline ?? (() => () => undefined);
  const listeners = new Set<(update: OfflineEventQueueUpdate) => void>();
  let records: OfflineEventRecord[] = [];
  let started = false;
  let disposed = false;
  let sending = false;
  let lastAttemptAt: number | null = null;
  let timer: unknown;
  let removeOnlineListener: (() => void) | undefined;
  let flushing: Promise<void> | undefined;
  let starting: Promise<void> | undefined;
  let stagingTail = Promise.resolve();
  let stagingActive = false;
  let lifecycleGeneration = 0;
  let clearGeneration = 0;

  type DeliveryReservation = {
    readonly record: OfflineEventRecord;
    readonly lifecycleGeneration: number;
    readonly clearGeneration: number;
    readonly attemptedAt: number;
  };

  const notify = (
    listener: (update: OfflineEventQueueUpdate) => void,
    update: OfflineEventQueueUpdate,
  ) => {
    try {
      listener(update);
    } catch {
      // A host rendering callback cannot change durable queue delivery semantics.
    }
  };
  const state = (): OfflineEventQueueState => ({
    pendingCount: records.length,
    sending,
    nextRetryAt: records[0]?.nextAttemptAt ?? null,
    lastAttemptAt,
    now: now(),
  });
  const emit = (update: OfflineEventQueueUpdate) => {
    if (disposed) return;
    for (const listener of listeners) notify(listener, update);
  };
  const emitState = () => emit({ kind: 'STATE', state: state() });
  const cancelTimer = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const schedule = () => {
    cancelTimer();
    const next = records[0];
    if (disposed || sending || stagingActive || next === undefined || !isOnline()) return;
    timer = setTimer(
      () => {
        timer = undefined;
        void flush(false, false);
      },
      Math.max(0, next.nextAttemptAt - now()),
    );
  };
  const isLifecycleCurrent = (generation: number) =>
    !disposed && generation === lifecycleGeneration;
  const withStagingLock = async <T>(operation: () => Promise<T>): Promise<T> => {
    const previous = stagingTail;
    let release!: () => void;
    stagingTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    stagingActive = true;
    cancelTimer();
    try {
      return await operation();
    } finally {
      stagingActive = false;
      release();
      schedule();
    }
  };
  const reload = async (generation: number): Promise<boolean> => {
    await options.store.prune(scope, now() - maxAgeMs);
    if (!isLifecycleCurrent(generation)) return false;
    const loaded: OfflineEventRecord[] = [];
    for (const storedRecord of await options.store.list(scope)) {
      if (!isLifecycleCurrent(generation)) return false;
      const record = offlineEventRecordSchema.parse(storedRecord);
      if (record.event.organizationId !== scope.organizationId) {
        await options.store.remove(scope, record.event.eventId);
        continue;
      }
      loaded.push(record);
    }
    if (!isLifecycleCurrent(generation)) return false;
    records = loaded;
    records.sort(compareRecords);
    emitState();
    return true;
  };

  const reserveDelivery = (record: OfflineEventRecord): DeliveryReservation | null => {
    if (disposed || sending || !isOnline()) return null;
    const attemptedAt = now();
    sending = true;
    lastAttemptAt = attemptedAt;
    emitState();
    return {
      record,
      lifecycleGeneration,
      clearGeneration,
      attemptedAt,
    };
  };

  const attemptDelivery = async (
    reservation: DeliveryReservation,
    propagateTerminal: boolean,
  ): Promise<EventIngestionResult | null> => {
    const { record } = reservation;
    const deliveryGeneration = reservation.lifecycleGeneration;
    const deliveryClearGeneration = reservation.clearGeneration;
    const isCurrentDelivery = () => !disposed && deliveryGeneration === lifecycleGeneration;
    try {
      if (!isCurrentDelivery()) return null;
      const response = await options.deliver(record.event);
      if (!isCurrentDelivery()) return null;
      const result = eventIngestionResultSchema.parse(response);
      await options.store.remove(scope, record.event.eventId);
      if (!isCurrentDelivery()) return null;
      records = records.filter(({ event }) => event.eventId !== record.event.eventId);
      emit({ kind: 'DELIVERED', event: record.event, result });
      return result;
    } catch (error) {
      if (!isCurrentDelivery()) return null;
      if (options.classifyFailure(error) === 'TERMINAL') {
        await options.store.remove(scope, record.event.eventId);
        if (!isCurrentDelivery()) return null;
        records = records.filter(({ event }) => event.eventId !== record.event.eventId);
        emit({ kind: 'REJECTED', event: record.event, error });
        if (propagateTerminal) throw error;
        return null;
      }
      const attempts = record.attempts + 1;
      const updated = offlineEventRecordSchema.parse({
        ...record,
        attempts,
        nextAttemptAt: reservation.attemptedAt + backoffMs(attempts),
      });
      await options.store.put(scope, updated);
      if (!isCurrentDelivery()) {
        if (deliveryClearGeneration !== clearGeneration) {
          await options.store.remove(scope, record.event.eventId);
        }
        return null;
      }
      records = records.map((item) =>
        item.event.eventId === updated.event.eventId ? updated : item,
      );
      records.sort(compareRecords);
      return null;
    } finally {
      sending = false;
      emitState();
      schedule();
    }
  };

  const flush = async (force: boolean, propagateTerminal: boolean): Promise<void> => {
    if (flushing !== undefined) return flushing;
    if (sending || stagingActive) return;
    flushing = (async () => {
      while (!disposed && isOnline() && !stagingActive) {
        const next = records[0];
        if (next === undefined || (!force && next.nextAttemptAt > now())) break;
        const reservation = reserveDelivery(next);
        if (reservation === null) break;
        const result = await attemptDelivery(reservation, propagateTerminal);
        if (result === null && records.some(({ event }) => event.eventId === next.event.eventId)) {
          break;
        }
      }
    })().finally(() => {
      flushing = undefined;
      schedule();
    });
    return flushing;
  };

  const start = async () => {
    if (disposed) throw new Error('Offline event queue is disposed');
    if (started) return;
    if (starting !== undefined) return starting;
    const generation = lifecycleGeneration;
    const run = async () => {
      if (!(await reload(generation))) return;
      started = true;
      removeOnlineListener = onOnline(() => {
        void flush(false, false);
      });
      await flush(false, false);
    };
    const tracked = run().finally(() => {
      if (starting === tracked) starting = undefined;
    });
    starting = tracked;
    return tracked;
  };

  return Object.freeze({
    start,
    enqueue: async (eventInput: ClientLearningEvent) => {
      if (disposed) throw new Error('Offline event queue is disposed');
      const event = clientLearningEventSchema.parse(eventInput);
      if (event.organizationId !== scope.organizationId) {
        throw new Error('Offline event does not match the queue organization');
      }
      const enqueueGeneration = lifecycleGeneration;
      const enqueueClearGeneration = clearGeneration;
      if (!started) await start();
      if (!isLifecycleCurrent(enqueueGeneration)) return { status: 'QUEUED' } as const;
      const staged = await withStagingLock(async () => {
        if (!isLifecycleCurrent(enqueueGeneration)) return null;
        const expiresBefore = now() - maxAgeMs;
        await options.store.prune(scope, expiresBefore);
        if (!isLifecycleCurrent(enqueueGeneration)) return null;
        records = records.filter((record) => record.createdAt > expiresBefore);
        const existingById = records.find((record) => record.event.eventId === event.eventId);
        if (existingById !== undefined) {
          if (JSON.stringify(existingById.event) !== JSON.stringify(event)) {
            throw new Error('Offline event ID is already used by a different envelope');
          }
          return null;
        }
        if (records.some((record) => record.event.attemptId === event.attemptId)) {
          throw new Error('A learning event for this attempt is already pending');
        }
        if (records.length >= maxEvents) throw new Error('Offline event queue is full');
        const createdAt = Math.max(now(), (records.at(-1)?.createdAt ?? -1) + 1);
        const record = offlineEventRecordSchema.parse({
          event,
          createdAt,
          attempts: 0,
          nextAttemptAt: now(),
        });
        await options.store.put(scope, record);
        if (!isLifecycleCurrent(enqueueGeneration)) {
          if (enqueueClearGeneration !== clearGeneration) {
            await options.store.remove(scope, record.event.eventId);
          }
          return null;
        }
        records.push(record);
        records.sort(compareRecords);
        emitState();
        const isHead = records[0]?.event.eventId === record.event.eventId;
        const reservation = isHead && flushing === undefined ? reserveDelivery(record) : null;
        return { reservation };
      });
      if (staged?.reservation === null || staged === null) return { status: 'QUEUED' } as const;
      const result = await attemptDelivery(staged.reservation, true);
      return result === null
        ? ({ status: 'QUEUED' } as const)
        : ({ status: 'DELIVERED', result } as const);
    },
    retryNow: async () => {
      if (!started) await start();
      await flush(true, false);
    },
    flushDue: async () => {
      if (!started) await start();
      await flush(false, false);
    },
    pendingForAttempt: async (attemptIdInput: string) => {
      const attemptId = uuidSchema.parse(attemptIdInput);
      if (!started) await start();
      if (disposed) return null;
      return records.find((record) => record.event.attemptId === attemptId)?.event ?? null;
    },
    subscribe: (listener: (update: OfflineEventQueueUpdate) => void) => {
      if (disposed) return () => undefined;
      listeners.add(listener);
      notify(listener, { kind: 'STATE', state: state() });
      return () => listeners.delete(listener);
    },
    clear: async () => {
      lifecycleGeneration++;
      clearGeneration++;
      records = [];
      cancelTimer();
      await options.store.clear(scope);
      emitState();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      lifecycleGeneration++;
      cancelTimer();
      removeOnlineListener?.();
      removeOnlineListener = undefined;
      listeners.clear();
    },
    getState: state,
  });
}
