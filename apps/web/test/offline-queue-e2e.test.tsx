// @vitest-environment jsdom

import type { ClientLearningEvent, EventIngestionResult } from '@lessonquest/contracts';
import {
  createOfflineEventQueue,
  type OfflineEventQueueScope,
  type OfflineEventRecord,
  type OfflineEventStore,
} from '@lessonquest/experience-sdk';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LessonQuestApiError } from '../src/api-client.js';
import { StudentPlay } from '../src/components/student-play.js';
import { bindOfflineQueueSessionLifecycle } from '../src/offline/browser-event-queue.js';
import { createM56Fixture } from './m5-m6-fixture.js';
import { connectPhase1, enterLesson, type Phase1Fixture } from './phase1-fixture.js';

const accountStorageKey = `lqs_${'c'.repeat(64)}`;

class TestStore implements OfflineEventStore {
  records: OfflineEventRecord[] = [];
  list(scope: OfflineEventQueueScope) {
    return Promise.resolve(
      this.records
        .filter(
          ({ event }) =>
            event.organizationId === scope.organizationId &&
            (event as ClientLearningEvent & { accountStorageKey?: string }).accountStorageKey ===
              undefined,
        )
        .map((record) => structuredClone(record)),
    );
  }
  put(_scope: OfflineEventQueueScope, record: OfflineEventRecord) {
    this.records = [
      ...this.records.filter(({ event }) => event.eventId !== record.event.eventId),
      structuredClone(record),
    ];
    return Promise.resolve();
  }
  remove(_scope: OfflineEventQueueScope, eventId: string) {
    this.records = this.records.filter(({ event }) => event.eventId !== eventId);
    return Promise.resolve();
  }
  clear(scope: OfflineEventQueueScope) {
    this.records = this.records.filter(
      ({ event }) => event.organizationId !== scope.organizationId,
    );
    return Promise.resolve();
  }
  prune(scope: OfflineEventQueueScope, expiresBefore: number) {
    this.records = this.records.filter(
      (record) =>
        record.event.organizationId !== scope.organizationId || record.createdAt > expiresBefore,
    );
    return Promise.resolve();
  }
}

function pendingQueueEvent(fixture: Phase1Fixture): ClientLearningEvent {
  return {
    schemaVersion: 1,
    eventId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c201',
    organizationId: fixture.organization.id,
    assignmentId: fixture.assignment.id,
    attemptId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c203',
    experienceId: 'science_force_01',
    experienceVersion: 1,
    type: 'QUESTION_ANSWERED',
    stepId: 'quiz_force',
    sequence: 0,
    occurredAt: '2026-09-01T00:00:00.000Z',
    payload: { optionId: 'heavy', attempt: 1, elapsedMs: 1_000 },
  };
}

