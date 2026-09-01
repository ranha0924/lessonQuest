import type { ClientLearningEvent, EventIngestionResult } from '@lessonquest/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createOfflineEventQueue,
  type OfflineEventQueueScope,
  type OfflineEventRecord,
  type OfflineEventStore,
} from '../src/index.js';

const organizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c101';
const assignmentId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c102';
const attemptId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c103';
const scope = {
  accountStorageKey: `lqs_${'a'.repeat(64)}`,
  organizationId,
} as const;

function event(index: number, overrides: Partial<ClientLearningEvent> = {}): ClientLearningEvent {
  return {
    schemaVersion: 1,
    eventId: `018f72a4-cc52-7c5a-a6f9-8b21aa27${(0xc200 + index).toString(16)}`,
    organizationId,
    assignmentId,
    attemptId,
    experienceId: 'science_force_01',
    experienceVersion: 1,
    type: 'QUESTION_ANSWERED',
    stepId: 'quiz_force',
    sequence: index,
    occurredAt: '2026-09-01T00:00:00.000Z',
    payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_000 },
    ...overrides,
  } as ClientLearningEvent;
}

const accepted: EventIngestionResult = {
  accepted: true,
  duplicate: false,
  answer: { stepId: 'quiz_force', attempt: 1, correct: false },
  nextSequence: 2,
};

class MemoryStore implements OfflineEventStore {
  readonly records = new Map<string, OfflineEventRecord>();

  private prefix(input: OfflineEventQueueScope) {
    return `${input.accountStorageKey}:${input.organizationId}:`;
  }

  list(input: OfflineEventQueueScope) {
    const prefix = this.prefix(input);
    return Promise.resolve(
      [...this.records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => structuredClone(value)),
    );
  }

  put(input: OfflineEventQueueScope, record: OfflineEventRecord) {
    this.records.set(`${this.prefix(input)}${record.event.eventId}`, structuredClone(record));
    return Promise.resolve();
  }

  remove(input: OfflineEventQueueScope, eventId: string) {
    this.records.delete(`${this.prefix(input)}${eventId}`);
    return Promise.resolve();
  }

  clear(input: OfflineEventQueueScope) {
    const prefix = this.prefix(input);
    for (const key of this.records.keys()) if (key.startsWith(prefix)) this.records.delete(key);
    return Promise.resolve();
  }

  prune(input: OfflineEventQueueScope, expiresBefore: number) {
    const prefix = this.prefix(input);
    for (const [key, value] of this.records) {
      if (key.startsWith(prefix) && value.createdAt <= expiresBefore) this.records.delete(key);
    }
    return Promise.resolve();
  }
}

function harness(
  options: {
    deliver?: (item: ClientLearningEvent) => Promise<EventIngestionResult>;
    classifyFailure?: (error: unknown) => 'RETRY' | 'TERMINAL';
    now?: number;
    online?: boolean;
    store?: MemoryStore;
  } = {},
) {
  let now = options.now ?? Date.parse('2026-09-01T00:00:00.000Z');
  let online = options.online ?? true;
  let onlineListener: (() => void) | undefined;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  const store = options.store ?? new MemoryStore();
  const deliver = vi.fn(options.deliver ?? (() => Promise.resolve(accepted)));
  const queue = createOfflineEventQueue({
    scope,
    store,
    deliver,
    classifyFailure: options.classifyFailure ?? (() => 'RETRY'),
    now: () => now,
    isOnline: () => online,
    setTimer: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id as number),
    onOnline: (listener) => {
      onlineListener = listener;
      return () => {
        if (onlineListener === listener) onlineListener = undefined;
      };
    },
  });
  return {
    queue,
    store,
    deliver,
    timers,
    setNow(value: number) {
      now = value;
    },
    setOnline(value: boolean) {
      online = value;
      if (value) onlineListener?.();
    },
  };
}

