import { randomUUID } from 'node:crypto';

import type { PGliteInterface, Transaction } from '@electric-sql/pglite';
import {
  actorSchema,
  createClassInputSchema,
  createOrganizationInputSchema,
  uuidSchema,
  type Actor,
} from '@lessonquest/contracts';

type Queryable = Pick<PGliteInterface, 'query'> | Pick<Transaction, 'query'>;

interface OrganizationRow {
  id: string;
  name: string;
  created_by: string;
  status: 'ACTIVE';
}

interface ClassRow {
  id: string;
  organization_id: string;
  owner_teacher_id: string;
  name: string;
  status: 'ACTIVE';
}

export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  status: 'ACTIVE';
}

export interface LessonClass {
  id: string;
  organizationId: string;
  ownerTeacherId: string;
  name: string;
  status: 'ACTIVE';
}

export class AuthorizationError extends Error {
  constructor() {
    super('Operation is not permitted');
    this.name = 'AuthorizationError';
  }
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found');
    this.name = 'ResourceNotFoundError';
  }
}

export class ConflictError extends Error {
  constructor() {
    super('Resource already exists');
    this.name = 'ConflictError';
  }
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    status: row.status,
  };
}

function toClass(row: ClassRow): LessonClass {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerTeacherId: row.owner_teacher_id,
    name: row.name,
    status: row.status,
  };
}

function parseActor(actor: Actor): Actor {
  return actorSchema.parse(actor);
}

function parseUuidOrNotFound(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ResourceNotFoundError();
  }
  return parsed.data;
}

function resolveTraceId(traceId: string | undefined): string {
  return uuidSchema.parse(traceId ?? randomUUID());
}

