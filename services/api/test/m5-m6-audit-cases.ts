import { randomUUID } from 'node:crypto';

import {
  attemptSessionSchema,
  playerSessionSchema,
  teacherBossDetailSchema,
} from '@lessonquest/contracts';
import { RasaRepository, ResourceNotFoundError, TenantRepository } from '@lessonquest/db';
import { LocalRasaProvider, type RasaHintProvider } from '@lessonquest/rasa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiDiagnosticEvent } from '../src/app.js';

import {
  createM56Fixture,
  m56Origin,
  m56Student,
  m56StudentToken,
  m56Teacher,
  m56TeacherToken,
} from '../../../tests/helpers/m5-m6-fixture.js';

const campaignInput = {
  title: '감사 검증용 합성 보스',
  period: { kind: 'SPECIAL', version: 1 },
  targetHp: 100,
  policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
};

// These tests catch missing post-rollback effects, incorrect trace/outcome/resource
// attribution, and replay paths that mutate durable business evidence.
describe('M5/M6 durable decision audits', () => {
  let fixture: Awaited<ReturnType<typeof createM56Fixture>>;
  let provider: RasaHintProvider;
  let diagnostics: ApiDiagnosticEvent[];
  beforeEach(async () => {
    diagnostics = [];
    provider = new LocalRasaProvider();
    fixture = await createM56Fixture({
      provider: { generateHint: (...args) => provider.generateHint(...args) },
      diagnostics: {
        record: (event) => {
          diagnostics.push(event);
        },
      },
    });
  });
  afterEach(async () => fixture?.database.close());

  const request = (path: string, token: string, body?: unknown) =>
    fixture.app.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        origin: m56Origin,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const classPath = () =>
    `/organizations/${fixture.organization.id}/classes/${fixture.lessonClass.id}`;
  const hint = (input: unknown, path = classPath()) =>
    request(`${path}/rasa/hints`, m56StudentToken, input);
  const audits = async (traceId: string | null) => {
    expect(traceId).toBeTruthy();
    return (
      await fixture.database.query(
        'SELECT trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome FROM audit_logs WHERE trace_id=$1 ORDER BY occurred_at,id',
        [traceId],
      )
    ).rows;
  };
  async function expectDecision(
    response: Response,
    expected: {
      action: string;
      resourceType: string;
      resourceId: string;
      outcome: 'DENIED' | 'CONFLICT';
      actorId?: string;
      organizationId?: string;
    },
  ) {
    const traceId = response.headers.get('x-trace-id');
    expect(response.status).toBe(expected.outcome === 'DENIED' ? 404 : 409);
    expect(await response.json()).toEqual({
      error: {
        code: expected.outcome === 'DENIED' ? 'RESOURCE_NOT_FOUND' : 'RESOURCE_CONFLICT',
        message:
          expected.outcome === 'DENIED'
            ? '요청한 정보를 찾을 수 없습니다.'
            : '이미 처리된 요청입니다.',
        retryable: false,
        traceId,
      },
    });
    expect(await audits(traceId)).toEqual([
      {
        trace_id: traceId,
        actor_user_id: expected.actorId ?? m56Student.userId,
        organization_id: expected.organizationId ?? fixture.organization.id,
        action: expected.action,
        resource_type: expected.resourceType,
        resource_id: expected.resourceId,
        outcome: expected.outcome,
      },
    ]);
  }
  async function startAttempt(wrongAnswer = true) {
    const prefix = `/organizations/${fixture.organization.id}`;
    const started = await request(
      `${prefix}/assignments/${fixture.assignment.id}/attempts`,
      m56StudentToken,
      {},
    );
    expect(started.status).toBe(201);
    const attempt = attemptSessionSchema.parse(await started.json());
    const playerResponse = await request(
      `${prefix}/assignments/${fixture.assignment.id}/player`,
      m56StudentToken,
    );
    const player = playerSessionSchema.parse(await playerResponse.json());
    const base = {
      schemaVersion: 1,
      organizationId: fixture.organization.id,
      assignmentId: fixture.assignment.id,
      attemptId: attempt.id,
      experienceId: player.experienceId,
      experienceVersion: player.experienceVersion,
      occurredAt: '2026-08-29T12:00:00.000Z',
    };
    expect(
      (
        await request(`${prefix}/learning-events`, m56StudentToken, {
          ...base,
          eventId: randomUUID(),
          type: 'EXPERIENCE_STARTED',
          stepId: 'start',
          sequence: 0,
          payload: {},
        })
      ).status,
    ).toBe(202);
    if (wrongAnswer)
      expect(
        (
          await request(`${prefix}/learning-events`, m56StudentToken, {
            ...base,
            eventId: randomUUID(),
            type: 'QUESTION_ANSWERED',
            stepId: 'quiz_force',
            sequence: 1,
            payload: { optionId: 'heavy', attempt: 1, elapsedMs: 10 },
          })
        ).status,
      ).toBe(202);
    return { requestId: randomUUID(), attemptId: attempt.id, stepId: 'quiz_force' };
  }
  async function effects() {
    return (
      await fixture.database.query(`SELECT
      (SELECT COUNT(*)::int FROM rasa_requests) requests,
      (SELECT COUNT(*)::int FROM rasa_actions) actions,
      (SELECT COUNT(*)::int FROM ai_usage) usage,
      (SELECT COUNT(*)::int FROM learning_events) events,
      (SELECT COUNT(*)::int FROM class_boss_campaigns) campaigns`)
    ).rows;
  }

  it('preserves a pre-answer conflict after rolling back the request success audit', async () => {
    const input = await startAttempt(false);
    const before = await effects();
    await expectDecision(await hint(input), {
      action: 'RASA_HINT_REQUESTED',
      resourceType: 'RASA_REQUEST',
      resourceId: input.requestId,
      outcome: 'CONFLICT',
    });
    expect(await effects()).toEqual(before);
  });

  it('audits changed hint identity but exact replay leaves one durable hint effect', async () => {
    const input = await startAttempt();
    const first = await hint(input);
    expect(first.status).toBe(200);
    const firstBody: unknown = await first.json();
    const before = await effects();
    await expectDecision(await hint({ ...input, stepId: 'changed_step' }), {
      action: 'RASA_HINT_REQUESTED',
      resourceType: 'RASA_REQUEST',
      resourceId: input.requestId,
      outcome: 'CONFLICT',
    });
    const replay = await hint(input);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ...(firstBody as object), duplicate: true });
    expect(await audits(replay.headers.get('x-trace-id'))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'RASA_HINT_DELIVERED',
          outcome: 'DUPLICATE',
          resource_id: input.requestId,
        }),
      ]),
    );
    expect(await effects()).toEqual(before);
    expect(before).toEqual([{ requests: 1, actions: 1, usage: 1, events: 4, campaigns: 0 }]);
  });

  it('audits exhausted levels without persisting a third request or hint', async () => {
    const input = await startAttempt();
    expect((await hint(input)).status).toBe(200);
    expect((await hint({ ...input, requestId: randomUUID() })).status).toBe(200);
    const before = await effects();
    const third = { ...input, requestId: randomUUID() };
    await expectDecision(await hint(third), {
      action: 'RASA_HINT_REQUESTED',
      resourceType: 'RASA_REQUEST',
      resourceId: third.requestId,
      outcome: 'CONFLICT',
    });
    expect(await effects()).toEqual(before);
  });

  it('audits cross-tenant, missing-class and removed-member hint denials without disclosing a replay', async () => {
    const input = await startAttempt();
    expect((await hint(input)).status).toBe(200);
    const before = await effects();
    const tenants = new TenantRepository(fixture.database);
    const otherOrg = await tenants.createOrganization(m56Teacher, '다른 합성 학교');
    const otherClass = await tenants.createClass(m56Teacher, otherOrg.id, '다른 반');
    await expectDecision(
      await hint(input, `/organizations/${otherOrg.id}/classes/${otherClass.id}`),
      {
        action: 'RASA_HINT_REQUESTED',
        resourceType: 'RASA_REQUEST',
        resourceId: input.requestId,
        outcome: 'DENIED',
        organizationId: otherOrg.id,
      },
    );
    await expectDecision(
      await hint(input, `/organizations/${fixture.organization.id}/classes/${randomUUID()}`),
      {
        action: 'RASA_HINT_REQUESTED',
        resourceType: 'RASA_REQUEST',
        resourceId: input.requestId,
        outcome: 'DENIED',
      },
    );
    await fixture.database.query("UPDATE class_members SET status='DISABLED' WHERE user_id=$1", [
      m56Student.userId,
    ]);
    await expectDecision(await hint(input), {
      action: 'RASA_HINT_REQUESTED',
      resourceType: 'RASA_REQUEST',
      resourceId: input.requestId,
      outcome: 'DENIED',
    });
    expect(await effects()).toEqual(before);
  });

  it('records unknown repository actors without FK failure or changing the denial', async () => {
    const input = await startAttempt();
    const unknownId = randomUUID();
    const unknownOrg = randomUUID();
    const traceId = randomUUID();
    await expect(
      new RasaRepository(fixture.database).requestHint(
        { ...m56Student, userId: unknownId },
        unknownOrg,
        randomUUID(),
        input,
        traceId,
        { provider },
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(await audits(traceId)).toEqual([
      {
        trace_id: traceId,
        actor_user_id: unknownId,
        organization_id: unknownOrg,
        action: 'RASA_HINT_REQUESTED',
        resource_type: 'RASA_REQUEST',
        resource_id: input.requestId,
        outcome: 'DENIED',
      },
    ]);
  });

  it('classifies provider-time revocation as one DENIED terminal audit with no hint effects', async () => {
    const input = await startAttempt();
    provider = {
      generateHint: async (...args) => {
        const result = await new LocalRasaProvider().generateHint(...args);
        await fixture.database.query(
          "UPDATE class_members SET status='DISABLED' WHERE user_id=$1",
          [m56Student.userId],
        );
        return result;
      },
    };
    const response = await hint(input);
    expect(response.status).toBe(404);
    const traceId = response.headers.get('x-trace-id');
    expect(await response.json()).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND', traceId } });
    const rows = await audits(traceId);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'RASA_HINT_REQUESTED',
          outcome: 'SUCCEEDED',
          resource_id: input.requestId,
        }),
        expect.objectContaining({
          action: 'RASA_HINT_REJECTED',
          outcome: 'DENIED',
          resource_id: input.requestId,
        }),
      ]),
    );
    expect(await effects()).toEqual([
      { requests: 1, actions: 0, usage: 0, events: 2, campaigns: 0 },
    ]);
    expect(
      (
        await fixture.database.query('SELECT status,error_code FROM rasa_requests WHERE id=$1', [
          input.requestId,
        ])
      ).rows,
    ).toEqual([{ status: 'FAILED', error_code: 'RASA_AUTHORIZATION_REVOKED' }]);
  });

  it.each([
    {
      suffix: '/boss/campaigns',
      action: 'BOSS_CAMPAIGN_CREATED',
      token: m56StudentToken,
      actor: m56Student,
      body: campaignInput,
    },
    {
      suffix: '/boss',
      action: 'BOSS_PROGRESS_READ',
      token: m56TeacherToken,
      actor: m56Teacher,
      body: undefined,
    },
    {
      suffix: '/boss/detail',
      action: 'BOSS_DETAIL_READ',
      token: m56StudentToken,
      actor: m56Student,
      body: undefined,
    },
  ])(
    'durably audits wrong-role and missing-scope $action decisions',
    async ({ suffix, action, token, actor, body }) => {
      const before = await effects();
      await expectDecision(await request(`${classPath()}${suffix}`, token, body), {
        action,
        resourceType: 'CLASS',
        resourceId: fixture.lessonClass.id,
        outcome: 'DENIED',
        actorId: actor.userId,
      });
      const missingOrg = randomUUID(),
        missingClass = randomUUID();
      await expectDecision(
        await request(`/organizations/${missingOrg}/classes/${missingClass}${suffix}`, token, body),
        {
          action,
          resourceType: 'CLASS',
          resourceId: missingClass,
          outcome: 'DENIED',
          actorId: actor.userId,
          organizationId: missingOrg,
        },
      );
      expect(await effects()).toEqual(before);
    },
  );

  it('records active-campaign conflicts after rollback and keeps the original campaign', async () => {
    const path = `${classPath()}/boss/campaigns`;
    expect((await request(path, m56TeacherToken, campaignInput)).status).toBe(201);
    await expectDecision(
      await request(path, m56TeacherToken, { ...campaignInput, title: '기록하면 안 되는 제목' }),
      {
        action: 'BOSS_CAMPAIGN_CREATED',
        resourceType: 'CLASS',
        resourceId: fixture.lessonClass.id,
        outcome: 'CONFLICT',
        actorId: m56Teacher.userId,
      },
    );
    expect(
      (await fixture.database.query('SELECT title,status FROM class_boss_campaigns')).rows,
    ).toEqual([{ title: campaignInput.title, status: 'ACTIVE' }]);
    const all = JSON.stringify((await fixture.database.query('SELECT * FROM audit_logs')).rows);
    for (const secret of [
      campaignInput.title,
      '기록하면 안 되는 제목',
      m56TeacherToken,
      'quiz_force',
    ])
      expect(all).not.toContain(secret);
  });

  it.each(['create', 'student read', 'teacher detail', 'end', 'end replay'] as const)(
    'denies %s for a disabled organization before any boss effect or replay',
    async (operation) => {
      let campaignId: string = randomUUID();
      const endInput = { requestId: randomUUID() };
      if (operation !== 'create') {
        const created = await request(
          `${classPath()}/boss/campaigns`,
          m56TeacherToken,
          campaignInput,
        );
        expect(created.status).toBe(201);
        campaignId = teacherBossDetailSchema.parse(await created.json()).campaign.campaignId;
      }
      const endPath = `${classPath()}/boss/campaigns/${campaignId}/end`;
      if (operation === 'end replay') {
        expect((await request(endPath, m56TeacherToken, endInput)).status).toBe(200);
      }
      const before = (await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows;
      await fixture.database.query("UPDATE organizations SET status='DISABLED' WHERE id=$1", [
        fixture.organization.id,
      ]);
      const isEnd = operation === 'end' || operation === 'end replay';
      const isStudent = operation === 'student read';
      const path = isEnd
        ? endPath
        : `${classPath()}/boss${operation === 'create' ? '/campaigns' : operation === 'teacher detail' ? '/detail' : ''}`;
      const response = await request(
        path,
        isStudent ? m56StudentToken : m56TeacherToken,
        operation === 'create' ? campaignInput : isEnd ? endInput : undefined,
      );
      await expectDecision(response, {
        action: isEnd
          ? 'BOSS_CAMPAIGN_ENDED'
          : operation === 'create'
            ? 'BOSS_CAMPAIGN_CREATED'
            : isStudent
              ? 'BOSS_PROGRESS_READ'
              : 'BOSS_DETAIL_READ',
        resourceType: isEnd ? 'BOSS_CAMPAIGN' : 'CLASS',
        resourceId: isEnd ? campaignId : fixture.lessonClass.id,
        outcome: 'DENIED',
        actorId: isStudent ? m56Student.userId : m56Teacher.userId,
      });
      expect((await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual(
        before,
      );
      expect((await fixture.database.query('SELECT * FROM boss_contributions')).rows).toEqual([]);
    },
  );

  it('records all four boss decisions against an existing foreign tenant without exposing its data', async () => {
    const tenants = new TenantRepository(fixture.database);
    const foreignTeacher = { ...m56Teacher, userId: randomUUID() };
    await tenants.upsertUser(foreignTeacher);
    const foreignOrg = await tenants.createOrganization(foreignTeacher, '비공개 합성 기관');
    const foreignClass = await tenants.createClass(foreignTeacher, foreignOrg.id, '비공개 합성 반');
    const foreignCampaign = await fixture.gamification.createCampaign(
      foreignTeacher,
      foreignOrg.id,
      foreignClass.id,
      { ...campaignInput, period: { kind: 'SPECIAL', version: 1 } },
      randomUUID(),
    );
    const campaignId = foreignCampaign.campaign.campaignId;
    const prefix = `/organizations/${foreignOrg.id}/classes/${foreignClass.id}`;
    const before = await effects();
    const cases = [
      {
        suffix: '/boss/campaigns',
        action: 'BOSS_CAMPAIGN_CREATED',
        token: m56TeacherToken,
        actor: m56Teacher,
        body: campaignInput,
        resourceType: 'CLASS',
        resourceId: foreignClass.id,
      },
      {
        suffix: `/boss/campaigns/${campaignId}/end`,
        action: 'BOSS_CAMPAIGN_ENDED',
        token: m56TeacherToken,
        actor: m56Teacher,
        body: { requestId: randomUUID() },
        resourceType: 'BOSS_CAMPAIGN',
        resourceId: campaignId,
      },
      {
        suffix: '/boss',
        action: 'BOSS_PROGRESS_READ',
        token: m56StudentToken,
        actor: m56Student,
        body: undefined,
        resourceType: 'CLASS',
        resourceId: foreignClass.id,
      },
      {
        suffix: '/boss/detail',
        action: 'BOSS_DETAIL_READ',
        token: m56TeacherToken,
        actor: m56Teacher,
        body: undefined,
        resourceType: 'CLASS',
        resourceId: foreignClass.id,
      },
    ];
    for (const testCase of cases) {
      await expectDecision(
        await request(`${prefix}${testCase.suffix}`, testCase.token, testCase.body),
        {
          action: testCase.action,
          resourceType: testCase.resourceType,
          resourceId: testCase.resourceId,
          outcome: 'DENIED',
          actorId: testCase.actor.userId,
          organizationId: foreignOrg.id,
        },
      );
    }
    expect(await effects()).toEqual(before);
    expect(
      (
        await fixture.database.query('SELECT status FROM class_boss_campaigns WHERE id=$1', [
          campaignId,
        ])
      ).rows,
    ).toEqual([{ status: 'ACTIVE' }]);
  });

  it('rejects a concurrent same-ID hint while retaining its conflict trace and one accepted effect', async () => {
    const input = await startAttempt();
    let release!: () => void;
    let entered!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const providerRelease = new Promise<void>((resolve) => {
      release = resolve;
    });
    provider = {
      generateHint: async (...args) => {
        entered();
        await providerRelease;
        return new LocalRasaProvider().generateHint(...args);
      },
    };
    const first = hint(input);
    try {
      await providerStarted;
      await expectDecision(await hint(input), {
        action: 'RASA_HINT_REQUESTED',
        resourceType: 'RASA_REQUEST',
        resourceId: input.requestId,
        outcome: 'CONFLICT',
      });
    } finally {
      release();
    }
    expect((await first).status).toBe(200);
    expect(await effects()).toEqual([
      { requests: 1, actions: 1, usage: 1, events: 4, campaigns: 0 },
    ]);
  });

  it('does not fabricate repository actors or decision audits for invalid authentication and input', async () => {
    const path = `${classPath()}/rasa/hints`;
    const noAuth = await fixture.app.request(path, { method: 'POST' });
    const unknownAuth = await request(path, `dev_${'x'.repeat(32)}`, {});
    const malformed = await request(path, m56StudentToken, { requestId: 'not-a-uuid' });
    for (const [response, status] of [
      [noAuth, 401],
      [unknownAuth, 401],
      [malformed, 400],
    ] as const) {
      expect(response.status).toBe(status);
      expect(await audits(response.headers.get('x-trace-id'))).toEqual([]);
    }
    expect(await effects()).toEqual([
      { requests: 0, actions: 0, usage: 0, events: 0, campaigns: 0 },
    ]);
  });

  it('audits end denial, exact replay and changed-identity conflict without rewriting lifecycle', async () => {
    const created = await request(`${classPath()}/boss/campaigns`, m56TeacherToken, campaignInput);
    const detail = teacherBossDetailSchema.parse(await created.json());
    const id = detail.campaign.campaignId;
    const endPath = `${classPath()}/boss/campaigns/${id}/end`;
    const endInput = { requestId: randomUUID() };
    await expectDecision(await request(endPath, m56StudentToken, endInput), {
      action: 'BOSS_CAMPAIGN_ENDED',
      resourceType: 'BOSS_CAMPAIGN',
      resourceId: id,
      outcome: 'DENIED',
    });
    const missingId = randomUUID();
    await expectDecision(
      await request(`${classPath()}/boss/campaigns/${missingId}/end`, m56TeacherToken, endInput),
      {
        action: 'BOSS_CAMPAIGN_ENDED',
        resourceType: 'BOSS_CAMPAIGN',
        resourceId: missingId,
        outcome: 'DENIED',
        actorId: m56Teacher.userId,
      },
    );
    expect((await request(endPath, m56TeacherToken, endInput)).status).toBe(200);
    const before = (await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows;
    const duplicate = await request(endPath, m56TeacherToken, endInput);
    expect(duplicate.status).toBe(200);
    expect(await audits(duplicate.headers.get('x-trace-id'))).toEqual([
      {
        trace_id: duplicate.headers.get('x-trace-id'),
        actor_user_id: m56Teacher.userId,
        organization_id: fixture.organization.id,
        action: 'BOSS_CAMPAIGN_ENDED',
        resource_type: 'BOSS_CAMPAIGN',
        resource_id: id,
        outcome: 'DUPLICATE',
      },
    ]);
    await expectDecision(await request(endPath, m56TeacherToken, { requestId: randomUUID() }), {
      action: 'BOSS_CAMPAIGN_ENDED',
      resourceType: 'BOSS_CAMPAIGN',
      resourceId: id,
      outcome: 'CONFLICT',
      actorId: m56Teacher.userId,
    });
    expect((await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual(
      before,
    );
  });

  it('fails safely when post-rollback audit storage fails and never persists the denied operation', async () => {
    const input = await startAttempt(false);
    await fixture.database
      .exec(`CREATE FUNCTION reject_decision_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.outcome IN ('DENIED','CONFLICT') THEN RAISE EXCEPTION 'synthetic-private-audit-fault'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_decision_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_decision_audit();`);
    const before = await effects();
    const response = await hint(input);
    expect(response.status).toBe(500);
    const traceId = response.headers.get('x-trace-id');
    const body: unknown = await response.json();
    expect(body).toMatchObject({ error: { code: 'INTERNAL_ERROR', traceId } });
    expect(JSON.stringify(body)).not.toContain('synthetic-private-audit-fault');
    expect(await audits(traceId)).toEqual([]);
    expect(await effects()).toEqual(before);
  });

  it('does not classify unexpected database faults as authorization or semantic decisions', async () => {
    await fixture.database
      .exec(`CREATE FUNCTION reject_campaign_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action='BOSS_CAMPAIGN_CREATED' AND NEW.outcome='SUCCEEDED' THEN
        RAISE EXCEPTION 'synthetic-private-database-fault'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_campaign_write BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_campaign_write();`);
    const response = await request(`${classPath()}/boss/campaigns`, m56TeacherToken, campaignInput);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('synthetic-private-database-fault');
    expect(await audits(response.headers.get('x-trace-id'))).toEqual([]);
    expect((await fixture.database.query('SELECT * FROM class_boss_campaigns')).rows).toEqual([]);
  });

  it('classifies finalization storage failure accurately and replays it without a second provider call', async () => {
    const input = await startAttempt();
    let calls = 0;
    provider = {
      generateHint: (...args) => {
        calls++;
        return new LocalRasaProvider().generateHint(...args);
      },
    };
    await fixture.database
      .exec(`CREATE FUNCTION reject_hint_action() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic-private-finalization-fault'; END $$;
      CREATE TRIGGER reject_hint_action BEFORE INSERT ON rasa_actions FOR EACH ROW EXECUTE FUNCTION reject_hint_action();`);
    const first = await hint(input);
    expect(first.status).toBe(503);
    const traceId = first.headers.get('x-trace-id');
    const body: unknown = await first.json();
    expect(body).toMatchObject({
      error: { code: 'RASA_FINALIZATION_FAILED', retryable: true, traceId },
    });
    expect(JSON.stringify(body)).not.toContain('synthetic-private-finalization-fault');
    expect(diagnostics).toHaveLength(1);
    const { durationMs, ...diagnostic } = diagnostics[0]!;
    expect(durationMs).toBeGreaterThanOrEqual(0);
    expect(diagnostic).toEqual({
      type: 'API_ERROR',
      traceId,
      code: 'RASA_FINALIZATION_FAILED',
      status: 503,
      retryable: true,
      method: 'POST',
      organizationId: fixture.organization.id,
      resourceId: fixture.lessonClass.id,
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /synthetic-private|dev_|authorization|cause|stack/i,
    );
    expect(
      (await fixture.database.query('SELECT status,error_code FROM rasa_requests')).rows,
    ).toEqual([{ status: 'FAILED', error_code: 'RASA_FINALIZATION_FAILED' }]);
    expect(await effects()).toEqual([
      { requests: 1, actions: 0, usage: 0, events: 2, campaigns: 0 },
    ]);
    expect(await audits(traceId)).toEqual([
      {
        trace_id: traceId,
        actor_user_id: m56Student.userId,
        organization_id: fixture.organization.id,
        action: 'RASA_HINT_REQUESTED',
        resource_type: 'RASA_REQUEST',
        resource_id: input.requestId,
        outcome: 'SUCCEEDED',
      },
    ]);
    const failed = (await fixture.database.query('SELECT * FROM rasa_requests')).rows;
    await fixture.database.exec('DROP TRIGGER reject_hint_action ON rasa_actions');
    const replay = await hint(input);
    expect(replay.status).toBe(503);
    expect(await replay.json()).toMatchObject({
      error: { code: 'RASA_FINALIZATION_FAILED', retryable: true },
    });
    expect(calls).toBe(1);
    expect((await fixture.database.query('SELECT * FROM rasa_requests')).rows).toEqual(failed);
    expect(await effects()).toEqual([
      { requests: 1, actions: 0, usage: 0, events: 2, campaigns: 0 },
    ]);
    expect((await hint({ ...input, requestId: randomUUID() })).status).toBe(200);
    expect(calls).toBe(2);
    expect(await effects()).toEqual([
      { requests: 2, actions: 1, usage: 1, events: 4, campaigns: 0 },
    ]);
  });

  it('keeps a revoked terminal request denied after membership is reactivated', async () => {
    const input = await startAttempt();
    let calls = 0;
    provider = {
      generateHint: async (...args) => {
        calls++;
        await fixture.database.query(
          "UPDATE class_members SET status='DISABLED' WHERE class_id=$1",
          [fixture.lessonClass.id],
        );
        return new LocalRasaProvider().generateHint(...args);
      },
    };
    expect((await hint(input)).status).toBe(404);
    await fixture.database.query("UPDATE class_members SET status='ACTIVE' WHERE class_id=$1", [
      fixture.lessonClass.id,
    ]);
    const replay = await hint(input);
    expect(replay.status).toBe(404);
    expect(await replay.json()).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND', retryable: false },
    });
    expect(calls).toBe(1);
    expect(await effects()).toEqual([
      { requests: 1, actions: 0, usage: 0, events: 2, campaigns: 0 },
    ]);
  });
});
