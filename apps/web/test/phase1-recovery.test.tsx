// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LocalRasaProvider, type RasaHintProvider } from '@lessonquest/rasa';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudentPlay } from '../src/components/student-play.js';
import { DevelopmentPreview } from '../src/dev-preview/development-preview.js';
import { BossCampaignPanel } from '../src/components/boss-campaign-panel.js';
import { createM56Fixture } from './m5-m6-fixture.js';
import {
  answerWrong,
  campaignInput,
  connectPhase1,
  enterLesson,
  hintEffects,
  type Phase1Fixture,
} from './phase1-fixture.js';

describe('Phase 1 real delivery recovery', () => {
  let fixture: Phase1Fixture;
  let provider: RasaHintProvider;
  beforeEach(async () => {
    provider = new LocalRasaProvider();
    fixture = await createM56Fixture({
      provider: { generateHint: (...args) => provider.generateHint(...args) },
      timeoutMs: 30_000,
    });
  });
  afterEach(async () => {
    cleanup();
    vi.unstubAllGlobals();
    await fixture.database.close();
  });

  for (const lifecycle of ['remount', 'role-switch'] as const) {
    it(`defers ${lifecycle} resume until the disconnected original hint finishes`, async () => {
      let release!: () => void;
      let entered!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const providerEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      provider = {
        generateHint: async (...args) => {
          entered();
          await gate;
          return new LocalRasaProvider().generateHint(...args);
        },
      };
      let originalWork: Promise<Response> | undefined;
      let disconnect = true;
      const { studentApi, teacherApi, deliveries } = connectPhase1(
        fixture,
        async (delivery, forward) => {
          if (delivery.path.endsWith('/rasa/hints') && disconnect) {
            disconnect = false;
            originalWork = forward();
            await providerEntered;
            throw new TypeError('Synthetic lost hint response before leaving player');
          }
          return forward();
        },
      );
      try {
        const view = render(
          lifecycle === 'remount' ? (
            <StudentPlay api={studentApi} organizationId={fixture.organization.id} />
          ) : (
            <DevelopmentPreview
              runtime={{
                organizationId: fixture.organization.id,
                classId: fixture.lessonClass.id,
                studentOfflineQueueKey: `lqs_${'2'.repeat(64)}`,
                teacherApi,
                studentApi,
                sampleDraft: { title: '복구 검증', generatedSpecText: '{}' },
                close: () => Promise.resolve(),
              }}
              reset={() => undefined}
            />
          ),
        );
        if (lifecycle === 'role-switch')
          fireEvent.click(screen.getByRole('button', { name: '학생 화면' }));
        await enterLesson();
        await answerWrong();
        fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
        await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
        if (lifecycle === 'remount') {
          view.unmount();
          render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
        } else {
          fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
          fireEvent.click(screen.getByRole('button', { name: '학생 화면' }));
        }
        const card = await screen.findByRole('article', { name: 'M5M6 실제 경계' });
        await fixture.database.query(
          "UPDATE class_members SET status='DISABLED' WHERE class_id=$1",
          [fixture.lessonClass.id],
        );
        const assignment = await fixture.database.query<{ id: string }>(
          'SELECT id FROM assignments',
        );
        await expect(
          studentApi.startAttempt(fixture.organization.id, assignment.rows[0]!.id),
        ).rejects.toMatchObject({ status: 404 });
        await fixture.database.query("UPDATE class_members SET status='ACTIVE' WHERE class_id=$1", [
          fixture.lessonClass.id,
        ]);
        fireEvent.click(within(card).getByRole('button', { name: '이어하기' }));
        await waitFor(() =>
          expect(deliveries.filter(({ path }) => path.endsWith('/attempts')).at(-1)?.status).toBe(
            409,
          ),
        );
        await screen.findByText('이전 요청을 처리 중이에요. 잠시 후 이어하기를 눌러 주세요.');
        expect(screen.queryByRole('button', { name: '질량 2 kg 선택' })).toBeNull();
        expect(screen.queryByRole('button', { name: '탐험 완료' })).toBeNull();
        expect((await fixture.database.query('SELECT status FROM rasa_requests')).rows).toEqual([
          { status: 'RUNNING' },
        ]);
        release();
        expect((await originalWork)?.status).toBe(200);
        await enterLesson('M5M6 실제 경계', true);
        await screen.findByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.');
        fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
        await screen.findByText('재도전 성공');
        fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
        await screen.findByText('탐험을 완료했습니다!');
        expect(await hintEffects(fixture)).toEqual([
          { requests: 1, actions: 1, usage: 1, hints: 1, opened: 1 },
        ]);
        expect(
          (
            await fixture.database.query(
              'SELECT type,sequence FROM learning_events ORDER BY sequence',
            )
          ).rows,
        ).toEqual([
          { type: 'EXPERIENCE_STARTED', sequence: 0 },
          { type: 'QUESTION_ANSWERED', sequence: 1 },
          { type: 'RASA_OPENED', sequence: 2 },
          { type: 'HINT_USED', sequence: 3 },
          { type: 'ANSWER_RETRIED', sequence: 4 },
          { type: 'EXPERIENCE_COMPLETED', sequence: 5 },
        ]);
      } finally {
        await fixture.database.query("UPDATE class_members SET status='ACTIVE' WHERE class_id=$1", [
          fixture.lessonClass.id,
        ]);
        release();
        await originalWork;
      }
    });
  }

  it('resumes after a terminal finalization failure without changing the failed request', async () => {
    const { studentApi } = connectPhase1(fixture);
    const view = render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson();
    await answerWrong();
    await fixture.database
      .exec(`CREATE FUNCTION reject_resume_hint_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-finalization-fault'; END $$;
      CREATE TRIGGER reject_resume_hint_action BEFORE INSERT ON rasa_actions FOR EACH ROW EXECUTE FUNCTION reject_resume_hint_action();`);
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
    const terminal = (await fixture.database.query('SELECT * FROM rasa_requests')).rows;
    expect(terminal).toMatchObject([{ status: 'FAILED', error_code: 'RASA_FINALIZATION_FAILED' }]);
    await fixture.database.exec('DROP TRIGGER reject_resume_hint_action ON rasa_actions');
    view.unmount();
    render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson('M5M6 실제 경계', true);
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('재도전 성공');
    fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
    await screen.findByText('탐험을 완료했습니다!');
    expect((await fixture.database.query('SELECT * FROM rasa_requests')).rows).toEqual(terminal);
    expect(await hintEffects(fixture)).toEqual([
      { requests: 1, actions: 0, usage: 0, hints: 0, opened: 0 },
    ]);
  });

  for (const replayStatus of [409, 404, 500]) {
    it(`retains uncertainty through a real ${replayStatus} while the disconnected original hint is RUNNING`, async () => {
      let release!: () => void;
      let entered!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const providerEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      provider = {
        generateHint: async (...args) => {
          entered();
          await gate;
          return new LocalRasaProvider().generateHint(...args);
        },
      };
      let originalWork: Promise<Response> | undefined;
      let disconnect = true;
      const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
        if (delivery.path.endsWith('/rasa/hints') && disconnect) {
          disconnect = false;
          originalWork = forward();
          await providerEntered;
          throw new TypeError('Synthetic disconnect while provider continues');
        }
        return forward();
      });
      try {
        render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
        await enterLesson();
        await answerWrong();
        fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
        await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
        if (replayStatus === 404)
          await fixture.database.query(
            "UPDATE class_members SET status='DISABLED' WHERE class_id=$1",
            [fixture.lessonClass.id],
          );
        if (replayStatus === 500)
          await fixture.database
            .exec(`CREATE FUNCTION reject_replay_audit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.action='RASA_HINT_REQUESTED' AND NEW.outcome='CONFLICT' THEN RAISE EXCEPTION 'synthetic-replay-audit-fault'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER reject_replay_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_replay_audit();`);
        fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
        await waitFor(() =>
          expect(deliveries.filter(({ path }) => path.endsWith('/rasa/hints'))[1]?.status).toBe(
            replayStatus,
          ),
        );
        await screen.findByRole('button', { name: '힌트 받기' });
        expect((await fixture.database.query('SELECT status FROM rasa_requests')).rows).toEqual([
          { status: 'RUNNING' },
        ]);
        expect(screen.getByRole('button', { name: '질량 2 kg 선택' })).toHaveProperty(
          'disabled',
          true,
        );
        expect(screen.getByRole('button', { name: '탐험 완료' })).toHaveProperty('disabled', true);
        expect(screen.queryByRole('button', { name: '새 힌트 요청' })).toBeNull();
        if (replayStatus === 404)
          await fixture.database.query(
            "UPDATE class_members SET status='ACTIVE' WHERE class_id=$1",
            [fixture.lessonClass.id],
          );
        if (replayStatus === 500)
          await fixture.database.exec('DROP TRIGGER reject_replay_audit ON audit_logs');
        release();
        expect((await originalWork)?.status).toBe(200);
        fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
        await screen.findByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.');
        const sent = deliveries.filter(({ path }) => path.endsWith('/rasa/hints'));
        expect(sent).toHaveLength(3);
        expect(sent[1]?.body).toBe(sent[0]?.body);
        expect(sent[2]?.body).toBe(sent[0]?.body);
        expect(await hintEffects(fixture)).toEqual([
          { requests: 1, actions: 1, usage: 1, hints: 1, opened: 1 },
        ]);
        fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
        await screen.findByText('재도전 성공');
        fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
        await screen.findByText('탐험을 완료했습니다!');
        expect(
          (
            await fixture.database.query(
              'SELECT type,sequence FROM learning_events ORDER BY sequence',
            )
          ).rows,
        ).toEqual([
          { type: 'EXPERIENCE_STARTED', sequence: 0 },
          { type: 'QUESTION_ANSWERED', sequence: 1 },
          { type: 'RASA_OPENED', sequence: 2 },
          { type: 'HINT_USED', sequence: 3 },
          { type: 'ANSWER_RETRIED', sequence: 4 },
          { type: 'EXPERIENCE_COMPLETED', sequence: 5 },
        ]);
      } finally {
        if (replayStatus === 404)
          await fixture.database.query(
            "UPDATE class_members SET status='ACTIVE' WHERE class_id=$1",
            [fixture.lessonClass.id],
          );
        if (replayStatus === 500)
          await fixture.database.exec('DROP TRIGGER IF EXISTS reject_replay_audit ON audit_logs');
        release();
        await originalWork;
      }
    });
  }

  it('resolves prior hint uncertainty when exact replay confirms a terminal provider failure', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const providerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let calls = 0;
    provider = {
      generateHint: async (...args) => {
        calls++;
        if (calls === 1) {
          entered();
          await gate;
          throw new Error('Synthetic terminal provider failure');
        }
        return new LocalRasaProvider().generateHint(...args);
      },
    };
    let originalWork: Promise<Response> | undefined;
    let disconnect = true;
    const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
      if (delivery.path.endsWith('/rasa/hints') && disconnect) {
        disconnect = false;
        originalWork = forward();
        await providerEntered;
        throw new TypeError('Synthetic disconnect before terminal response');
      }
      return forward();
    });
    try {
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      await enterLesson();
      await answerWrong();
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
      expect(screen.getByRole('button', { name: '질량 2 kg 선택' })).toHaveProperty(
        'disabled',
        true,
      );
      release();
      expect((await originalWork)?.status).toBe(503);
      const failed = (
        await fixture.database.query("SELECT * FROM rasa_requests WHERE status='FAILED'")
      ).rows;
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByRole('button', { name: '새 힌트 요청' });
      expect(screen.getByRole('button', { name: '질량 2 kg 선택' })).toHaveProperty(
        'disabled',
        false,
      );
      fireEvent.click(screen.getByRole('button', { name: '새 힌트 요청' }));
      await screen.findByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.');
      const sent = deliveries.filter(({ path }) => path.endsWith('/rasa/hints'));
      expect(sent).toHaveLength(3);
      expect(sent[1]?.body).toBe(sent[0]?.body);
      expect(sent[2]?.body).not.toBe(sent[0]?.body);
      expect(
        (await fixture.database.query("SELECT * FROM rasa_requests WHERE status='FAILED'")).rows,
      ).toEqual(failed);
      expect(await hintEffects(fixture)).toEqual([
        { requests: 2, actions: 1, usage: 1, hints: 1, opened: 1 },
      ]);
      expect(calls).toBe(2);
    } finally {
      release();
      await originalWork;
    }
  });

  for (const afterCommit of [false, true]) {
    it(`recovers starting after ${afterCommit ? 'response loss' : 'pre-commit failure'} and ignores double start`, async () => {
      let lose = true;
      const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
        if (delivery.type === 'EXPERIENCE_STARTED' && lose) {
          lose = false;
          if (afterCommit) await forward();
          throw new TypeError('synthetic start delivery failure');
        }
        return forward();
      });
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      const start = await screen.findByRole('button', { name: '탐험 시작' });
      fireEvent.click(start);
      fireEvent.click(start);
      await screen.findByText('탐험을 시작하지 못했어요.');
      expect(deliveries.filter(({ path }) => path.endsWith('/attempts'))).toHaveLength(1);
      await enterLesson();
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('정답이에요!');
      expect(deliveries.filter(({ path }) => path.endsWith('/attempts'))).toHaveLength(2);
      expect(
        (
          await fixture.database.query(
            'SELECT type,sequence FROM learning_events ORDER BY sequence',
          )
        ).rows,
      ).toEqual([
        { type: 'EXPERIENCE_STARTED', sequence: 0 },
        { type: 'QUESTION_ANSWERED', sequence: 1 },
      ]);
      expect((await fixture.database.query('SELECT count(*)::int n FROM attempts')).rows).toEqual([
        { n: 1 },
      ]);
    });

    it(`retains the exact answer and blocks competing writes after ${afterCommit ? 'response loss' : 'pre-commit failure'}`, async () => {
      let lose = true;
      const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
        if (delivery.type === 'QUESTION_ANSWERED' && lose) {
          lose = false;
          if (afterCommit) await forward();
          throw new TypeError('synthetic delivery failure');
        }
        return forward();
      });
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      await enterLesson();
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('답을 기록하지 못했어요.');
      expect(screen.queryByText('정답이에요!')).toBeNull();
      expect(screen.getByRole('button', { name: '질량 6 kg 선택' })).toHaveProperty(
        'disabled',
        true,
      );
      expect(screen.getByRole('button', { name: '탐험 완료' })).toHaveProperty('disabled', true);
      fireEvent.click(screen.getByRole('button', { name: '기록 다시 전송' }));
      await screen.findByText('정답이에요!');
      const sent = deliveries.filter(({ type }) => type === 'QUESTION_ANSWERED');
      expect(sent).toHaveLength(2);
      expect(sent[1]?.body).toBe(sent[0]?.body);
      expect(sent[1]?.status).toBe(afterCommit ? 200 : 202);
      expect(
        (
          await fixture.database.query(
            'SELECT type,sequence FROM learning_events ORDER BY sequence',
          )
        ).rows,
      ).toEqual([
        { type: 'EXPERIENCE_STARTED', sequence: 0 },
        { type: 'QUESTION_ANSWERED', sequence: 1 },
      ]);
      expect(
        (await fixture.database.query('SELECT wrong_answers,retries FROM student_progress')).rows,
      ).toEqual([{ wrong_answers: 0, retries: 0 }]);
    });
  }

  for (const afterCommit of [false, true]) {
    it(`retries completion after ${afterCommit ? 'response loss' : 'pre-commit failure'} without duplicating progress or contribution`, async () => {
      let lose = true;
      const { studentApi, teacherApi, deliveries } = connectPhase1(
        fixture,
        async (delivery, forward) => {
          if (delivery.type === 'EXPERIENCE_COMPLETED' && lose) {
            lose = false;
            if (afterCommit) await forward();
            throw new TypeError('synthetic completion response loss');
          }
          return forward();
        },
      );
      await teacherApi.createBossCampaign(
        fixture.organization.id,
        fixture.lessonClass.id,
        campaignInput,
      );
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      await enterLesson();
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('정답이에요!');
      fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
      await screen.findByText('완료를 기록하지 못했어요.');
      expect(screen.getByRole('button', { name: '탐험 완료' })).toHaveProperty('disabled', true);
      fireEvent.click(screen.getByRole('button', { name: '기록 다시 전송' }));
      await screen.findByText('탐험을 완료했습니다!');
      await fixture.gamification.drainPendingJobs();
      expect(
        await studentApi.getStudentBossProgress(fixture.organization.id, fixture.lessonClass.id),
      ).toMatchObject({ damage: 7 });
      const completed = deliveries.filter(({ type }) => type === 'EXPERIENCE_COMPLETED');
      expect(completed).toHaveLength(2);
      expect(completed[1]?.body).toBe(completed[0]?.body);
      expect(
        (
          await fixture.database.query(
            "SELECT count(*)::int n FROM learning_events WHERE type='EXPERIENCE_COMPLETED'",
          )
        ).rows,
      ).toEqual([{ n: 1 }]);
    });
  }

  for (const afterCommit of [false, true]) {
    it(`retries a hint after ${afterCommit ? 'response loss' : 'pre-commit failure'} without a second hint and resumes server sequence`, async () => {
      let lose = true;
      const { studentApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
        if (delivery.path.endsWith('/rasa/hints') && lose) {
          lose = false;
          if (afterCommit) await forward();
          throw new TypeError('synthetic hint response loss');
        }
        return forward();
      });
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      await enterLesson();
      await answerWrong();
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
      expect(screen.getByRole('button', { name: '질량 2 kg 선택' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
      const sent = deliveries.filter(({ path }) => path.endsWith('/rasa/hints'));
      expect(sent).toHaveLength(2);
      expect(sent[1]?.body).toBe(sent[0]?.body);
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('재도전 성공');
      expect(await hintEffects(fixture)).toEqual([
        { requests: 1, actions: 1, usage: 1, hints: 1, opened: 1 },
      ]);
      expect(
        (
          await fixture.database.query(
            'SELECT type,sequence FROM learning_events ORDER BY sequence',
          )
        ).rows,
      ).toEqual([
        { type: 'EXPERIENCE_STARTED', sequence: 0 },
        { type: 'QUESTION_ANSWERED', sequence: 1 },
        { type: 'RASA_OPENED', sequence: 2 },
        { type: 'HINT_USED', sequence: 3 },
        { type: 'ANSWER_RETRIED', sequence: 4 },
      ]);
    });
  }

  it('blocks answer writes while the real hint response is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { studentApi } = connectPhase1(fixture, async (delivery, forward) => {
      if (delivery.path.endsWith('/rasa/hints')) await gate;
      return forward();
    });
    render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
    await enterLesson();
    await answerWrong();
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    try {
      await screen.findByRole('button', { name: '힌트 준비 중' });
      expect(screen.getByRole('button', { name: '질량 2 kg 선택' })).toHaveProperty(
        'disabled',
        true,
      );
      expect(screen.getByRole('button', { name: '탐험 완료' })).toHaveProperty('disabled', true);
    } finally {
      release();
      await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
    }
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    await screen.findByText('재도전 성공');
  });

  it('retains the end request identity after the server ended the boss but its response was lost', async () => {
    let lose = true;
    const { teacherApi, deliveries } = connectPhase1(fixture, async (delivery, forward) => {
      const response = await forward();
      if (delivery.path.endsWith('/end') && lose) {
        lose = false;
        throw new TypeError('synthetic end response loss');
      }
      return response;
    });
    await teacherApi.createBossCampaign(
      fixture.organization.id,
      fixture.lessonClass.id,
      campaignInput,
    );
    render(
      <BossCampaignPanel
        api={teacherApi}
        organizationId={fixture.organization.id}
        classId={fixture.lessonClass.id}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: '보스 종료' }));
    await screen.findByText('공동 보스를 종료하지 못했습니다.');
    const ended = (await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows;
    fireEvent.click(screen.getByRole('button', { name: '보스 종료' }));
    await screen.findByText('공동 보스를 종료했습니다. 새 보스를 시작할 수 있습니다.');
    const sent = deliveries.filter(({ path }) => path.endsWith('/end'));
    expect(sent).toHaveLength(2);
    expect(sent[1]?.body).toBe(sent[0]?.body);
    expect((await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual(
      ended,
    );
    expect(
      (
        await fixture.database.query(
          "SELECT outcome FROM audit_logs WHERE action='BOSS_CAMPAIGN_ENDED' ORDER BY occurred_at",
        )
      ).rows,
    ).toEqual([{ outcome: 'SUCCEEDED' }, { outcome: 'DUPLICATE' }]);
  });
});
