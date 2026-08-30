// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createM56Fixture, m56Origin, m56StudentToken, m56TeacherToken } from './m5-m6-fixture.js';
import { createHttpLessonQuestApi } from '../src/api-client.js';
import { ClassBossCard } from '../src/components/class-boss-card.js';
import { StudentPlay } from '../src/components/student-play.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('M5/M6 real React-to-database boundary', () => {
  it('persists a safe hint and projects correct-first class damage through HTTP', async () => {
    const fixture = await createM56Fixture();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('origin', m56Origin);
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          return fixture.app.request(url, { ...init, headers });
        }),
      );
      const studentApi = createHttpLessonQuestApi({
        baseUrl: m56Origin,
        getAuthorization: () => `Bearer ${m56StudentToken}`,
      });
      const teacherApi = createHttpLessonQuestApi({
        baseUrl: m56Origin,
        getAuthorization: () => `Bearer ${m56TeacherToken}`,
      });
      await teacherApi.createBossCampaign(fixture.organization.id, fixture.lessonClass.id, {
        title: '실제 경계 보스',
        period: { kind: 'SPECIAL', version: 1 },
        targetHp: 100,
        policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
      });

      const firstMount = render(
        <StudentPlay api={studentApi} organizationId={fixture.organization.id} />,
      );
      const card = await screen.findByRole('article', { name: 'M5M6 실제 경계' });
      fireEvent.click(within(card).getByRole('button', { name: '탐험 시작' }));
      await screen.findByRole('heading', { name: '가벼운 손수레가 더 빨리 움직이는 이유' });
      fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
      await screen.findByText('다시 생각해 볼까요?');
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
      firstMount.unmount();
      render(<StudentPlay api={studentApi} organizationId={fixture.organization.id} />);
      const resumed = await screen.findByRole('article', { name: 'M5M6 실제 경계' });
      fireEvent.click(within(resumed).getByRole('button', { name: '이어하기' }));
      await screen.findByText(/무엇이 계속 유지되는지 먼저 찾아보자/);
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('재도전 성공');
      fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
      await screen.findByText('탐험을 완료했습니다!');

      const pendingJobs = await fixture.database.query<{ count: number }>(
        'SELECT COUNT(*)::int count FROM boss_projection_jobs',
      );
      expect(pendingJobs.rows[0]?.count).toBe(3);
      await expect(fixture.database.query('DELETE FROM boss_projection_jobs')).rejects.toThrow(
        /cannot be deleted/,
      );
      await Promise.all([
        fixture.gamification.drainPendingJobs(),
        fixture.gamification.drainPendingJobs(),
      ]);
      const jobAttempts = await fixture.database.query<{ attempts: number; status: string }>(
        'SELECT attempts,status FROM boss_projection_jobs',
      );
      expect(
        jobAttempts.rows.every(({ attempts, status }) => attempts === 1 && status === 'SUCCEEDED'),
      ).toBe(true);
      const progress = await studentApi.getStudentBossProgress(
        fixture.organization.id,
        fixture.lessonClass.id,
      );
      render(<ClassBossCard progress={progress} />);
      expect(await screen.findByRole('heading', { name: '실제 경계 보스' })).toBeTruthy();
      expect(screen.getByText('8 / 100')).toBeTruthy();
      expect(Object.keys(progress ?? {}).sort()).toEqual(
        ['campaignId', 'completed', 'damage', 'targetHp', 'title'].sort(),
      );
      const audits = await fixture.database.query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE action IN ('RASA_HINT_REQUESTED','RASA_HINT_DELIVERED','BOSS_PROJECTION_PROCESSED','BOSS_PROGRESS_READ')`,
      );
      expect(new Set(audits.rows.map(({ action }) => action))).toEqual(
        new Set([
          'RASA_HINT_REQUESTED',
          'RASA_HINT_DELIVERED',
          'BOSS_PROJECTION_PROCESSED',
          'BOSS_PROGRESS_READ',
        ]),
      );
      const traceLineage = await fixture.database.query<{ count: number }>(
        `SELECT COUNT(*)::int count
         FROM boss_projection_jobs j
         JOIN audit_logs projected ON projected.trace_id=j.trace_id
           AND projected.action='BOSS_PROJECTION_PROCESSED' AND projected.resource_id=j.id
         JOIN audit_logs ingested ON ingested.trace_id=j.trace_id
           AND ingested.action='LEARNING_EVENT_INGESTED'`,
      );
      expect(traceLineage.rows[0]?.count).toBe(3);
      const active = await teacherApi.getTeacherBossDetail(
        fixture.organization.id,
        fixture.lessonClass.id,
      );
      const ended = await teacherApi.endBossCampaign(
        fixture.organization.id,
        fixture.lessonClass.id,
        active.campaign.campaignId,
        { requestId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fd90' },
      );
      expect(ended.campaign.status).toBe('ENDED');
      const replacement = await teacherApi.createBossCampaign(
        fixture.organization.id,
        fixture.lessonClass.id,
        {
          title: '교체 보스',
          period: { kind: 'SPECIAL', version: 2 },
          targetHp: 120,
          policy: {
            amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 },
          },
        },
      );
      expect(replacement.campaign).toMatchObject({ title: '교체 보스', status: 'ACTIVE' });
    } finally {
      await fixture.database.close();
    }
  });

  it('replays a terminal 503 through React with the exact request ID', async () => {
    const fixture = await createM56Fixture({
      timeoutMs: 5,
      provider: { generateHint: () => new Promise(() => undefined) },
    });
    try {
      const hintBodies: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('origin', m56Origin);
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (url.endsWith('/rasa/hints') && typeof init?.body === 'string')
            hintBodies.push(init.body);
          return fixture.app.request(url, { ...init, headers });
        }),
      );
      const api = createHttpLessonQuestApi({
        baseUrl: m56Origin,
        getAuthorization: () => `Bearer ${m56StudentToken}`,
      });
      render(<StudentPlay api={api} organizationId={fixture.organization.id} />);
      const card = await screen.findByRole('article', { name: 'M5M6 실제 경계' });
      fireEvent.click(within(card).getByRole('button', { name: '탐험 시작' }));
      await screen.findByRole('heading', { name: '가벼운 손수레가 더 빨리 움직이는 이유' });
      fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
      await screen.findByText('다시 생각해 볼까요?');
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await screen.findByText('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
      fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
      await waitFor(() => expect(hintBodies).toHaveLength(2));
      const requestIds = hintBodies.map((body) => {
        const value: unknown = JSON.parse(body);
        return typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)['requestId']
          : undefined;
      });
      expect(requestIds[0]).toBe(requestIds[1]);
    } finally {
      await fixture.database.close();
    }
  });
});
