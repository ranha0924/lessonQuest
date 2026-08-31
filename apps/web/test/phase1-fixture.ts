import { fireEvent, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { createHttpLessonQuestApi } from '../src/api-client.js';
import { m56Origin, m56StudentToken, m56TeacherToken } from './m5-m6-fixture.js';
import type { createM56Fixture } from './m5-m6-fixture.js';

export type Phase1Fixture = Awaited<ReturnType<typeof createM56Fixture>>;
export interface Delivery {
  readonly path: string;
  readonly body: string | undefined;
  readonly type: string | undefined;
  status?: number;
}

// Only transport delivery is replaceable. Every forwarded request still crosses
// the real HTTP client, authentication, Hono routes, repositories and database.
export function connectPhase1(
  fixture: Phase1Fixture,
  intercept?: (delivery: Delivery, forward: () => Promise<Response>) => Promise<Response>,
) {
  const deliveries: Delivery[] = [];
  vi.stubGlobal('fetch', async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    headers.set('origin', m56Origin);
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const parsed: unknown = body === undefined ? undefined : JSON.parse(body);
    const type =
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      typeof parsed.type === 'string'
        ? parsed.type
        : undefined;
    const delivery: Delivery = { path: new URL(url).pathname, body, type };
    deliveries.push(delivery);
    const forward = async () => {
      const response = await fixture.app.request(url, { ...init, headers });
      delivery.status = response.status;
      return response;
    };
    return intercept === undefined ? forward() : intercept(delivery, forward);
  });
  return {
    deliveries,
    studentApi: createHttpLessonQuestApi({
      baseUrl: m56Origin,
      getAuthorization: () => `Bearer ${m56StudentToken}`,
    }),
    teacherApi: createHttpLessonQuestApi({
      baseUrl: m56Origin,
      getAuthorization: () => `Bearer ${m56TeacherToken}`,
    }),
  };
}

export async function enterLesson(title = 'M5M6 실제 경계', resume = false) {
  const card = await screen.findByRole('article', { name: title });
  fireEvent.click(within(card).getByRole('button', { name: resume ? '이어하기' : '탐험 시작' }));
  await screen.findByRole('heading', { name: '가벼운 손수레가 더 빨리 움직이는 이유' });
}

export async function answerWrong() {
  fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
  await screen.findByText('다시 생각해 볼까요?');
}

export const campaignInput = {
  title: '마무리 검증 보스',
  period: { kind: 'SPECIAL' as const, version: 1 },
  targetHp: 100,
  policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
};

export async function hintEffects(fixture: Phase1Fixture) {
  return (
    await fixture.database.query(`SELECT
    (SELECT count(*)::int FROM rasa_requests) requests,
    (SELECT count(*)::int FROM rasa_actions) actions,
    (SELECT count(*)::int FROM ai_usage) usage,
    (SELECT count(*)::int FROM learning_events WHERE type='HINT_USED') hints,
    (SELECT count(*)::int FROM learning_events WHERE type='RASA_OPENED') opened`)
  ).rows;
}
