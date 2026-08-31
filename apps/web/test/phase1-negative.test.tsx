// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalRasaProvider, type RasaHintProvider } from '../../../packages/rasa/src/index.js';

import { StudentPlay } from '../src/components/student-play.js';
import { BossCampaignPanel } from '../src/components/boss-campaign-panel.js';
import { createM56Fixture } from './m5-m6-fixture.js';
import {
  answerWrong,
  connectPhase1,
  enterLesson,
  hintEffects,
  type Phase1Fixture,
} from './phase1-fixture.js';

describe('Phase 1 real failure containment', () => {
  let fixture: Phase1Fixture;
  let provider: RasaHintProvider;
  let providerCalls: number;
  beforeEach(async () => {
    provider = new LocalRasaProvider();
    providerCalls = 0;
    fixture = await createM56Fixture({
      timeoutMs: 50,
      provider: {
        generateHint: (...args) => {
          providerCalls++;
          return provider.generateHint(...args);
        },
      },
    });
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await fixture.database.close();
  });

  for (const mode of ['REJECTED', 'FAILED', 'TIMED_OUT'] as const) {
    it(`contains ${mode} provider outcomes without hint, usage or learning effects`, async () => {
      let releaseLateProvider: (() => void) | undefined;
      let lateProvider: ReturnType<RasaHintProvider['generateHint']> | undefined;
      provider =
        mode === 'TIMED_OUT'
          ? {
              generateHint: (...args) => {
                const prepared = new LocalRasaProvider().generateHint(...args);
                lateProvider = new Promise<void>((resolve) => {
                  releaseLateProvider = resolve;
                }).then(() => prepared);
                return lateProvider;
              },
            }
          : mode === 'FAILED'
            ? { generateHint: () => Promise.reject(new Error('private provider diagnostic')) }
            : {
                generateHint: async (...args) => {
                  const result = await new LocalRasaProvider().generateHint(...args);
                  return {
                    ...result,
                    action: {
                      ...(result.action as Record<string, unknown>),
                      content: '정답은 질량 2 kg',
                    },
                  };
                },
              };
      const { studentApi, deliveries } = connectPhase1(fixture);
      const view = render(
        <StudentPlay api={studentApi} organizationId={fixture.organization.id} />,
      );
      await enterLesson();
      await answerWrong();
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
      expect(screen.queryByText('정답은 질량 2 kg')).toBeNull();
      expect(screen.queryByText('private provider diagnostic')).toBeNull();
      expect(await hintEffects(fixture)).toEqual([
        { requests: 1, actions: 0, usage: 0, hints: 0, opened: 0 },
      ]);
      expect((await fixture.database.query('SELECT status FROM rasa_requests')).rows).toEqual([
        { status: mode },
      ]);
      if (mode !== 'REJECTED') {
        fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
        await screen.findByRole('button', { name: '힌트 받기' });
        const sent = deliveries.filter(({ path }) => path.endsWith('/rasa/hints'));
        expect(sent).toHaveLength(2);
        expect(sent[1]?.body).toBe(sent[0]?.body);
        expect(providerCalls).toBe(1);
      }
      const terminal = (await fixture.database.query('SELECT * FROM rasa_requests')).rows;
      view.unmount();
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      await enterLesson('M5M6 실제 경계', true);
      releaseLateProvider?.();
      await lateProvider;
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('재도전 성공');
      fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
      await screen.findByText('탐험을 완료했습니다!');
      expect((await fixture.database.query('SELECT * FROM rasa_requests')).rows).toEqual(terminal);
      expect(
        (
          await fixture.database.query(
            "SELECT count(*)::int n FROM learning_events WHERE type IN ('HINT_USED','RASA_OPENED')",
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    });
  }

  it('allows an explicitly new hint request after a known terminal failure without reviving the old row', async () => {
    provider = { generateHint: () => Promise.reject(new Error('synthetic provider outage')) };
    const { studentApi, deliveries } = connectPhase1(fixture);
    render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson();
    await answerWrong();
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
    provider = new LocalRasaProvider();
    fireEvent.click(screen.getByRole('button', { name: '새 힌트 요청' }));
    await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
    const bodies = deliveries
      .filter(({ path }) => path.endsWith('/rasa/hints'))
      .map(({ body }) => JSON.parse(body!) as { requestId: string });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]?.requestId).not.toBe(bodies[0]?.requestId);
    expect(
      (
        await fixture.database.query(
          'SELECT status,hint_level FROM rasa_requests ORDER BY created_at',
        )
      ).rows,
    ).toEqual([
      { status: 'FAILED', hint_level: 1 },
      { status: 'SUCCEEDED', hint_level: 1 },
    ]);
    expect(await hintEffects(fixture)).toEqual([
      { requests: 2, actions: 1, usage: 1, hints: 1, opened: 1 },
    ]);
  });

  it('does not deliver a hint when membership is revoked during provider work', async () => {
    provider = {
      generateHint: async (...args) => {
        await fixture.database.query(
          "UPDATE class_members SET status='DISABLED' WHERE class_id=$1",
          [fixture.lessonClass.id],
        );
        return new LocalRasaProvider().generateHint(...args);
      },
    };
    const { studentApi, deliveries } = connectPhase1(fixture);
    const view = render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson();
    await answerWrong();
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
    expect(deliveries.filter(({ path }) => path.endsWith('/rasa/hints'))[0]?.status).toBe(404);
    expect(await hintEffects(fixture)).toEqual([
      { requests: 1, actions: 0, usage: 0, hints: 0, opened: 0 },
    ]);
    expect(
      (
        await fixture.database.query(
          "SELECT outcome FROM audit_logs WHERE action='RASA_HINT_REJECTED'",
        )
      ).rows,
    ).toEqual([{ outcome: 'DENIED' }]);
    expect(screen.queryByText(/무엇이 계속 유지되는지 먼저 찾아보자/)).toBeNull();
    const terminal = (await fixture.database.query('SELECT * FROM rasa_requests')).rows;
    expect(terminal).toMatchObject([
      { status: 'FAILED', error_code: 'RASA_AUTHORIZATION_REVOKED' },
    ]);
    await fixture.database.query("UPDATE class_members SET status='ACTIVE' WHERE class_id=$1", [
      fixture.lessonClass.id,
    ]);
    view.unmount();
    render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson('M5M6 실제 경계', true);
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('재도전 성공');
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('탐험을 완료했습니다!');
    expect((await fixture.database.query('SELECT * FROM rasa_requests')).rows).toEqual(terminal);
  });

  it('restores exhausted hints from the server on remount without another provider call', async () => {
    const { studentApi } = connectPhase1(fixture);
    const view = render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson();
    await answerWrong();
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText('힌트 1을 확인해 보세요.');
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText('힌트 2');
    expect(screen.getByRole('button', { name: '힌트를 모두 사용했어요' })).toHaveProperty(
      'disabled',
      true,
    );
    view.unmount();
    render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson('M5M6 실제 경계', true);
    expect(screen.getByRole('button', { name: '힌트를 모두 사용했어요' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(providerCalls).toBe(2);
    expect(await hintEffects(fixture)).toEqual([
      { requests: 2, actions: 2, usage: 2, hints: 2, opened: 1 },
    ]);
  });

  it('denies disabled-tenant student discovery and student access to teacher boss actions', async () => {
    const { studentApi, deliveries } = connectPhase1(fixture);
    await fixture.database.query("UPDATE organizations SET status='DISABLED' WHERE id=$1", [
      fixture.organization.id,
    ]);
    const student = render(
      <StudentPlay api={studentApi} organizationId={fixture.organization.id} />,
    );
    await screen.findByText('지금 할 탐험이 없어요.');
    expect(screen.queryByRole('article', { name: 'M5M6 실제 경계' })).toBeNull();
    student.unmount();
    await fixture.database.query("UPDATE organizations SET status='ACTIVE' WHERE id=$1", [
      fixture.organization.id,
    ]);
    render(
      <BossCampaignPanel
        api={studentApi}
        organizationId={fixture.organization.id}
        classId={fixture.lessonClass.id}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '보스 시작' }));
    await screen.findByText('공동 보스를 시작하지 못했습니다.');
    expect(
      deliveries.find(({ path, body }) => path.endsWith('/boss/campaigns') && body !== undefined)
        ?.status,
    ).toBe(404);
    expect((await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual([]);
  });
});