describe('durable offline learning-event recovery', () => {
  let fixture: Phase1Fixture;
  beforeEach(async () => {
    fixture = await createM56Fixture();
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await fixture.database.close();
  });

  for (const afterCommit of [false, true]) {
    it(`restores an exact answer after remount and resolves a ${afterCommit ? 'post-commit' : 'pre-commit'} response loss once`, async () => {
      let lose = true;
      const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
        if (delivery.type === 'QUESTION_ANSWERED' && lose) {
          lose = false;
          if (afterCommit) await forward();
          throw new TypeError('synthetic disconnected response');
        }
        return forward();
      });
      const store = new TestStore();
      const queue = createOfflineEventQueue({
        scope: { accountStorageKey, organizationId: fixture.organization.id },
        store,
        deliver: (event) => studentApi.ingestEvent(event),
        classifyFailure: (error) =>
          error instanceof LessonQuestApiError && !error.retryable ? 'TERMINAL' : 'RETRY',
        isOnline: () => true,
        setTimer: () => 1,
        clearTimer: () => undefined,
      });
      const first = render(
        <StudentPlay
          api={studentApi}
          organizationId={fixture.organization.id}
          offlineQueue={queue}
        />,
      );
      await enterLesson();
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('오프라인 대기 기록 1건 · 연결되면 자동 전송합니다.');
      expect(store.records).toHaveLength(1);
      const exactBody = deliveries.find(({ type }) => type === 'QUESTION_ANSWERED')?.body;
      first.unmount();

      render(
        <StudentPlay
          api={studentApi}
          organizationId={fixture.organization.id}
          offlineQueue={queue}
        />,
      );
      await enterLesson('M5M6 실제 경계', true);
      expect(screen.getByRole('button', { name: '질량 6 kg 선택' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.click(screen.getByRole('button', { name: '대기 기록 지금 보내기' }));
      await screen.findByText('대기하던 학습 기록을 전송했습니다.');
      await screen.findByText('정답이에요!');
      expect(store.records).toEqual([]);
      const answers = deliveries.filter(({ type }) => type === 'QUESTION_ANSWERED');
      expect(answers).toHaveLength(2);
      expect(answers[1]?.body).toBe(exactBody);
      expect(answers[1]?.status).toBe(afterCommit ? 200 : 202);
      expect(
        (
          await fixture.database.query(
            "SELECT count(*)::int n FROM learning_events WHERE type='QUESTION_ANSWERED'",
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
      queue.dispose();
    });
  }

  it('restores an exact completion after a committed response is lost', async () => {
    let lose = true;
    const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
      const response = await forward();
      if (delivery.type === 'EXPERIENCE_COMPLETED' && lose) {
        lose = false;
        throw new TypeError('synthetic completion response loss');
      }
      return response;
    });
    const store = new TestStore();
    const queue = createOfflineEventQueue({
      scope: { accountStorageKey, organizationId: fixture.organization.id },
      store,
      deliver: (event) => studentApi.ingestEvent(event),
      classifyFailure: (error) =>
        error instanceof LessonQuestApiError && !error.retryable ? 'TERMINAL' : 'RETRY',
      isOnline: () => true,
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    const first = render(
      <StudentPlay
        api={studentApi}
        organizationId={fixture.organization.id}
        offlineQueue={queue}
      />,
    );
    await enterLesson();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('정답이에요!');
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('오프라인 대기 기록 1건 · 연결되면 자동 전송합니다.');
    expect(store.records[0]?.event.type).toBe('EXPERIENCE_COMPLETED');
    const exactBody = deliveries.find(({ type }) => type === 'EXPERIENCE_COMPLETED')?.body;
    first.unmount();

    render(
      <StudentPlay
        api={studentApi}
        organizationId={fixture.organization.id}
        offlineQueue={queue}
      />,
    );
    await screen.findByRole('button', { name: '완료됨' });
    fireEvent.click(screen.getByRole('button', { name: '대기 기록 지금 보내기' }));
    await screen.findByText('대기하던 학습 기록을 전송했습니다.');
    expect(store.records).toEqual([]);
    const completions = deliveries.filter(({ type }) => type === 'EXPERIENCE_COMPLETED');
    expect(completions).toHaveLength(2);
    expect(completions[1]?.body).toBe(exactBody);
    expect(
      (
        await fixture.database.query(
          "SELECT count(*)::int n FROM learning_events WHERE type='EXPERIENCE_COMPLETED'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
    queue.dispose();
  });

  it('removes a terminal authority rejection instead of replaying under another session', async () => {
    const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
      if (delivery.type !== 'QUESTION_ANSWERED') return forward();
      return Response.json(
        {
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: '요청한 항목을 찾을 수 없습니다.',
            retryable: false,
            traceId: crypto.randomUUID(),
          },
        },
        { status: 404 },
      );
    });
    const store = new TestStore();
    const queue = createOfflineEventQueue({
      scope: { accountStorageKey, organizationId: fixture.organization.id },
      store,
      deliver: (event) => studentApi.ingestEvent(event),
      classifyFailure: (error) =>
        error instanceof LessonQuestApiError && !error.retryable ? 'TERMINAL' : 'RETRY',
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    render(
      <StudentPlay
        api={studentApi}
        organizationId={fixture.organization.id}
        offlineQueue={queue}
      />,
    );
    await enterLesson();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText(
      '이 학습 기록은 현재 권한으로 전송할 수 없어 기기에서 지웠습니다. 다시 로그인하거나 과제를 다시 열어 주세요.',
    );
    expect(store.records).toEqual([]);
    expect(deliveries.filter(({ type }) => type === 'QUESTION_ANSWERED')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '대기 기록 지금 보내기' })).toBeNull();
    queue.dispose();
  });

  it('clears the active account and organization scope when the host session ends', async () => {
    const { studentApi } = connectPhase1(fixture);
    const store = new TestStore();
    const queue = createOfflineEventQueue({
      scope: { accountStorageKey, organizationId: fixture.organization.id },
      store,
      deliver: (event) => studentApi.ingestEvent(event),
      classifyFailure: () => 'RETRY',
      isOnline: () => false,
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    const unbind = bindOfflineQueueSessionLifecycle(queue);
    render(
      <StudentPlay
        api={studentApi}
        organizationId={fixture.organization.id}
        offlineQueue={queue}
      />,
    );
    await enterLesson();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('오프라인 대기 기록 1건 · 연결되면 자동 전송합니다.');
    expect(store.records).toHaveLength(1);

    window.dispatchEvent(new Event('lessonquest:session-ended'));

    await waitFor(() => expect(store.records).toEqual([]));
    unbind();
  });

  it.each([
    { outcome: 'success', terminal: false },
    { outcome: 'terminal failure', terminal: true },
    { outcome: 'retryable failure', terminal: false },
  ] as const)(
    'keeps the session scope empty when an in-flight $outcome settles after session end',
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
      const store = new TestStore();
      const queue = createOfflineEventQueue({
        scope: { accountStorageKey, organizationId: fixture.organization.id },
        store,
        deliver: () => {
          markStarted();
          return delivery;
        },
        classifyFailure: () => (terminal ? 'TERMINAL' : 'RETRY'),
        isOnline: () => true,
        setTimer: () => 1,
        clearTimer: () => undefined,
      });
      const outcomes: unknown[] = [];
      queue.subscribe((update) => {
        if (update.kind !== 'STATE') outcomes.push(update);
      });
      const unbind = bindOfflineQueueSessionLifecycle(queue);
      const pendingEvent = pendingQueueEvent(fixture);
      await queue.start();

      const enqueue = queue.enqueue(pendingEvent);
      await started;
      window.dispatchEvent(new Event('lessonquest:session-ended'));
      await waitFor(() => expect(store.records).toEqual([]));
      if (outcome === 'success') {
        resolveDelivery({
          accepted: true,
          duplicate: false,
          answer: { stepId: 'quiz_force', attempt: 1, correct: false },
          nextSequence: 1,
        });
      } else {
        rejectDelivery(new TypeError(`late ${outcome}`));
      }

      await expect(enqueue).resolves.toEqual({ status: 'QUEUED' });
      await waitFor(() => expect(store.records).toEqual([]));
      expect(outcomes).toEqual([]);
      unbind();
    },
  );

  it('keeps the session scope empty when session end crosses initial event staging', async () => {
    let releasePut!: () => void;
    let markPutStarted!: () => void;
    const putStarted = new Promise<void>((resolve) => {
      markPutStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releasePut = resolve;
    });
    class BlockingPutStore extends TestStore {
      override async put(scope: OfflineEventQueueScope, record: OfflineEventRecord) {
        markPutStarted();
        await release;
        return super.put(scope, record);
      }
    }
    const store = new BlockingPutStore();
    const queue = createOfflineEventQueue({
      scope: { accountStorageKey, organizationId: fixture.organization.id },
      store,
      deliver: () => Promise.reject(new TypeError('must not deliver after session end')),
      classifyFailure: () => 'RETRY',
      isOnline: () => true,
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    await queue.start();
    const unbind = bindOfflineQueueSessionLifecycle(queue);

    const enqueue = queue.enqueue(pendingQueueEvent(fixture));
    await putStarted;
    window.dispatchEvent(new Event('lessonquest:session-ended'));
    await waitFor(() => expect(store.records).toEqual([]));
    releasePut();

    await expect(enqueue).resolves.toEqual({ status: 'QUEUED' });
    await waitFor(() => expect(store.records).toEqual([]));
    unbind();
  });

  it('keeps the session scope empty when session end crosses pre-staging pruning', async () => {
    let releasePrune!: () => void;
    let markPruneStarted!: () => void;
    const pruneStarted = new Promise<void>((resolve) => {
      markPruneStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releasePrune = resolve;
    });
    class BlockingPruneStore extends TestStore {
      block = false;
      override async prune(scope: OfflineEventQueueScope, expiresBefore: number) {
        if (this.block) {
          markPruneStarted();
          await release;
        }
        return super.prune(scope, expiresBefore);
      }
    }
    const store = new BlockingPruneStore();
    const queue = createOfflineEventQueue({
      scope: { accountStorageKey, organizationId: fixture.organization.id },
      store,
      deliver: () => Promise.reject(new TypeError('must not deliver after session end')),
      classifyFailure: () => 'RETRY',
      isOnline: () => true,
      setTimer: () => 1,
      clearTimer: () => undefined,
    });
    await queue.start();
    store.block = true;
    const unbind = bindOfflineQueueSessionLifecycle(queue);

    const enqueue = queue.enqueue(pendingQueueEvent(fixture));
    await pruneStarted;
    window.dispatchEvent(new Event('lessonquest:session-ended'));
    await waitFor(() => expect(store.records).toEqual([]));
    releasePrune();

    await expect(enqueue).resolves.toEqual({ status: 'QUEUED' });
    await waitFor(() => expect(store.records).toEqual([]));
    unbind();
  });
});
