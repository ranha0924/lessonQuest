import { PGlite } from '@electric-sql/pglite';
import type { Actor } from '@lessonquest/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeSchema } from '../src/schema.js';
import {
  AuthorizationError,
  ConflictError,
  ResourceNotFoundError,
  TenantRepository,
} from '../src/tenant-repository.js';

const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c801',
  platformRole: 'TEACHER',
  memberships: [],
};

const otherTeacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c802',
  platformRole: 'TEACHER',
  memberships: [],
};

const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c803',
  platformRole: 'STUDENT',
  memberships: [],
};

describe('initializeSchema', () => {
  it('can initialize the same empty local database twice', async () => {
    const database = new PGlite();

    try {
      await initializeSchema(database);
      await expect(initializeSchema(database)).resolves.toBeUndefined();
    } finally {
      await database.close();
    }
  });
});

describe('TenantRepository', () => {
  let database: PGlite;
  let repository: TenantRepository;

  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
    repository = new TenantRepository(database);
    await repository.upsertUser(teacher);
    await repository.upsertUser(otherTeacher);
    await repository.upsertUser(student);
  });

  afterEach(async () => {
    await database.close();
  });

  it('creates an organization with active admin membership and a redacted audit row', async () => {
    const traceId = '018f72a4-cc52-7c5a-a6f9-8b21aa27d120';
    const organization = await repository.createOrganization(teacher, '별빛중학교', traceId);
    const membership = await database.query<{ role: string; status: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organization.id, teacher.userId],
    );
    const audit = await database.query<Record<string, unknown>>(
      'SELECT * FROM audit_logs WHERE resource_id = $1',
      [organization.id],
    );

    expect(organization).toMatchObject({
      name: '별빛중학교',
      createdBy: teacher.userId,
      status: 'ACTIVE',
    });
    expect(membership.rows).toEqual([{ role: 'ORG_ADMIN', status: 'ACTIVE' }]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      actor_user_id: teacher.userId,
      organization_id: organization.id,
      action: 'ORGANIZATION_CREATED',
      resource_type: 'ORGANIZATION',
      resource_id: organization.id,
      outcome: 'SUCCEEDED',
      trace_id: traceId,
    });
    expect(Object.keys(audit.rows[0] ?? {}).sort()).toEqual(
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
  });

  it('creates a class and enrolls a student with server-derived active roles and audits', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');

    await repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);

    const organizationMembership = await database.query<{ role: string; status: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organization.id, student.userId],
    );
    const classMembership = await database.query<{ role: string; status: string }>(
      'SELECT role, status FROM class_members WHERE organization_id = $1 AND class_id = $2 AND user_id = $3',
      [organization.id, lessonClass.id, student.userId],
    );
    await expect(repository.getClass(teacher, organization.id, lessonClass.id)).resolves.toEqual(
      lessonClass,
    );
    await expect(repository.getClass(student, organization.id, lessonClass.id)).resolves.toEqual(
      lessonClass,
    );
    const audit = await database.query<{ action: string; resource_id: string; outcome: string }>(
      'SELECT action, resource_id, outcome FROM audit_logs WHERE organization_id = $1 ORDER BY occurred_at, action',
      [organization.id],
    );
    expect(organizationMembership.rows).toEqual([{ role: 'STUDENT', status: 'ACTIVE' }]);
    expect(classMembership.rows).toEqual([{ role: 'STUDENT', status: 'ACTIVE' }]);
    expect(audit.rows).toEqual(
      expect.arrayContaining([
        { action: 'CLASS_CREATED', resource_id: lessonClass.id, outcome: 'SUCCEEDED' },
        { action: 'STUDENT_ENROLLED', resource_id: lessonClass.id, outcome: 'SUCCEEDED' },
      ]),
    );
    expect(
      audit.rows.filter(
        ({ action, resource_id: resourceId, outcome }) =>
          action === 'CLASS_READ' && resourceId === lessonClass.id && outcome === 'SUCCEEDED',
      ),
    ).toHaveLength(2);
  });

  it('does not trust actor membership claims that are absent from the database', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const forgedActor = {
      ...otherTeacher,
      memberships: [{ organizationId: organization.id, role: 'ORG_ADMIN' as const }],
    };

    await expect(
      repository.createClass(forgedActor, organization.id, '공격자 반'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('revokes class creation when an organization admin is downgraded to student', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const downgradedActor: Actor = { ...teacher, platformRole: 'STUDENT' };
    await repository.upsertUser(downgradedActor);

    await expect(
      repository.createClass(downgradedActor, organization.id, '권한이 남은 반'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('revokes enrollment when an organization admin is downgraded to student', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    const downgradedActor: Actor = { ...teacher, platformRole: 'STUDENT' };
    await repository.upsertUser(downgradedActor);

    await expect(
      repository.addStudentToClass(
        downgradedActor,
        organization.id,
        lessonClass.id,
        student.userId,
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('revokes privileged class reads when an organization admin is downgraded to student', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    const downgradedActor: Actor = { ...teacher, platformRole: 'STUDENT' };
    await repository.upsertUser(downgradedActor);

    await expect(
      repository.getClass(downgradedActor, organization.id, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('hides tenant resources behind one not-found result and audits denied access', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    const nonexistentOrganizationId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c899';
    const nonexistentClassId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c898';

    await expect(
      repository.getClass(otherTeacher, organization.id, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      repository.getClass(teacher, nonexistentOrganizationId, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(
      repository.getClass(teacher, organization.id, nonexistentClassId),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    const denied = await database.query<{ outcome: string; action: string }>(
      "SELECT outcome, action FROM audit_logs WHERE outcome = 'DENIED'",
    );
    expect(denied.rows).toHaveLength(3);
    expect(denied.rows).toEqual(
      expect.arrayContaining([
        { action: 'CLASS_READ', outcome: 'DENIED' },
        { action: 'CLASS_READ', outcome: 'DENIED' },
        { action: 'CLASS_READ', outcome: 'DENIED' },
      ]),
    );
  });

  it('prevents a student or disabled user from creating an organization', async () => {
    await expect(repository.createOrganization(student, '학생이 만든 기관')).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    await database.query("UPDATE users SET status = 'DISABLED' WHERE id = $1", [teacher.userId]);
    await expect(
      repository.createOrganization(teacher, '비활성 사용자의 기관'),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('fails closed for disabled organizations, memberships, classes, and class memberships', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    await repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);

    await database.query("UPDATE class_members SET status = 'DISABLED' WHERE class_id = $1", [
      lessonClass.id,
    ]);
    await expect(
      repository.getClass(student, organization.id, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await database.query("UPDATE classes SET status = 'DISABLED' WHERE id = $1", [lessonClass.id]);
    await expect(
      repository.getClass(teacher, organization.id, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await database.query("UPDATE classes SET status = 'ACTIVE' WHERE id = $1", [lessonClass.id]);
    await database.query(
      "UPDATE organization_members SET status = 'DISABLED' WHERE organization_id = $1 AND user_id = $2",
      [organization.id, teacher.userId],
    );
    await expect(
      repository.createClass(teacher, organization.id, '차단된 반'),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);

    await database.query(
      "UPDATE organization_members SET status = 'ACTIVE' WHERE organization_id = $1 AND user_id = $2",
      [organization.id, teacher.userId],
    );
    await database.query("UPDATE organizations SET status = 'DISABLED' WHERE id = $1", [
      organization.id,
    ]);
    await expect(
      repository.getClass(teacher, organization.id, lessonClass.id),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('enforces UUID, role, status, uniqueness, and tenant foreign keys in the database', async () => {
    await expect(
      database.query('INSERT INTO users (id, platform_role) VALUES ($1, $2)', [
        teacher.userId,
        'TEACHER',
      ]),
    ).rejects.toThrow();
    await expect(
      database.query('INSERT INTO users (id, platform_role) VALUES ($1, $2)', [
        'not-a-uuid',
        'TEACHER',
      ]),
    ).rejects.toThrow();
    await expect(
      database.query('INSERT INTO users (id, platform_role) VALUES ($1, $2)', [
        '018f72a4-cc52-7c5a-a6f9-8b21aa27c897',
        'OWNER',
      ]),
    ).rejects.toThrow();
    await expect(
      database.query('INSERT INTO users (id, platform_role, status) VALUES ($1, $2, $3)', [
        '018f72a4-cc52-7c5a-a6f9-8b21aa27c896',
        'STUDENT',
        'DELETED',
      ]),
    ).rejects.toThrow();

    const firstOrganization = await repository.createOrganization(teacher, '첫 기관');
    const secondOrganization = await repository.createOrganization(otherTeacher, '둘째 기관');
    const lessonClass = await repository.createClass(teacher, firstOrganization.id, '첫 반');

    await expect(
      database.query(
        "INSERT INTO class_members (organization_id, class_id, user_id, role) VALUES ($1, $2, $3, 'STUDENT')",
        [secondOrganization.id, lessonClass.id, student.userId],
      ),
    ).rejects.toThrow();
  });

  it('does not leave partial rows or duplicate audits when enrollment conflicts', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    await repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId);

    await expect(
      repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId),
    ).rejects.toBeInstanceOf(ConflictError);

    const memberships = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM class_members WHERE organization_id = $1 AND class_id = $2 AND user_id = $3',
      [organization.id, lessonClass.id, student.userId],
    );
    const audits = await database.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM audit_logs WHERE action = 'STUDENT_ENROLLED' AND resource_id = $1",
      [lessonClass.id],
    );
    const conflicts = await database.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM audit_logs WHERE action = 'STUDENT_ENROLL' AND outcome = 'CONFLICT' AND resource_id = $1",
      [lessonClass.id],
    );

    expect(memberships.rows).toEqual([{ count: 1 }]);
    expect(audits.rows).toEqual([{ count: 1 }]);
    expect(conflicts.rows).toEqual([{ count: 1 }]);
  });

  it('rolls back membership writes when the enrollment audit insert fails', async () => {
    const organization = await repository.createOrganization(teacher, '별빛중학교');
    const lessonClass = await repository.createClass(teacher, organization.id, '1학년 3반');
    await database.exec(
      "ALTER TABLE audit_logs ADD CONSTRAINT reject_enrollment_audit CHECK (action <> 'STUDENT_ENROLLED')",
    );

    await expect(
      repository.addStudentToClass(teacher, organization.id, lessonClass.id, student.userId),
    ).rejects.toThrow();

    const organizationMembership = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organization.id, student.userId],
    );
    const classMembership = await database.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM class_members WHERE organization_id = $1 AND class_id = $2 AND user_id = $3',
      [organization.id, lessonClass.id, student.userId],
    );
    const enrollmentAudit = await database.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM audit_logs WHERE action = 'STUDENT_ENROLLED' AND resource_id = $1",
      [lessonClass.id],
    );

    expect(organizationMembership.rows).toEqual([{ count: 0 }]);
    expect(classMembership.rows).toEqual([{ count: 0 }]);
    expect(enrollmentAudit.rows).toEqual([{ count: 0 }]);
  });
});
