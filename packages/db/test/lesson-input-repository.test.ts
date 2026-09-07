import type { CreateLessonInputInput } from '@lessonquest/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { ConflictError, ResourceNotFoundError } from '../src/tenant-repository.js';
import { createLessonInputFixture } from './lesson-input-fixture.js';

const validCreate: CreateLessonInputInput = {
  mutationId: '018f72a4-cc52-7c5a-a6f9-8b21aa270201',
  title: '힘과 운동 수업',
  gradeBand: 'middle1',
  learningContent: '같은 힘을 가할 때 질량에 따른 운동 변화를 비교한다.',
  learningObjectives: ['힘과 질량의 관계를 설명한다.', '실험 결과를 근거로 예측한다.'],
};

const unknownOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa270901';
const unknownLessonInputId = '018f72a4-cc52-7c5a-a6f9-8b21aa270902';

function withMutation(mutationId: string, fields: Partial<CreateLessonInputInput> = {}) {
  return { ...validCreate, ...fields, mutationId };
}

describe('LessonInputRepository', () => {
  const fixtures: Array<Awaited<ReturnType<typeof createLessonInputFixture>>> = [];

  afterEach(async () => {
    await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()));
  });

  async function fixture() {
    const value = await createLessonInputFixture();
    fixtures.push(value);
    return value;
  }

  it('creates, lists, and reads its own strict lesson input', async () => {
    const f = await fixture();
    const first = await f.inputs.create(f.teacher, f.organization.id, validCreate);

    expect(first).toMatchObject({
      duplicate: false,
      lessonInput: {
        title: '힘과 운동 수업',
        revision: 1,
        ownerTeacherId: f.teacher.userId,
      },
    });
    expect(await f.inputs.list(f.teacher, f.organization.id)).toEqual([
      {
        id: first.lessonInput.id,
        title: '힘과 운동 수업',
        gradeBand: 'middle1',
        revision: 1,
        updatedAt: first.lessonInput.updatedAt,
      },
    ]);
    await expect(f.inputs.get(f.teacher, f.organization.id, first.lessonInput.id)).resolves.toEqual(
      first.lessonInput,
    );
  });

  it('orders lists by newest update then title and ID', async () => {
    const f = await fixture();
    const beta = await f.inputs.create(
      f.teacher,
      f.organization.id,
      withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270202', { title: 'Beta' }),
    );
    const alpha = await f.inputs.create(
      f.teacher,
      f.organization.id,
      withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270203', { title: 'Alpha' }),
    );
    const sameTitleOne = await f.inputs.create(
      f.teacher,
      f.organization.id,
      withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270210', { title: 'Same' }),
    );
    const sameTitleTwo = await f.inputs.create(
      f.teacher,
      f.organization.id,
      withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270211', { title: 'Same' }),
    );
    f.advance();
    await f.inputs.update(f.teacher, f.organization.id, beta.lessonInput.id, {
      ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270204', { title: 'Beta' }),
      expectedRevision: 1,
    });

    expect((await f.inputs.list(f.teacher, f.organization.id)).map((item) => item.id)).toEqual([
      beta.lessonInput.id,
      alpha.lessonInput.id,
      ...[sameTitleOne.lessonInput.id, sameTitleTwo.lessonInput.id].sort(),
    ]);
  });

  it('returns an exact create replay without duplicating the lesson input', async () => {
    const f = await fixture();
    const first = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    const replay = await f.inputs.create(f.teacher, f.organization.id, validCreate);

    expect(replay).toEqual({ lessonInput: first.lessonInput, duplicate: true });
    await expect(f.inputs.list(f.teacher, f.organization.id)).resolves.toHaveLength(1);
  });

  it('increments once for update and returns exact update replay without another increment', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    f.advance();
    const update = {
      ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270205', { title: '수정된 힘과 운동' }),
      expectedRevision: 1,
    };
    const changed = await f.inputs.update(
      f.teacher,
      f.organization.id,
      created.lessonInput.id,
      update,
    );
    const replay = await f.inputs.update(
      f.teacher,
      f.organization.id,
      created.lessonInput.id,
      update,
    );

    expect(changed).toMatchObject({
      duplicate: false,
      lessonInput: { revision: 2, title: '수정된 힘과 운동' },
    });
    expect(replay).toEqual({ lessonInput: changed.lessonInput, duplicate: true });
    await expect(
      f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
    ).resolves.toMatchObject({ revision: 2 });
  });

  it('rejects cross-operation and changed-payload mutation key reuse', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    await expect(
      f.inputs.create(f.teacher, f.organization.id, { ...validCreate, title: '변조된 입력' }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, {
        ...validCreate,
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects stale updates without changing the stored row', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    await expect(
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, {
        ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270206', { title: '오래된 수정' }),
        expectedRevision: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
    ).resolves.toEqual(created.lessonInput);
  });

  it('limits teachers to their own rows and permits organization administrators', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);

    await expect(f.inputs.list(f.otherTeacher, f.organization.id)).resolves.toEqual([]);
    await expect(
      f.inputs.get(f.otherTeacher, f.organization.id, created.lessonInput.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      f.inputs.update(f.otherTeacher, f.organization.id, created.lessonInput.id, {
        ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270207'),
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(f.inputs.list(f.admin, f.organization.id)).resolves.toHaveLength(1);
    await expect(f.inputs.get(f.admin, f.organization.id, created.lessonInput.id)).resolves.toEqual(
      created.lessonInput,
    );
    await expect(
      f.inputs.update(f.admin, f.organization.id, created.lessonInput.id, {
        ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270208'),
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ lessonInput: { revision: 2 } });
  });

  it('allows a persisted teacher with ORG_ADMIN membership to create but denies SUPER_ADMIN administrators', async () => {
    const f = await fixture();
    const teacherCreated = await f.inputs.create(f.teacher, f.organization.id, validCreate);

    await expect(
      f.inputs.create(
        f.admin,
        f.organization.id,
        withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270212', { title: '관리자 생성' }),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(f.inputs.list(f.teacher, f.organization.id)).resolves.toEqual([
      expect.objectContaining({ id: teacherCreated.lessonInput.id }),
    ]);
    await expect(
      f.database.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM lesson_input_mutations WHERE actor_user_id = $1',
        [f.admin.userId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it('fails closed for students, disabled users, incompatible roles, and tenant/nonexistent probes', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    await expect(
      f.inputs.create(
        f.student,
        f.organization.id,
        withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270219'),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      f.inputs.update(f.student, f.organization.id, created.lessonInput.id, {
        ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270220'),
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    for (const [actor, organizationId, lessonInputId] of [
      [f.student, f.organization.id, created.lessonInput.id],
      [f.otherTeacher, f.otherOrganization.id, created.lessonInput.id],
      [f.teacher, unknownOrganizationId, created.lessonInput.id],
      [f.teacher, f.organization.id, unknownLessonInputId],
    ] as const) {
      await expect(f.inputs.get(actor, organizationId, lessonInputId)).rejects.toBeInstanceOf(
        ResourceNotFoundError,
      );
    }
    await f.database.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [
      f.teacher.userId,
    ]);
    await expect(f.inputs.list(f.teacher, f.organization.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await f.database.query(
      "UPDATE users SET status = 'ACTIVE', platform_role = 'STUDENT' WHERE id = $1",
      [f.teacher.userId],
    );
    await expect(f.inputs.list(f.teacher, f.organization.id)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it('denies create and existing-resource access after organization, membership, user, or role revocation', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    const update = {
      ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270213', { title: '수정 권한 거부' }),
      expectedRevision: 1,
    };

    for (const [sql, parameters] of [
      ["UPDATE organizations SET status = 'DISABLED' WHERE id = $1", [f.organization.id]],
      [
        "UPDATE organization_members SET status = 'DISABLED' WHERE organization_id = $1 AND user_id = $2",
        [f.organization.id, f.teacher.userId],
      ],
      ["UPDATE users SET status = 'DISABLED' WHERE id = $1", [f.teacher.userId]],
      ["UPDATE users SET platform_role = 'STUDENT' WHERE id = $1", [f.teacher.userId]],
    ] as const) {
      await f.database.query(sql, parameters);
      await expect(
        f.inputs.create(
          f.teacher,
          f.organization.id,
          withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270214'),
        ),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
      await expect(
        f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
      await expect(
        f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, update),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
      await f.database.query("UPDATE organizations SET status = 'ACTIVE' WHERE id = $1", [
        f.organization.id,
      ]);
      await f.database.query(
        "UPDATE organization_members SET status = 'ACTIVE' WHERE organization_id = $1 AND user_id = $2",
        [f.organization.id, f.teacher.userId],
      );
      await f.database.query(
        "UPDATE users SET status = 'ACTIVE', platform_role = 'TEACHER' WHERE id = $1",
        [f.teacher.userId],
      );
    }
    await expect(
      f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id),
    ).resolves.toEqual(created.lessonInput);
    await expect(
      f.database.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM lesson_input_mutations WHERE actor_user_id = $1',
        [f.teacher.userId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('rechecks active authority before exact create and update replays', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    const update = {
      ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270215', { title: '재시도 수정' }),
      expectedRevision: 1,
    };
    const updated = await f.inputs.update(
      f.teacher,
      f.organization.id,
      created.lessonInput.id,
      update,
    );

    await f.database.query(
      "UPDATE organization_members SET status = 'DISABLED' WHERE organization_id = $1 AND user_id = $2",
      [f.organization.id, f.teacher.userId],
    );
    await expect(f.inputs.create(f.teacher, f.organization.id, validCreate)).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    await expect(
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, update),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      f.database.query<{ revision: number }>('SELECT revision FROM lesson_inputs WHERE id = $1', [
        created.lessonInput.id,
      ]),
    ).resolves.toMatchObject({ rows: [{ revision: updated.lessonInput.revision }] });
    await expect(
      f.database.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM lesson_input_mutations WHERE actor_user_id = $1',
        [f.teacher.userId],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });

  it('writes allowlisted diagnostic trace metadata for denied and conflict operations', async () => {
    const f = await fixture();
    const deniedTraceId = '018f72a4-cc52-7c5a-a6f9-8b21aa270216';
    const conflictTraceId = '018f72a4-cc52-7c5a-a6f9-8b21aa270217';
    const deniedInput = withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270218', {
      title: '학생 거부 입력',
      learningContent: '거부 감사에 내용이 남아서는 안 된다.',
      learningObjectives: ['거부 감사 메타데이터만 남는다.'],
    });
    const conflictInput = withMutation(validCreate.mutationId, {
      title: '충돌 감사 입력',
      learningContent: '충돌 감사에 내용이 남아서는 안 된다.',
      learningObjectives: ['충돌 감사 메타데이터만 남는다.'],
    });
    await f.inputs.create(f.teacher, f.organization.id, validCreate);

    await expect(
      f.inputs.create(f.student, f.organization.id, deniedInput, deniedTraceId),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      f.inputs.create(f.teacher, f.organization.id, conflictInput, conflictTraceId),
    ).rejects.toBeInstanceOf(ConflictError);

    const audit = await f.database.query<Record<string, unknown>>(
      `SELECT * FROM audit_logs
       WHERE trace_id IN ($1, $2)
       ORDER BY trace_id`,
      [deniedTraceId, conflictTraceId],
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        trace_id: deniedTraceId,
        actor_user_id: f.student.userId,
        organization_id: f.organization.id,
        action: 'LESSON_INPUT_CREATE',
        resource_type: 'LESSON_INPUT',
        resource_id: null,
        outcome: 'DENIED',
      }),
      expect.objectContaining({
        trace_id: conflictTraceId,
        actor_user_id: f.teacher.userId,
        organization_id: f.organization.id,
        action: 'LESSON_INPUT_CREATE',
        resource_type: 'LESSON_INPUT',
        resource_id: null,
        outcome: 'CONFLICT',
      }),
    ]);
    for (const row of audit.rows) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'action',
          'actor_user_id',
          'id',
          'occurred_at',
          'organization_id',
          'outcome',
          'resource_id',
          'resource_type',
          'trace_id',
        ].sort(),
      );
      const serialized = JSON.stringify(row);
      for (const submittedValue of [
        deniedInput.title,
        deniedInput.learningContent,
        deniedInput.learningObjectives[0],
        conflictInput.title,
        conflictInput.learningContent,
        conflictInput.learningObjectives[0],
      ]) {
        expect(serialized).not.toContain(submittedValue);
      }
    }
  });

  it('stores only allowlisted audit metadata for successful operations', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    await f.inputs.get(f.teacher, f.organization.id, created.lessonInput.id);
    const audit = await f.database.query<Record<string, unknown>>(
      "SELECT * FROM audit_logs WHERE organization_id = $1 AND resource_type = 'LESSON_INPUT' ORDER BY occurred_at, id",
      [f.organization.id],
    );

    expect(audit.rows).toHaveLength(2);
    for (const row of audit.rows) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'action',
          'actor_user_id',
          'id',
          'occurred_at',
          'organization_id',
          'outcome',
          'resource_id',
          'resource_type',
          'trace_id',
        ].sort(),
      );
      expect(JSON.stringify(row)).not.toContain(validCreate.learningContent);
      expect(JSON.stringify(row)).not.toContain(validCreate.learningObjectives[0]);
    }
  });

  it('rolls back create when its atomic audit write fails', async () => {
    const f = await fixture();
    await f.database.exec(`
      CREATE OR REPLACE FUNCTION fail_lesson_input_audit() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'audit write rejected'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_lesson_input_audit_insert
      BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_lesson_input_audit();
    `);
    await expect(f.inputs.create(f.teacher, f.organization.id, validCreate)).rejects.toThrow();
    await expect(f.database.query('SELECT id FROM lesson_inputs')).resolves.toMatchObject({
      rows: [],
    });
    await expect(
      f.database.query('SELECT mutation_id FROM lesson_input_mutations'),
    ).resolves.toMatchObject({ rows: [] });
  });

  it('rolls back update and its mutation evidence when the atomic audit write fails', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
    await f.database.exec(`
      CREATE OR REPLACE FUNCTION fail_lesson_input_audit_update() RETURNS TRIGGER AS $$
      BEGIN RAISE EXCEPTION 'audit write rejected'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_lesson_input_audit_update_insert
      BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_lesson_input_audit_update();
    `);

    await expect(
      f.inputs.update(f.teacher, f.organization.id, created.lessonInput.id, {
        ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270209', { title: '실패한 수정' }),
        expectedRevision: 1,
      }),
    ).rejects.toThrow();
    await expect(
      f.database.query<{ revision: number }>('SELECT revision FROM lesson_inputs'),
    ).resolves.toMatchObject({ rows: [{ revision: 1 }] });
    await expect(
      f.database.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM lesson_input_mutations',
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});