async function writeAudit(
  queryable: Queryable,
  input: {
    traceId: string;
    actorUserId: string;
    organizationId: string | null;
    action:
      | 'ORGANIZATION_CREATE'
      | 'ORGANIZATION_CREATED'
      | 'CLASS_CREATE'
      | 'CLASS_CREATED'
      | 'STUDENT_ENROLL'
      | 'STUDENT_ENROLLED'
      | 'CLASS_READ';
    resourceType: 'ORGANIZATION' | 'CLASS';
    resourceId: string | null;
    outcome: 'SUCCEEDED' | 'DENIED' | 'CONFLICT';
  },
): Promise<void> {
  await queryable.query(
    `INSERT INTO audit_logs
      (id, trace_id, actor_user_id, organization_id, action, resource_type, resource_id, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      input.traceId,
      input.actorUserId,
      input.organizationId,
      input.action,
      input.resourceType,
      input.resourceId,
      input.outcome,
    ],
  );
}

export class TenantRepository {
  constructor(private readonly database: PGliteInterface) {}

  async upsertUser(actorInput: Actor): Promise<void> {
    const actor = parseActor(actorInput);
    await this.database.query(
      `INSERT INTO users (id, platform_role)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET platform_role = EXCLUDED.platform_role`,
      [actor.userId, actor.platformRole],
    );
  }

  async createOrganization(
    actorInput: Actor,
    rawName: string,
    traceIdInput?: string,
  ): Promise<Organization> {
    const actor = parseActor(actorInput);
    const { name } = createOrganizationInputSchema.parse({ name: rawName });
    const traceId = resolveTraceId(traceIdInput);

    const organization = await this.database.transaction(async (transaction) => {
      const authorized = await transaction.query<{ id: string }>(
        `SELECT id
         FROM users
         WHERE id = $1
           AND status = 'ACTIVE'
           AND platform_role IN ('TEACHER', 'SUPER_ADMIN')`,
        [actor.userId],
      );
      if (authorized.rows[0] === undefined) {
        return undefined;
      }

      const organizationId = randomUUID();
      const inserted = await transaction.query<OrganizationRow>(
        `INSERT INTO organizations (id, name, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, name, created_by, status`,
        [organizationId, name, actor.userId],
      );
      await transaction.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'ORG_ADMIN')`,
        [organizationId, actor.userId],
      );
      await writeAudit(transaction, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'ORGANIZATION_CREATED',
        resourceType: 'ORGANIZATION',
        resourceId: organizationId,
        outcome: 'SUCCEEDED',
      });
      const row = inserted.rows[0];
      if (row === undefined) {
        throw new Error('Organization insert returned no row');
      }
      return toOrganization(row);
    });

    if (organization === undefined) {
      await writeAudit(this.database, {
        traceId,
        actorUserId: actor.userId,
        organizationId: null,
        action: 'ORGANIZATION_CREATE',
        resourceType: 'ORGANIZATION',
        resourceId: null,
        outcome: 'DENIED',
      });
      throw new AuthorizationError();
    }
    return organization;
  }

  async createClass(
    actorInput: Actor,
    organizationIdInput: string,
    rawName: string,
    traceIdInput?: string,
  ): Promise<LessonClass> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const { name } = createClassInputSchema.parse({ name: rawName });
    const traceId = resolveTraceId(traceIdInput);

    const lessonClass = await this.database.transaction(async (transaction) => {
      const authorized = await transaction.query<{ user_id: string }>(
        `SELECT m.user_id
         FROM organization_members m
         JOIN organizations o ON o.id = m.organization_id AND o.status = 'ACTIVE'
         JOIN users u
           ON u.id = m.user_id
          AND u.status = 'ACTIVE'
          AND u.platform_role IN ('TEACHER', 'SUPER_ADMIN')
         WHERE m.organization_id = $1
           AND m.user_id = $2
           AND m.status = 'ACTIVE'
           AND m.role IN ('TEACHER', 'ORG_ADMIN')`,
        [organizationId, actor.userId],
      );
      if (authorized.rows[0] === undefined) {
        return undefined;
      }

      const classId = randomUUID();
      const inserted = await transaction.query<ClassRow>(
        `INSERT INTO classes (id, organization_id, owner_teacher_id, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, organization_id, owner_teacher_id, name, status`,
        [classId, organizationId, actor.userId, name],
      );
      await writeAudit(transaction, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'CLASS_CREATED',
        resourceType: 'CLASS',
        resourceId: classId,
        outcome: 'SUCCEEDED',
      });
      const row = inserted.rows[0];
      if (row === undefined) {
        throw new Error('Class insert returned no row');
      }
      return toClass(row);
    });

    if (lessonClass === undefined) {
      await writeAudit(this.database, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'CLASS_CREATE',
        resourceType: 'CLASS',
        resourceId: null,
        outcome: 'DENIED',
      });
      throw new ResourceNotFoundError();
    }
    return lessonClass;
  }

  async addStudentToClass(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    studentUserIdInput: string,
    traceIdInput?: string,
  ): Promise<void> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const studentUserId = parseUuidOrNotFound(studentUserIdInput);
    const traceId = resolveTraceId(traceIdInput);

    const result = await this.database.transaction(async (transaction) => {
      const authorized = await transaction.query<{ id: string }>(
        `SELECT c.id
         FROM classes c
         JOIN organizations o ON o.id = c.organization_id AND o.status = 'ACTIVE'
         JOIN organization_members m
           ON m.organization_id = c.organization_id
          AND m.user_id = $1
          AND m.status = 'ACTIVE'
          AND m.role IN ('TEACHER', 'ORG_ADMIN')
         JOIN users actor_user
           ON actor_user.id = m.user_id
          AND actor_user.status = 'ACTIVE'
          AND actor_user.platform_role IN ('TEACHER', 'SUPER_ADMIN')
         WHERE c.id = $2
           AND c.organization_id = $3
           AND c.status = 'ACTIVE'`,
        [actor.userId, classId, organizationId],
      );
      if (authorized.rows[0] === undefined) {
        return 'denied' as const;
      }

      const targetStudent = await transaction.query<{ id: string }>(
        `SELECT id FROM users
         WHERE id = $1 AND platform_role = 'STUDENT' AND status = 'ACTIVE'`,
        [studentUserId],
      );
      if (targetStudent.rows[0] === undefined) {
        return 'denied' as const;
      }

      const existingClassMember = await transaction.query<{ user_id: string }>(
        `SELECT user_id FROM class_members
         WHERE organization_id = $1 AND class_id = $2 AND user_id = $3`,
        [organizationId, classId, studentUserId],
      );
      if (existingClassMember.rows[0] !== undefined) {
        return 'conflict' as const;
      }

      const existingOrganizationMember = await transaction.query<{ role: string; status: string }>(
        `SELECT role, status FROM organization_members
         WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, studentUserId],
      );
      const membership = existingOrganizationMember.rows[0];
      if (membership === undefined) {
        await transaction.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'STUDENT')`,
          [organizationId, studentUserId],
        );
      } else if (membership.role !== 'STUDENT' || membership.status !== 'ACTIVE') {
        return 'denied' as const;
      }

      await transaction.query(
        `INSERT INTO class_members (organization_id, class_id, user_id, role)
         VALUES ($1, $2, $3, 'STUDENT')`,
        [organizationId, classId, studentUserId],
      );
      await writeAudit(transaction, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'STUDENT_ENROLLED',
        resourceType: 'CLASS',
        resourceId: classId,
        outcome: 'SUCCEEDED',
      });
      return 'created' as const;
    });

    if (result === 'created') {
      return;
    }
    if (result === 'conflict') {
      await writeAudit(this.database, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'STUDENT_ENROLL',
        resourceType: 'CLASS',
        resourceId: classId,
        outcome: 'CONFLICT',
      });
      throw new ConflictError();
    }
    await writeAudit(this.database, {
      traceId,
      actorUserId: actor.userId,
      organizationId,
      action: 'STUDENT_ENROLL',
      resourceType: 'CLASS',
      resourceId: classId,
      outcome: 'DENIED',
    });
    throw new ResourceNotFoundError();
  }

  async getClass(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    traceIdInput?: string,
  ): Promise<LessonClass> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const traceId = resolveTraceId(traceIdInput);

    const result = await this.database.query<ClassRow>(
      `SELECT c.id, c.organization_id, c.owner_teacher_id, c.name, c.status
       FROM classes c
       JOIN organizations o ON o.id = c.organization_id AND o.status = 'ACTIVE'
       JOIN organization_members m
         ON m.organization_id = c.organization_id
        AND m.user_id = $1
        AND m.status = 'ACTIVE'
       JOIN users u ON u.id = m.user_id AND u.status = 'ACTIVE'
       WHERE c.id = $2
         AND c.organization_id = $3
         AND c.status = 'ACTIVE'
         AND (
           (
             m.role IN ('TEACHER', 'ORG_ADMIN')
             AND u.platform_role IN ('TEACHER', 'SUPER_ADMIN')
           )
           OR (
             m.role = 'STUDENT'
             AND u.platform_role = 'STUDENT'
             AND EXISTS (
               SELECT 1 FROM class_members cm
               WHERE cm.organization_id = c.organization_id
                 AND cm.class_id = c.id
                 AND cm.user_id = $1
                 AND cm.role = 'STUDENT'
                 AND cm.status = 'ACTIVE'
             )
           )
         )`,
      [actor.userId, classId, organizationId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      await writeAudit(this.database, {
        traceId,
        actorUserId: actor.userId,
        organizationId,
        action: 'CLASS_READ',
        resourceType: 'CLASS',
        resourceId: classId,
        outcome: 'DENIED',
      });
      throw new ResourceNotFoundError();
    }
    await writeAudit(this.database, {
      traceId,
      actorUserId: actor.userId,
      organizationId,
      action: 'CLASS_READ',
      resourceType: 'CLASS',
      resourceId: classId,
      outcome: 'SUCCEEDED',
    });
    return toClass(row);
  }
}