describe('offline learning-event queue', () => {
  it('stages an exact event before delivery and resolves a lost response with the same ID', async () => {
    let attempts = 0;
    const h = harness({
      deliver: (item) => {
        attempts++;
        expect(item).toEqual(event(1));
        return attempts === 1
          ? Promise.reject(new TypeError('offline'))
          : Promise.resolve({ ...accepted, accepted: false, duplicate: true });
      },
    });
    const updates: unknown[] = [];
    h.queue.subscribe((update) => updates.push(update));
    await h.queue.start();

    const input = event(1);
    const result = await h.queue.enqueue(input);
    expect(result).toEqual({ status: 'QUEUED' });
    expect((await h.store.list(scope))[0]).toMatchObject({
      event: input,
      attempts: 1,
      nextAttemptAt: Date.parse('2026-09-01T00:00:02.000Z'),
    });
    expect([...h.timers.values()][0]).toMatchObject({ delay: 2_000 });

    await h.queue.retryNow();
    expect(h.deliver).toHaveBeenCalledTimes(2);
    expect(await h.store.list(scope)).toEqual([]);
    expect(updates).toContainEqual({
      kind: 'DELIVERED',
      event: input,
      result: { ...accepted, accepted: false, duplicate: true },
    });
  });

  it('uses bounded exponential backoff, respects due time and wakes when online', async () => {
    const h = harness({ deliver: () => Promise.reject(new TypeError('offline')) });
    await h.queue.start();
    await h.queue.enqueue(event(1));
    const origin = Date.parse('2026-09-01T00:00:00.000Z');

    for (const [attempts, delay] of [
      [1, 2_000],
      [2, 4_000],
      [3, 8_000],
      [4, 16_000],
      [5, 32_000],
      [6, 60_000],
      [7, 60_000],
    ] as const) {
      const record = (await h.store.list(scope))[0]!;
      expect(record).toMatchObject({ attempts });
      expect(record.nextAttemptAt - h.queue.getState().lastAttemptAt!).toBe(delay);
      h.setNow(record.nextAttemptAt - 1);
      await h.queue.flushDue();
      expect(h.deliver).toHaveBeenCalledTimes(attempts);
      h.setNow(record.nextAttemptAt);
      await h.queue.flushDue();
    }
    expect(h.queue.getState().lastAttemptAt).toBeGreaterThan(origin);
    h.setOnline(false);
    const calls = h.deliver.mock.calls.length;
    await h.queue.retryNow();
    expect(h.deliver).toHaveBeenCalledTimes(calls);
    h.setOnline(true);
    await Promise.resolve();
    expect(h.queue.getState().pendingCount).toBe(1);
  });

  it('keeps FIFO order and rejects a second pending event for the same attempt', async () => {
    const h = harness({ online: false });
    await h.queue.start();
    await h.queue.enqueue(event(1));
    await expect(h.queue.enqueue(event(2))).rejects.toThrow(/attempt/i);
    await h.queue.enqueue(
      event(3, { attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c104', sequence: 0 }),
    );
    expect((await h.store.list(scope)).map(({ event: item }) => item.eventId)).toEqual([
      event(1).eventId,
      event(3).eventId,
    ]);
    h.setOnline(true);
    await h.queue.retryNow();
    expect(h.deliver.mock.calls.map(([item]) => item.eventId)).toEqual([
      event(1).eventId,
      event(3).eventId,
    ]);
  });

  it('serializes concurrent online enqueues behind the FIFO head', async () => {
    const resolvers = new Map<
      string,
      (result: EventIngestionResult | PromiseLike<EventIngestionResult>) => void
    >();
    const h = harness({
      deliver: (item) =>
        new Promise<EventIngestionResult>((resolve) => {
          resolvers.set(item.eventId, resolve);
        }),
    });
    await h.queue.start();

    const first = h.queue.enqueue(event(1));
    await vi.waitFor(() => expect(h.deliver).toHaveBeenCalledTimes(1));
    const secondEvent = event(2, {
      attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c104',
      sequence: 0,
    });
    const second = h.queue.enqueue(secondEvent);
    await vi.waitFor(async () => expect(await h.store.list(scope)).toHaveLength(2));
    expect(h.deliver.mock.calls.map(([item]) => item.eventId)).toEqual([event(1).eventId]);

    resolvers.get(event(1).eventId)?.(accepted);
    await expect(first).resolves.toMatchObject({ status: 'DELIVERED' });
    await expect(second).resolves.toEqual({ status: 'QUEUED' });
    const flush = h.queue.retryNow();
    await vi.waitFor(() => expect(h.deliver).toHaveBeenCalledTimes(2));
    resolvers.get(secondEvent.eventId)?.({ ...accepted, nextSequence: 1 });
    await flush;
    expect(await h.store.list(scope)).toEqual([]);
    h.queue.dispose();
  });

  it('enforces strict scope, a 20-event cap and 24-hour expiry', async () => {
    const h = harness({ online: false });
    await h.queue.start();
    await expect(
      h.queue.enqueue(event(1, { organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c999' })),
    ).rejects.toThrow();
    for (let index = 1; index <= 20; index++) {
      await h.queue.enqueue(
        event(index, {
          attemptId: `018f72a4-cc52-7c5a-a6f9-8b21aa27${(0xc300 + index).toString(16)}`,
          sequence: 0,
        }),
      );
    }
    await expect(
      h.queue.enqueue(
        event(21, { attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c399', sequence: 0 }),
      ),
    ).rejects.toThrow(/full/i);

    h.queue.dispose();
    h.setNow(Date.parse('2026-09-02T00:00:00.100Z'));
    const replacement = harness({ store: h.store, online: false, now: h.queue.getState().now });
    await replacement.queue.start();
    expect(await h.store.list(scope)).toEqual([]);
  });

  it('removes terminal failures and never retries them', async () => {
    const denied = Object.assign(new Error('denied'), { status: 404 });
    const h = harness({
      deliver: () => Promise.reject(denied),
      classifyFailure: () => 'TERMINAL',
    });
    const updates: unknown[] = [];
    h.queue.subscribe((update) => updates.push(update));
    await h.queue.start();

    await expect(h.queue.enqueue(event(1))).rejects.toBe(denied);
    expect(await h.store.list(scope)).toEqual([]);
    expect(h.timers.size).toBe(0);
    expect(updates).toContainEqual(expect.objectContaining({ kind: 'REJECTED', event: event(1) }));
  });

  it('isolates queue delivery from a subscriber that throws', async () => {
    const h = harness();
    const updates: unknown[] = [];
    h.queue.subscribe(() => {
      throw new Error('broken host subscriber');
    });
    h.queue.subscribe((update) => updates.push(update));

    await expect(h.queue.start()).resolves.toBeUndefined();
    await expect(h.queue.enqueue(event(1))).resolves.toMatchObject({ status: 'DELIVERED' });
    expect(updates).toContainEqual(expect.objectContaining({ kind: 'DELIVERED', event: event(1) }));
  });

  it('removes a stored foreign-organization envelope without attempting delivery', async () => {
    const store = new MemoryStore();
    const foreign = event(1, { organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c999' });
    await store.put(scope, {
      event: foreign,
      createdAt: Date.parse('2026-09-01T00:00:00.000Z'),
      attempts: 0,
      nextAttemptAt: Date.parse('2026-09-01T00:00:00.000Z'),
    });
    const h = harness({ store });

    await h.queue.start();

    expect(h.deliver).not.toHaveBeenCalled();
    expect(await store.list(scope)).toEqual([]);
    expect(h.queue.getState().pendingCount).toBe(0);
  });

  it.each([
    { outcome: 'success', terminal: false },
    { outcome: 'terminal failure', terminal: true },
    { outcome: 'retryable failure', terminal: false },
  ] as const)(
    'ignores a late $outcome after clear has completed',
    async ({ outcome, terminal }) => {
      let resolveDelivery!: (result: EventIngestionResult) => void;
      let rejectDelivery!: (error: unknown) => void;
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const delivery = new Promise<EventIngestionResult>((resolve, reject) => {
        resolveDelivery = resolve;
        rejectDelivery = reject;
      });
      const h = harness({
        deliver: () => {
          markStarted();
          return delivery;
        },
        classifyFailure: () => (terminal ? 'TERMINAL' : 'RETRY'),
      });
      const outcomes: unknown[] = [];
      h.queue.subscribe((update) => {
        if (update.kind !== 'STATE') outcomes.push(update);
      });
      await h.queue.start();

      const enqueue = h.queue.enqueue(event(1));
      await started;
      await h.queue.clear();
      expect(await h.store.list(scope)).toEqual([]);
      if (outcome === 'success') resolveDelivery(accepted);
      else rejectDelivery(new TypeError(outcome));

      await expect(enqueue).resolves.toEqual({ status: 'QUEUED' });
      expect(await h.store.list(scope)).toEqual([]);
      expect(outcomes).toEqual([]);
      h.queue.dispose();
    },
  );

  it('retains the staged record when dispose invalidates an in-flight retry', async () => {
    let rejectDelivery!: (error: unknown) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const h = harness({
      deliver: () => {
        markStarted();
        return new Promise<EventIngestionResult>((_resolve, reject) => {
          rejectDelivery = reject;
        });
      },
    });
    await h.queue.start();

    const enqueue = h.queue.enqueue(event(1));
    await started;
    h.queue.dispose();
    rejectDelivery(new TypeError('late retry after unmount'));

    await expect(enqueue).resolves.toEqual({ status: 'QUEUED' });
    expect(await h.store.list(scope)).toEqual([
      expect.objectContaining({ event: event(1), attempts: 0 }),
    ]);
  });

  it('clears only the current scope and dispose cancels local work without deleting records', async () => {
    const shared = new MemoryStore();
    const first = harness({ store: shared, online: false });
    const secondScope = { ...scope, accountStorageKey: `lqs_${'b'.repeat(64)}` };
    await first.queue.start();
    await first.queue.enqueue(event(1));
    await shared.put(secondScope, {
      event: event(2),
      createdAt: Date.parse('2026-09-01T00:00:00.000Z'),
      attempts: 0,
      nextAttemptAt: Date.parse('2026-09-01T00:00:00.000Z'),
    });
    first.queue.dispose();
    expect(await shared.list(scope)).toHaveLength(1);
    await first.queue.clear();
    expect(await shared.list(scope)).toEqual([]);
    expect(await shared.list(secondScope)).toHaveLength(1);
  });
});
