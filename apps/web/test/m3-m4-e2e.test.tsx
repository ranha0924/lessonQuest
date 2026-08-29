// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { LocalAuthProvider } from '@lessonquest/auth';
import type { Actor } from '@lessonquest/contracts';
import { initializeSchema, LearningRepository, TenantRepository } from '@lessonquest/db';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../services/api/src/app.js';
import { createHttpLessonQuestApi } from '../src/api-client.js';
import { StudentPlay } from '../src/components/student-play.js';

const trustedOrigin = 'https://play.lessonquest.test';
const studentToken = `dev_${'s'.repeat(32)}`;
const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fc01',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27fc02',
  platformRole: 'STUDENT',
  memberships: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('M3/M4 real browser-to-database boundary', () => {
  it('reloads an in-progress attempt without a second start and projects authoritative retry', async () => {
    const database = new PGlite();
    try {
      await initializeSchema(database);
      const tenants = new TenantRepository(database);
      const learning = new LearningRepository(database, {
        now: () => new Date('2026-08-29T12:00:00.000Z'),
      });
      await tenants.upsertUser(teacher);
      await tenants.upsertUser(student);
      const organization = await tenants.createOrganization(teacher, '실경계학교');
      const lessonClass = await tenants.createClass(teacher, organization.id, '통합반');
      await tenants.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);
      const generatedSpecText = await readFile(
        join(process.cwd(), 'packages/science-studio/test/fixtures/force-motion.json'),
        'utf8',
      );
      const version = await learning.createScienceExperience(
        teacher,
        organization.id,
        '실제 재개 체험',
        generatedSpecText,
      );
      await learning.validateExperienceVersion(teacher, organization.id, version.versionId);
      await learning.reviewExperienceVersion(teacher, organization.id, version.versionId, {
        decision: 'APPROVE',
      });
      const assignment = await learning.createAssignment(teacher, organization.id, lessonClass.id, {
        experienceVersionId: version.versionId,
      });
      const auth = new LocalAuthProvider({
        environment: 'test',
        sessions: new Map([[studentToken, student]]),
      });
      const app = createApp({
        auth,
        repository: tenants,
        learningRepository: learning,
        trustedOrigin,
        diagnostics: { record() {} },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('origin', trustedOrigin);
          const requestUrl =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          return app.request(requestUrl, { ...init, headers });
        }),
      );
      const api = createHttpLessonQuestApi({
        baseUrl: trustedOrigin,
        getAuthorization: () => `Bearer ${studentToken}`,
      });

      const firstMount = render(<StudentPlay api={api} organizationId={organization.id} />);
      const firstCard = await screen.findByRole('article', { name: '실제 재개 체험' });
      fireEvent.click(within(firstCard).getByRole('button', { name: '탐험 시작' }));
      await screen.findByRole('heading', { name: '가벼운 손수레가 더 빨리 움직이는 이유' });
      fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
      await screen.findByText('다시 생각해 볼까요?');
      firstMount.unmount();

      render(<StudentPlay api={api} organizationId={organization.id} />);
      const resumedCard = await screen.findByRole('article', { name: '실제 재개 체험' });
      fireEvent.click(within(resumedCard).getByRole('button', { name: '이어하기' }));
      await screen.findByText('다시 생각해 볼까요?');
      fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
      await screen.findByText('재도전 성공');
      fireEvent.click(screen.getByRole('button', { name: '탐험 완료' }));
      await screen.findByText('탐험을 완료했습니다!');

      const events = await database.query<{
        type: string;
        sequence: number;
        payload: unknown;
      }>(
        `SELECT type, sequence, payload
         FROM learning_events
         WHERE assignment_id = $1
         ORDER BY sequence`,
        [assignment.id],
      );
      expect(events.rows.map(({ type, sequence }) => ({ type, sequence }))).toEqual([
        { type: 'EXPERIENCE_STARTED', sequence: 0 },
        { type: 'QUESTION_ANSWERED', sequence: 1 },
        { type: 'ANSWER_RETRIED', sequence: 2 },
        { type: 'EXPERIENCE_COMPLETED', sequence: 3 },
      ]);
      expect(JSON.stringify(events.rows[1]?.payload)).toContain('"correct":false');
      expect(JSON.stringify(events.rows[2]?.payload)).toContain('"correct":true');

      const progress = await learning.listTeacherProgress(
        teacher,
        organization.id,
        lessonClass.id,
        assignment.id,
      );
      expect(progress).toEqual([
        expect.objectContaining({
          studentId: student.userId,
          started: true,
          wrongAnswers: 1,
          retries: 1,
          completed: true,
          lastSequence: 3,
        }),
      ]);
      await waitFor(async () => {
        const audits = await database.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM audit_logs
           WHERE action = 'LEARNING_EVENT_INGESTED'`,
        );
        expect(audits.rows).toEqual([{ count: 4 }]);
      });
    } finally {
      await database.close();
    }
  });
});
