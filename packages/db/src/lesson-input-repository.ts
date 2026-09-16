import type { SqlDatabase, SqlQueryable, SqlTransaction } from './sql.js';
import { createHash, randomUUID } from 'node:crypto';

import {
  actorSchema,
  contentHashSchema,
  createLessonInputInputSchema,
  lessonInputSchema,
  lessonInputSummarySchema,
  updateLessonInputInputSchema,
  uuidSchema,
  type Actor,
  type CreateLessonInputInput,
  type LessonInput,
  type LessonInputMutationResult,
  type LessonInputSummary,
  type UpdateLessonInputInput,
} from '@lessonquest/contracts';

import { ConflictError, ResourceNotFoundError } from './tenant-repository.js';

type Queryable = SqlQueryable;
type LessonInputOperation = 'CREATE' | 'UPDATE';
type LessonInputAuditAction =
  | 'LESSON_INPUT_CREATE'
  | 'LESSON_INPUT_CREATED'
  | 'LESSON_INPUT_LIST'
  | 'LESSON_INPUT_READ'
  | 'LESSON_INPUT_UPDATE'
  | 'LESSON_INPUT_UPDATED';
type AuditOutcome = 'SUCCEEDED' | 'DUPLICATE' | 'DENIED' | 'CONFLICT';

interface LessonInputRow {
  id: string;
  organization_id: string;
  owner_teacher_id: string;
  title: string;
  grade_band: string;
  learning_content: string;
  learning_objectives: unknown;
  revision: number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface LessonInputMutationRow {
  operation: LessonInputOperation;
  request_hash: string;
  lesson_input_id: string;
}

export class LessonInputPersistenceError extends Error {
  constructor() {
    super('Lesson input operation failed');
    this.name = 'LessonInputPersistenceError';
  }
}

function parseActor(actor: Actor): Actor {
  return actorSchema.parse(actor);
}

function parseUuidOrNotFound(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ResourceNotFoundError();
  }
  return parsed.data.toLowerCase();
}

