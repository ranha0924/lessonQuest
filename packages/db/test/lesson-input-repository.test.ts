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
    f.advance();
    await f.inputs.update(f.teacher, f.organization.id, beta.lessonInput.id, {
      ...withMutation('018f72a4-cc52-7c5a-a6f9-8b21aa270204', { title: 'Beta' }),
      expectedRevision: 1,
    });

    expect((await f.inputs.list(f.teacher, f.organization.id)).map((item) => item.id)).toEqual([
      beta.lessonInput.id,
      alpha.lessonInput.id,
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

  it('fails closed for students, disabled users, incompatible roles, and tenant/nonexistent probes', async () => {
    const f = await fixture();
    const created = await f.inputs.create(f.teacher, f.organization.id, validCreate);
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