function resolveTraceId(traceId: string | undefined): string {
  return uuidSchema.parse(traceId ?? randomUUID());
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseObjectives(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return JSON.parse(value) as unknown;
}

function mapLessonInput(row: LessonInputRow): LessonInput {
  return lessonInputSchema.parse({
    id: row.id,
    organizationId: row.organization_id,
    ownerTeacherId: row.owner_teacher_id,
    title: row.title,
    gradeBand: row.grade_band,
    learningContent: row.learning_content,
    learningObjectives: parseObjectives(row.learning_objectives),
    revision: row.revision,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

function mapLessonInputSummary(row: LessonInputRow): LessonInputSummary {
  return lessonInputSummarySchema.parse({
    id: row.id,
    title: row.title,
    gradeBand: row.grade_band,
    revision: row.revision,
    updatedAt: toIso(row.updated_at),
  });
}

function requestHash(
  operation: LessonInputOperation,
  lessonInputId: string | null,
  input: CreateLessonInputInput | UpdateLessonInputInput,
): string {
  const payload = JSON.stringify([
    operation,
    lessonInputId,
    input.mutationId,
    'expectedRevision' in input ? input.expectedRevision : null,
    input.title,
    input.gradeBand,
    input.learningContent,
    input.learningObjectives,
  ]);
  return contentHashSchema.parse(
    `sha256:${createHash('sha256').update(payload, 'utf8').digest('hex')}`,
  );
}

async function writeAudit(
  queryable: Queryable,
  input: {
    traceId: string;
    actorUserId: string;
    organizationId: string;
    action: LessonInputAuditAction;
    resourceId: string | null;
    outcome: AuditOutcome;
  },
): Promise<void> {
  await queryable.query(
    `INSERT INTO audit_logs
      (id, trace_id, actor_user_id, organization_id, action, resource_type, resource_id, outcome)
     VALUES ($1, $2, $3, $4, $5, 'LESSON_INPUT', $6, $7)`,
    [
      randomUUID(),
      input.traceId,
      input.actorUserId,
      input.organizationId,
      input.action,
      input.resourceId,
      input.outcome,
    ],
  );
}

// Serialize mutation-ledger decisions for this actor and tenant across server instances.
// Authorization tables stay read-only; current authority is checked after any wait.
async function lockTeacherMutations(
  queryable: SqlQueryable,
  actor: Actor,
  organizationId: string,
): Promise<void> {
  await queryable.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `lessonquest:lesson-input:${organizationId}:${actor.userId}`,
  ]);
}

async function requireTeacherScope(
  queryable: Queryable,
  actor: Actor,
  organizationId: string,
): Promise<'TEACHER' | 'ORG_ADMIN'> {
  const result = await queryable.query<{ role: 'TEACHER' | 'ORG_ADMIN' }>(
    `SELECT m.role
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
  const role = result.rows[0]?.role;
  if (role === undefined) {
    throw new ResourceNotFoundError();
  }
  return role;
}

async function requireTeacherCreatorScope(
  queryable: Queryable,
  actor: Actor,
  organizationId: string,
): Promise<void> {
  const result = await queryable.query<{ user_id: string }>(
    `SELECT m.user_id
     FROM organization_members m
     JOIN organizations o ON o.id = m.organization_id AND o.status = 'ACTIVE'
     JOIN users u
       ON u.id = m.user_id
      AND u.status = 'ACTIVE'
      AND u.platform_role = 'TEACHER'
     WHERE m.organization_id = $1
       AND m.user_id = $2
       AND m.status = 'ACTIVE'
       AND m.role IN ('TEACHER', 'ORG_ADMIN')`,
    [organizationId, actor.userId],
  );
  if (result.rows[0] === undefined) {
    throw new ResourceNotFoundError();
  }
}

async function readAuthorizedLessonInput(
  queryable: Queryable,
  actor: Actor,
  organizationId: string,
  lessonInputId: string,
  lock = false,
): Promise<LessonInputRow> {
  const result = await queryable.query<LessonInputRow>(
    `SELECT li.id, li.organization_id, li.owner_teacher_id, li.title, li.grade_band,
            li.learning_content, li.learning_objectives, li.revision, li.created_at, li.updated_at
     FROM lesson_inputs li
     JOIN organizations o ON o.id = li.organization_id AND o.status = 'ACTIVE'
     JOIN organization_members m
       ON m.organization_id = li.organization_id
      AND m.user_id = $1
      AND m.status = 'ACTIVE'
      AND m.role IN ('TEACHER', 'ORG_ADMIN')
     JOIN users u
       ON u.id = m.user_id
      AND u.status = 'ACTIVE'
      AND u.platform_role IN ('TEACHER', 'SUPER_ADMIN')
     WHERE li.organization_id = $2
       AND li.id = $3
       AND (li.owner_teacher_id = $1 OR m.role = 'ORG_ADMIN')${lock ? ' FOR UPDATE OF li' : ''}`,
    [actor.userId, organizationId, lessonInputId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new ResourceNotFoundError();
  }
  return row;
}

export class LessonInputRepository {
  private readonly now: () => Date;

  constructor(
    private readonly database: SqlDatabase,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async runAudited<T>(
    input: {
      actor: Actor;
      organizationId: string;
      traceId: string;
      successAction: LessonInputAuditAction;
      failureAction: LessonInputAuditAction;
      fallbackResourceId: string | null;
    },
    operation: (
      transaction: SqlTransaction,
    ) => Promise<{ value: T; resourceId: string | null; outcome?: AuditOutcome }>,
  ): Promise<T> {
    try {
      return await this.database.transaction(async (transaction) => {
        const result = await operation(transaction);
        await writeAudit(transaction, {
          traceId: input.traceId,
          actorUserId: input.actor.userId,
          organizationId: input.organizationId,
          action: input.successAction,
          resourceId: result.resourceId,
          outcome: result.outcome ?? 'SUCCEEDED',
        });
        return result.value;
      });
    } catch (error) {
      const outcome =
        error instanceof ResourceNotFoundError
          ? 'DENIED'
          : error instanceof ConflictError
            ? 'CONFLICT'
            : null;
      if (outcome !== null) {
        try {
          await writeAudit(this.database, {
            traceId: input.traceId,
            actorUserId: input.actor.userId,
            organizationId: input.organizationId,
            action: input.failureAction,
            resourceId: input.fallbackResourceId,
            outcome,
          });
        } catch {
          // A failed diagnostic write must not expose or replace the safe domain error.
        }
        throw error;
      }
      throw new LessonInputPersistenceError();
    }
  }

  async create(
    actorInput: Actor,
    organizationIdInput: string,
    inputInput: CreateLessonInputInput,
    traceIdInput?: string,
  ): Promise<LessonInputMutationResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const input = createLessonInputInputSchema.parse(inputInput);
    const traceId = resolveTraceId(traceIdInput);
    const hash = requestHash('CREATE', null, input);

    return this.runAudited<LessonInputMutationResult>(
      {
        actor,
        organizationId,
        traceId,
        successAction: 'LESSON_INPUT_CREATED',
        failureAction: 'LESSON_INPUT_CREATE',
        fallbackResourceId: null,
      },
      async (transaction) => {
        await lockTeacherMutations(transaction, actor, organizationId);
        await requireTeacherCreatorScope(transaction, actor, organizationId);
        const replay = await transaction.query<LessonInputMutationRow>(
          `SELECT operation, request_hash, lesson_input_id
           FROM lesson_input_mutations
           WHERE organization_id = $1 AND actor_user_id = $2 AND mutation_id = $3`,
          [organizationId, actor.userId, input.mutationId],
        );
        const mutation = replay.rows[0];
        if (mutation !== undefined) {
          if (mutation.operation !== 'CREATE' || mutation.request_hash !== hash) {
            throw new ConflictError();
          }
          return {
            value: {
              lessonInput: mapLessonInput(
                await readAuthorizedLessonInput(
                  transaction,
                  actor,
                  organizationId,
                  mutation.lesson_input_id,
                ),
              ),
              duplicate: true,
            },
            resourceId: mutation.lesson_input_id,
            outcome: 'DUPLICATE',
          };
        }

        const lessonInputId = randomUUID();
        const now = this.now().toISOString();
        const inserted = await transaction.query<LessonInputRow>(
          `INSERT INTO lesson_inputs
            (id, organization_id, owner_teacher_id, title, grade_band, learning_content,
             learning_objectives, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
           RETURNING id, organization_id, owner_teacher_id, title, grade_band, learning_content,
                     learning_objectives, revision, created_at, updated_at`,
          [
            lessonInputId,
            organizationId,
            actor.userId,
            input.title,
            input.gradeBand,
            input.learningContent,
            JSON.stringify(input.learningObjectives),
            now,
          ],
        );
        const row = inserted.rows[0];
        if (row === undefined) {
          throw new LessonInputPersistenceError();
        }
        await transaction.query(
          `INSERT INTO lesson_input_mutations
            (organization_id, actor_user_id, mutation_id, operation, request_hash, lesson_input_id,
             result_revision, created_at)
           VALUES ($1, $2, $3, 'CREATE', $4, $5, 1, $6)`,
          [organizationId, actor.userId, input.mutationId, hash, lessonInputId, now],
        );
        return {
          value: { lessonInput: mapLessonInput(row), duplicate: false },
          resourceId: lessonInputId,
        };
      },
    );
  }

  async list(
    actorInput: Actor,
    organizationIdInput: string,
    traceIdInput?: string,
  ): Promise<LessonInputSummary[]> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<LessonInputSummary[]>(
      {
        actor,
        organizationId,
        traceId,
        successAction: 'LESSON_INPUT_LIST',
        failureAction: 'LESSON_INPUT_LIST',
        fallbackResourceId: null,
      },
      async (transaction) => {
        const role = await requireTeacherScope(transaction, actor, organizationId);
        const result = await transaction.query<LessonInputRow>(
          `SELECT id, organization_id, owner_teacher_id, title, grade_band, learning_content,
                  learning_objectives, revision, created_at, updated_at
           FROM lesson_inputs
           WHERE organization_id = $1
             AND ($2 = 'ORG_ADMIN' OR owner_teacher_id = $3)
           ORDER BY updated_at DESC, title ASC, id ASC
           LIMIT 1000`,
          [organizationId, role, actor.userId],
        );
        return { value: result.rows.map(mapLessonInputSummary), resourceId: null };
      },
    );
  }

  async get(
    actorInput: Actor,
    organizationIdInput: string,
    lessonInputIdInput: string,
    traceIdInput?: string,
  ): Promise<LessonInput> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const lessonInputId = parseUuidOrNotFound(lessonInputIdInput);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<LessonInput>(
      {
        actor,
        organizationId,
        traceId,
        successAction: 'LESSON_INPUT_READ',
        failureAction: 'LESSON_INPUT_READ',
        fallbackResourceId: lessonInputId,
      },
      async (transaction) => ({
        value: mapLessonInput(
          await readAuthorizedLessonInput(transaction, actor, organizationId, lessonInputId),
        ),
        resourceId: lessonInputId,
      }),
    );
  }

  async update(
    actorInput: Actor,
    organizationIdInput: string,
    lessonInputIdInput: string,
    inputInput: UpdateLessonInputInput,
    traceIdInput?: string,
  ): Promise<LessonInputMutationResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const lessonInputId = parseUuidOrNotFound(lessonInputIdInput);
    const input = updateLessonInputInputSchema.parse(inputInput);
    const traceId = resolveTraceId(traceIdInput);
    const hash = requestHash('UPDATE', lessonInputId, input);

    return this.runAudited<LessonInputMutationResult>(
      {
        actor,
        organizationId,
        traceId,
        successAction: 'LESSON_INPUT_UPDATED',
        failureAction: 'LESSON_INPUT_UPDATE',
        fallbackResourceId: lessonInputId,
      },
      async (transaction) => {
        await lockTeacherMutations(transaction, actor, organizationId);
        await requireTeacherScope(transaction, actor, organizationId);
        const replay = await transaction.query<LessonInputMutationRow>(
          `SELECT operation, request_hash, lesson_input_id
           FROM lesson_input_mutations
           WHERE organization_id = $1 AND actor_user_id = $2 AND mutation_id = $3`,
          [organizationId, actor.userId, input.mutationId],
        );
        const mutation = replay.rows[0];
        if (mutation !== undefined) {
          if (
            mutation.operation !== 'UPDATE' ||
            mutation.request_hash !== hash ||
            mutation.lesson_input_id !== lessonInputId
          ) {
            throw new ConflictError();
          }
          return {
            value: {
              lessonInput: mapLessonInput(
                await readAuthorizedLessonInput(transaction, actor, organizationId, lessonInputId),
              ),
              duplicate: true,
            },
            resourceId: lessonInputId,
            outcome: 'DUPLICATE',
          };
        }

        await readAuthorizedLessonInput(transaction, actor, organizationId, lessonInputId, true);
        // A row-lock wait may outlive an authority change seen by the joined snapshot.
        await readAuthorizedLessonInput(transaction, actor, organizationId, lessonInputId);
        const now = this.now().toISOString();
        const updated = await transaction.query<LessonInputRow>(
          `UPDATE lesson_inputs
           SET title = $1, grade_band = $2, learning_content = $3, learning_objectives = $4::jsonb,
               revision = revision + 1, updated_at = $5
           WHERE organization_id = $6 AND id = $7 AND revision = $8
           RETURNING id, organization_id, owner_teacher_id, title, grade_band, learning_content,
                     learning_objectives, revision, created_at, updated_at`,
          [
            input.title,
            input.gradeBand,
            input.learningContent,
            JSON.stringify(input.learningObjectives),
            now,
            organizationId,
            lessonInputId,
            input.expectedRevision,
          ],
        );
        const row = updated.rows[0];
        if (row === undefined) {
          throw new ConflictError();
        }
        await transaction.query(
          `INSERT INTO lesson_input_mutations
            (organization_id, actor_user_id, mutation_id, operation, request_hash, lesson_input_id,
             result_revision, created_at)
           VALUES ($1, $2, $3, 'UPDATE', $4, $5, $6, $7)`,
          [organizationId, actor.userId, input.mutationId, hash, lessonInputId, row.revision, now],
        );
        return {
          value: { lessonInput: mapLessonInput(row), duplicate: false },
          resourceId: lessonInputId,
        };
      },
    );
  }
}
