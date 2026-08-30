import { randomUUID } from 'node:crypto';

import type { PGliteInterface, Transaction } from '@electric-sql/pglite';
import {
  actorSchema,
  clientLearningEventSchema,
  createAssignmentInputSchema,
  createScienceExperienceInputSchema,
  experienceManifestSchema,
  reviewExperienceVersionInputSchema,
  scienceBlockSpecSchema,
  serverLearningEventSchema,
  uuidSchema,
  type Actor,
  type ClientLearningEvent,
  type CreateAssignmentInput,
  type EventIngestionResult,
  type ReviewExperienceVersionInput,
  type ScienceBlockSpec,
  type ServerLearningEvent,
  type StudentProgress,
} from '@lessonquest/contracts';
import {
  buildScienceArtifact,
  buildScienceSandboxDocument,
  hashScienceArtifact,
  parseGeneratedScienceSpec,
  parseScienceArtifact,
  validateScienceSpec,
  verifyScienceArtifactHash,
  type ScienceArtifact,
  type ScienceValidationReport,
} from '@lessonquest/science-studio';

import { ConflictError, ResourceNotFoundError } from './tenant-repository.js';

type Queryable = Pick<PGliteInterface, 'query'> | Pick<Transaction, 'query'>;

interface VersionRow {
  id: string;
  experience_id: string;
  version: number;
  specification: unknown;
  artifact: unknown;
  manifest: unknown;
  content_hash: string;
  status: ExperienceVersionStatus;
  public_id: string;
  title: string;
  owner_id: string;
}

interface AssignmentRow {
  id: string;
  organization_id: string;
  class_id: string;
  experience_version_id: string;
  starts_at: string | Date;
  due_at: string | Date | null;
  status: 'ACTIVE';
}

interface AttemptRow {
  id: string;
  assignment_id: string;
  class_id: string;
  student_id: string;
  status: AttemptStatus;
}

interface StoredEventRow {
  type: ServerLearningEvent['type'];
  step_id: string;
  sequence: number;
  payload: unknown;
}

type ExperienceVersionStatus =
  'GENERATED' | 'VALIDATED' | 'REJECTED' | 'APPROVED' | 'PUBLISHED' | 'RETIRED';
type AttemptStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED';
type LearningAuditAction =
  | 'EXPERIENCE_CREATED'
  | 'EXPERIENCE_VALIDATED'
  | 'EXPERIENCE_REVIEWED'
  | 'ASSIGNMENT_CREATED'
  | 'ATTEMPT_STARTED'
  | 'LEARNING_EVENT_INGESTED'
  | 'PROGRESS_READ';
type LearningAuditResourceType = 'EXPERIENCE' | 'VERSION' | 'ASSIGNMENT' | 'ATTEMPT';
type LearningAuditOutcome = 'SUCCEEDED' | 'DUPLICATE' | 'DENIED' | 'CONFLICT';

export class InvalidStateError extends Error {
  constructor() {
    super('Resource is not in the required state');
    this.name = 'InvalidStateError';
  }
}

export class ContentIntegrityError extends Error {
  constructor() {
    super('Experience content integrity check failed');
    this.name = 'ContentIntegrityError';
  }
}

export interface CreatedScienceExperience {
  readonly experienceId: string;
  readonly publicId: string;
  readonly versionId: string;
  readonly version: 1;
  readonly status: 'GENERATED';
  readonly contentHash: string;
}

export interface ExperienceValidationResult {
  readonly versionId: string;
  readonly status: 'VALIDATED' | 'REJECTED';
  readonly report: ScienceValidationReport;
}

export interface ExperienceReviewResult {
  readonly versionId: string;
  readonly status: 'APPROVED' | 'REJECTED';
}

export interface ExperiencePreview {
  readonly versionId: string;
  readonly status: ExperienceVersionStatus;
  readonly contentHash: string;
  readonly specification: ScienceBlockSpec;
  readonly sandboxDocument: string;
  readonly validationReport: ScienceValidationReport | null;
}

export interface Assignment {
  readonly id: string;
  readonly organizationId: string;
  readonly classId: string;
  readonly experienceVersionId: string;
  readonly startsAt: string;
  readonly dueAt: string | null;
  readonly status: 'ACTIVE';
}

export interface StudentAssignmentSummary extends Assignment {
  readonly title: string;
  readonly attemptStatus: AttemptStatus | null;
}

export interface AttemptSession {
  readonly id: string;
  readonly assignmentId: string;
  readonly status: AttemptStatus;
  readonly resumed: boolean;
  readonly nextSequence: number;
  readonly answers: readonly AttemptAnswerState[];
  readonly rasa: {
    readonly enabled: boolean;
    readonly maxHintLevel: 1 | 2 | 3;
    readonly hints: readonly { stepId: string; level: 1 | 2 | 3; content: string }[];
  };
}

export interface AttemptAnswerState {
  readonly stepId: string;
  readonly attempts: number;
  readonly correct: boolean;
}

export interface PlayerSession {
  readonly assignmentId: string;
  readonly attemptId: string;
  readonly experienceId: string;
  readonly experienceVersion: number;
  readonly contentHash: string;
  readonly specification: ScienceBlockSpec;
  readonly sandboxDocument: string;
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

async function writeLearningAudit(
  queryable: Queryable,
  input: {
    traceId: string;
    actorUserId: string;
    organizationId: string;
    action: LearningAuditAction;
    resourceType: LearningAuditResourceType;
    resourceId: string | null;
    outcome: LearningAuditOutcome;
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

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function parseStoredArtifact(value: unknown): ScienceArtifact {
  try {
    return parseScienceArtifact(parseJson(value));
  } catch {
    throw new ContentIntegrityError();
  }
}

async function requireTeacher(
  queryable: Queryable,
  actor: Actor,
  organizationId: string,
): Promise<void> {
  const authorized = await queryable.query<{ user_id: string }>(
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
    throw new ResourceNotFoundError();
  }
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    classId: row.class_id,
    experienceVersionId: row.experience_version_id,
    startsAt: toIso(row.starts_at),
    dueAt: row.due_at === null ? null : toIso(row.due_at),
    status: row.status,
  };
}

async function readAttemptResumeState(
  queryable: Queryable,
  attemptId: string,
): Promise<{ nextSequence: number; answers: AttemptAnswerState[]; rasa: AttemptSession['rasa'] }> {
  const result = await queryable.query<StoredEventRow>(
    `SELECT type, step_id, sequence, payload
     FROM learning_events
     WHERE attempt_id = $1
     ORDER BY sequence`,
    [attemptId],
  );
  const answers = new Map<string, AttemptAnswerState>();
  for (const event of result.rows) {
    if (event.type !== 'QUESTION_ANSWERED' && event.type !== 'ANSWER_RETRIED') {
      continue;
    }
    const payload = parseJson<Record<string, unknown>>(event.payload);
    if (typeof payload['attempt'] !== 'number' || typeof payload['correct'] !== 'boolean') {
      throw new ContentIntegrityError();
    }
    answers.set(event.step_id, {
      stepId: event.step_id,
      attempts: payload['attempt'],
      correct: payload['correct'],
    });
  }
  const rasaPolicy = await queryable.query<{ enabled: boolean; max_hint_level: 1 | 2 | 3 }>(
    `SELECT p.enabled, p.max_hint_level
     FROM attempts at
     LEFT JOIN assignment_rasa_policies p
       ON p.organization_id = at.organization_id AND p.assignment_id = at.assignment_id
     WHERE at.id = $1`,
    [attemptId],
  );
  const policy = rasaPolicy.rows[0];
  const hints = await queryable.query<{ action: unknown }>(
    `SELECT ra.action FROM rasa_sessions rs
     JOIN rasa_requests rr ON rr.organization_id = rs.organization_id AND rr.session_id = rs.id AND rr.status = 'SUCCEEDED'
     JOIN rasa_actions ra ON ra.organization_id = rr.organization_id AND ra.request_id = rr.id AND ra.status = 'ACCEPTED'
     WHERE rs.attempt_id = $1 ORDER BY ra.created_at, ra.id`,
    [attemptId],
  );
  return {
    nextSequence: result.rows.length,
    answers: [...answers.values()],
    rasa: {
      enabled: policy?.enabled ?? false,
      maxHintLevel: policy?.max_hint_level ?? 1,
      hints: hints.rows.map(({ action }) => {
        const parsed = parseJson<{ stepId: string; level: 1 | 2 | 3; content: string }>(action);
        return { stepId: parsed.stepId, level: parsed.level, content: parsed.content };
      }),
    },
  };
}

export class LearningRepository {
  private readonly now: () => Date;

  constructor(
    private readonly database: PGliteInterface,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async runAudited<T>(
    input: {
      actor: Actor;
      organizationId: string;
      traceId: string;
      action: LearningAuditAction;
      resourceType: LearningAuditResourceType;
      fallbackResourceId: string | null;
    },
    operation: (
      transaction: Transaction,
    ) => Promise<{ value: T; resourceId: string | null; outcome?: LearningAuditOutcome }>,
  ): Promise<T> {
    try {
      return await this.database.transaction(async (transaction) => {
        const result = await operation(transaction);
        await writeLearningAudit(transaction, {
          traceId: input.traceId,
          actorUserId: input.actor.userId,
          organizationId: input.organizationId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: result.resourceId,
          outcome: result.outcome ?? 'SUCCEEDED',
        });
        return result.value;
      });
    } catch (error) {
      const outcome =
        error instanceof ResourceNotFoundError
          ? 'DENIED'
          : error instanceof ConflictError ||
              error instanceof InvalidStateError ||
              error instanceof ContentIntegrityError
            ? 'CONFLICT'
            : null;
      if (outcome !== null) {
        await writeLearningAudit(this.database, {
          traceId: input.traceId,
          actorUserId: input.actor.userId,
          organizationId: input.organizationId,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.fallbackResourceId,
          outcome,
        });
      }
      throw error;
    }
  }

  async createScienceExperience(
    actorInput: Actor,
    organizationIdInput: string,
    rawTitle: string,
    generatedSpecText: string,
    traceIdInput?: string,
  ): Promise<CreatedScienceExperience> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const input = createScienceExperienceInputSchema.parse({ title: rawTitle, generatedSpecText });
    const specification = parseGeneratedScienceSpec(input.generatedSpecText);
    const artifact = buildScienceArtifact(specification);
    const contentHash = hashScienceArtifact(artifact);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<CreatedScienceExperience>(
      {
        actor,
        organizationId,
        traceId,
        action: 'EXPERIENCE_CREATED',
        resourceType: 'EXPERIENCE',
        fallbackResourceId: null,
      },
      async (transaction) => {
        await requireTeacher(transaction, actor, organizationId);
        const experienceId = randomUUID();
        const versionId = randomUUID();
        const publicId = `science_${experienceId.replaceAll('-', '').slice(0, 12)}`;
        await transaction.query(
          `INSERT INTO experiences
          (id, organization_id, owner_id, public_id, title, subject, status)
         VALUES ($1, $2, $3, $4, $5, 'science', 'DRAFT')`,
          [experienceId, organizationId, actor.userId, publicId, input.title],
        );
        await transaction.query(
          `INSERT INTO experience_versions
          (id, organization_id, experience_id, version, specification, artifact, content_hash, status)
         VALUES ($1, $2, $3, 1, $4::jsonb, $5::jsonb, $6, 'GENERATED')`,
          [
            versionId,
            organizationId,
            experienceId,
            JSON.stringify(specification),
            JSON.stringify(artifact),
            contentHash,
          ],
        );
        return {
          value: {
            experienceId,
            publicId,
            versionId,
            version: 1 as const,
            status: 'GENERATED' as const,
            contentHash,
          },
          resourceId: experienceId,
        };
      },
    );
  }

  async validateExperienceVersion(
    actorInput: Actor,
    organizationIdInput: string,
    versionIdInput: string,
    traceIdInput?: string,
  ): Promise<ExperienceValidationResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const versionId = parseUuidOrNotFound(versionIdInput);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<ExperienceValidationResult>(
      {
        actor,
        organizationId,
        traceId,
        action: 'EXPERIENCE_VALIDATED',
        resourceType: 'VERSION',
        fallbackResourceId: versionId,
      },
      async (transaction) => {
        await requireTeacher(transaction, actor, organizationId);
        const result = await transaction.query<
          Pick<VersionRow, 'specification' | 'artifact' | 'content_hash' | 'status'>
        >(
          `SELECT v.specification, v.artifact, v.content_hash, v.status
         FROM experience_versions v
         JOIN experiences e
           ON e.organization_id = v.organization_id AND e.id = v.experience_id
         JOIN organization_members m
           ON m.organization_id = v.organization_id
          AND m.user_id = $3
          AND m.status = 'ACTIVE'
          AND m.role IN ('TEACHER', 'ORG_ADMIN')
         WHERE v.organization_id = $1
           AND v.id = $2
           AND (e.owner_id = $3 OR m.role = 'ORG_ADMIN')
         FOR UPDATE`,
          [organizationId, versionId, actor.userId],
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new ResourceNotFoundError();
        }
        if (row.status !== 'GENERATED') {
          throw new InvalidStateError();
        }
        const specification = scienceBlockSpecSchema.parse(parseJson(row.specification));
        const storedArtifact = parseStoredArtifact(row.artifact);
        const canonicalArtifact = buildScienceArtifact(specification);
        if (
          hashScienceArtifact(storedArtifact) !== hashScienceArtifact(canonicalArtifact) ||
          !verifyScienceArtifactHash(storedArtifact, row.content_hash)
        ) {
          throw new ContentIntegrityError();
        }
        const report = validateScienceSpec(specification);
        const status = report.verdict === 'PASS' ? 'VALIDATED' : 'REJECTED';
        await transaction.query(
          `INSERT INTO experience_validations
          (id, organization_id, version_id, validator_policy_version, verdict, content_hash,
           findings, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
          [
            randomUUID(),
            organizationId,
            versionId,
            report.policyVersion,
            report.verdict,
            row.content_hash,
            JSON.stringify(report.findings),
            this.now().toISOString(),
          ],
        );
        await transaction.query('UPDATE experience_versions SET status = $1 WHERE id = $2', [
          status,
          versionId,
        ]);
        return { value: { versionId, status, report }, resourceId: versionId };
      },
    );
  }

  async reviewExperienceVersion(
    actorInput: Actor,
    organizationIdInput: string,
    versionIdInput: string,
    reviewInput: ReviewExperienceVersionInput,
    traceIdInput?: string,
  ): Promise<ExperienceReviewResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const versionId = parseUuidOrNotFound(versionIdInput);
    const review = reviewExperienceVersionInputSchema.parse(reviewInput);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<ExperienceReviewResult>(
      {
        actor,
        organizationId,
        traceId,
        action: 'EXPERIENCE_REVIEWED',
        resourceType: 'VERSION',
        fallbackResourceId: versionId,
      },
      async (transaction) => {
        await requireTeacher(transaction, actor, organizationId);
        const result = await transaction.query<VersionRow>(
          `SELECT v.id, v.experience_id, v.version, v.specification, v.artifact, v.manifest,
                v.content_hash, v.status, e.public_id, e.title, e.owner_id
         FROM experience_versions v
         JOIN experiences e
           ON e.organization_id = v.organization_id AND e.id = v.experience_id
         JOIN organization_members m
           ON m.organization_id = v.organization_id
          AND m.user_id = $3
          AND m.status = 'ACTIVE'
          AND m.role IN ('TEACHER', 'ORG_ADMIN')
         WHERE v.organization_id = $1
           AND v.id = $2
           AND (e.owner_id = $3 OR m.role = 'ORG_ADMIN')
         FOR UPDATE`,
          [organizationId, versionId, actor.userId],
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new ResourceNotFoundError();
        }
        if (row.status !== 'VALIDATED') {
          throw new InvalidStateError();
        }

        const artifact = parseStoredArtifact(row.artifact);
        if (!verifyScienceArtifactHash(artifact, row.content_hash)) {
          throw new ContentIntegrityError();
        }
        const canonicalSpecification = scienceBlockSpecSchema.parse(parseJson(row.specification));
        if (
          hashScienceArtifact(buildScienceArtifact(canonicalSpecification)) !== row.content_hash
        ) {
          throw new ContentIntegrityError();
        }
        const validation = await transaction.query<{
          content_hash: string;
          verdict: 'PASS' | 'FAIL';
        }>(
          `SELECT content_hash, verdict
         FROM experience_validations
         WHERE organization_id = $1 AND version_id = $2
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
          [organizationId, versionId],
        );
        const validationRow = validation.rows[0];
        if (
          validationRow === undefined ||
          validationRow.verdict !== 'PASS' ||
          validationRow.content_hash !== row.content_hash
        ) {
          throw new ContentIntegrityError();
        }
        const status = review.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        let manifest: unknown = null;
        if (review.decision === 'APPROVE') {
          manifest = experienceManifestSchema.parse({
            schemaVersion: 1,
            id: row.public_id,
            version: row.version,
            title: row.title,
            subject: 'science',
            gradeBands: [artifact.specification.gradeBand],
            type: 'simulation',
            entrypoint: `/runner/${row.public_id}/${row.version}`,
            organizationId,
            authorId: row.owner_id,
            status: 'approved',
            learningObjectives: artifact.specification.learningObjectives.map(({ text }) => text),
            capabilities: ['quiz'],
            createdWithAI: true,
            contentHash: row.content_hash,
          });
        }
        await transaction.query(
          `INSERT INTO experience_approvals
          (id, organization_id, version_id, teacher_id, decision, content_hash, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            randomUUID(),
            organizationId,
            versionId,
            actor.userId,
            review.decision,
            row.content_hash,
            review.note ?? null,
            this.now().toISOString(),
          ],
        );
        await transaction.query(
          `UPDATE experience_versions SET status = $1, manifest = $2::jsonb WHERE id = $3`,
          [status, JSON.stringify(manifest), versionId],
        );
        if (status === 'APPROVED') {
          await transaction.query("UPDATE experiences SET status = 'ACTIVE' WHERE id = $1", [
            row.experience_id,
          ]);
        }
        return { value: { versionId, status }, resourceId: versionId };
      },
    );
  }

  async getExperiencePreview(
    actorInput: Actor,
    organizationIdInput: string,
    versionIdInput: string,
  ): Promise<ExperiencePreview> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const versionId = parseUuidOrNotFound(versionIdInput);
    await requireTeacher(this.database, actor, organizationId);
    const result = await this.database.query<VersionRow & { report: unknown }>(
      `SELECT v.id, v.experience_id, v.version, v.specification, v.artifact, v.manifest,
              v.content_hash, v.status, e.public_id, e.title, e.owner_id,
              (SELECT jsonb_build_object(
                 'policyVersion', ev.validator_policy_version,
                 'verdict', ev.verdict,
                 'findings', ev.findings
               )
               FROM experience_validations ev
               WHERE ev.organization_id = v.organization_id
                 AND ev.version_id = v.id
                 AND ev.content_hash = v.content_hash
               ORDER BY ev.created_at DESC LIMIT 1) AS report
       FROM experience_versions v
       JOIN experiences e ON e.organization_id = v.organization_id AND e.id = v.experience_id
       JOIN organization_members m
         ON m.organization_id = v.organization_id
        AND m.user_id = $3
        AND m.status = 'ACTIVE'
        AND m.role IN ('TEACHER', 'ORG_ADMIN')
       WHERE v.organization_id = $1
         AND v.id = $2
         AND (e.owner_id = $3 OR m.role = 'ORG_ADMIN')`,
      [organizationId, versionId, actor.userId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new ResourceNotFoundError();
    }
    const artifact = parseStoredArtifact(row.artifact);
    if (!verifyScienceArtifactHash(artifact, row.content_hash)) {
      throw new ContentIntegrityError();
    }
    return {
      versionId,
      status: row.status,
      contentHash: row.content_hash,
      specification: artifact.specification,
      sandboxDocument: buildScienceSandboxDocument(artifact),
      validationReport: row.report === null ? null : parseJson<ScienceValidationReport>(row.report),
    };
  }

  async createAssignment(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    assignmentInput: CreateAssignmentInput,
    traceIdInput?: string,
  ): Promise<Assignment> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const input = createAssignmentInputSchema.parse(assignmentInput);
    const traceId = resolveTraceId(traceIdInput);

    return this.runAudited<Assignment>(
      {
        actor,
        organizationId,
        traceId,
        action: 'ASSIGNMENT_CREATED',
        resourceType: 'ASSIGNMENT',
        fallbackResourceId: null,
      },
      async (transaction) => {
        await requireTeacher(transaction, actor, organizationId);
        const lessonClass = await transaction.query<{ id: string }>(
          `SELECT c.id FROM classes c
         JOIN organization_members m
           ON m.organization_id = c.organization_id
          AND m.user_id = $1
          AND m.status = 'ACTIVE'
          AND m.role IN ('TEACHER', 'ORG_ADMIN')
         WHERE c.organization_id = $2
           AND c.id = $3
           AND c.status = 'ACTIVE'
           AND (c.owner_teacher_id = $1 OR m.role = 'ORG_ADMIN')`,
          [actor.userId, organizationId, classId],
        );
        if (lessonClass.rows[0] === undefined) {
          throw new ResourceNotFoundError();
        }
        const version = await transaction.query<{ id: string; status: ExperienceVersionStatus }>(
          `SELECT id, status FROM experience_versions
         WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
          [organizationId, input.experienceVersionId],
        );
        const versionRow = version.rows[0];
        if (versionRow === undefined) {
          throw new ResourceNotFoundError();
        }
        if (!['APPROVED', 'PUBLISHED'].includes(versionRow.status)) {
          throw new InvalidStateError();
        }

        const assignmentId = randomUUID();
        const startsAt = input.startsAt ?? this.now().toISOString();
        const inserted = await transaction.query<AssignmentRow>(
          `INSERT INTO assignments
          (id, organization_id, class_id, experience_version_id, starts_at, due_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, organization_id, class_id, experience_version_id, starts_at, due_at, status`,
          [
            assignmentId,
            organizationId,
            classId,
            input.experienceVersionId,
            startsAt,
            input.dueAt ?? null,
          ],
        );
        if (versionRow.status === 'APPROVED') {
          await transaction.query(
            "UPDATE experience_versions SET status = 'PUBLISHED' WHERE id = $1",
            [input.experienceVersionId],
          );
        }
        const row = inserted.rows[0];
        if (row === undefined) {
          throw new Error('Assignment insert returned no row');
        }
        const rasaPolicy = input.rasaPolicy ?? { enabled: false, maxHintLevel: 1 as const };
        await transaction.query(
          `INSERT INTO assignment_rasa_policies
            (organization_id, assignment_id, enabled, max_hint_level, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [organizationId, assignmentId, rasaPolicy.enabled, rasaPolicy.maxHintLevel, actor.userId],
        );
        return { value: mapAssignment(row), resourceId: assignmentId };
      },
    );
  }

  async listStudentAssignments(
    actorInput: Actor,
    organizationIdInput: string,
  ): Promise<StudentAssignmentSummary[]> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const result = await this.database.query<
      AssignmentRow & { title: string; attempt_status: AttemptStatus | null }
    >(
      `SELECT a.id, a.organization_id, a.class_id, a.experience_version_id,
              a.starts_at, a.due_at, a.status, e.title, at.status AS attempt_status
       FROM assignments a
       JOIN organizations o
         ON o.id = a.organization_id AND o.status = 'ACTIVE'
       JOIN classes c
         ON c.organization_id = a.organization_id AND c.id = a.class_id AND c.status = 'ACTIVE'
       JOIN class_members cm
         ON cm.organization_id = a.organization_id
        AND cm.class_id = a.class_id
        AND cm.user_id = $1
        AND cm.role = 'STUDENT'
        AND cm.status = 'ACTIVE'
       JOIN organization_members om
         ON om.organization_id = a.organization_id
        AND om.user_id = cm.user_id
        AND om.role = 'STUDENT'
        AND om.status = 'ACTIVE'
       JOIN users u ON u.id = cm.user_id AND u.platform_role = 'STUDENT' AND u.status = 'ACTIVE'
       JOIN experience_versions v
         ON v.organization_id = a.organization_id AND v.id = a.experience_version_id
       JOIN experiences e
         ON e.organization_id = v.organization_id AND e.id = v.experience_id
       LEFT JOIN attempts at
         ON at.organization_id = a.organization_id
        AND at.assignment_id = a.id
        AND at.student_id = $1
       WHERE a.organization_id = $2
         AND a.status = 'ACTIVE'
         AND a.starts_at <= $3
         AND (a.due_at IS NULL OR a.due_at >= $3)
       ORDER BY a.created_at, a.id`,
      [actor.userId, organizationId, this.now().toISOString()],
    );
    return result.rows.map((row) => ({
      ...mapAssignment(row),
      title: row.title,
      attemptStatus: row.attempt_status,
    }));
  }

  async startOrResumeAttempt(
    actorInput: Actor,
    organizationIdInput: string,
    assignmentIdInput: string,
    traceIdInput?: string,
  ): Promise<AttemptSession> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    const traceId = resolveTraceId(traceIdInput);
    return this.runAudited<AttemptSession>(
      {
        actor,
        organizationId,
        traceId,
        action: 'ATTEMPT_STARTED',
        resourceType: 'ATTEMPT',
        fallbackResourceId: null,
      },
      async (transaction) => {
        const assignment = await transaction.query<AssignmentRow>(
          `SELECT a.id, a.organization_id, a.class_id, a.experience_version_id,
                a.starts_at, a.due_at, a.status
         FROM assignments a
         JOIN organizations o
           ON o.id = a.organization_id AND o.status = 'ACTIVE'
         JOIN classes c
           ON c.organization_id = a.organization_id
          AND c.id = a.class_id
          AND c.status = 'ACTIVE'
         JOIN class_members cm
           ON cm.organization_id = a.organization_id
          AND cm.class_id = a.class_id
          AND cm.user_id = $1
          AND cm.role = 'STUDENT'
          AND cm.status = 'ACTIVE'
         JOIN organization_members om
           ON om.organization_id = a.organization_id
          AND om.user_id = cm.user_id
          AND om.role = 'STUDENT'
          AND om.status = 'ACTIVE'
         JOIN users u ON u.id = cm.user_id AND u.platform_role = 'STUDENT' AND u.status = 'ACTIVE'
         WHERE a.organization_id = $2
           AND a.id = $3
           AND a.status = 'ACTIVE'
           AND a.starts_at <= $4
           AND (a.due_at IS NULL OR a.due_at >= $4)`,
          [actor.userId, organizationId, assignmentId, this.now().toISOString()],
        );
        const assignmentRow = assignment.rows[0];
        if (assignmentRow === undefined) {
          throw new ResourceNotFoundError();
        }
        const existing = await transaction.query<AttemptRow>(
          `SELECT id, assignment_id, class_id, student_id, status FROM attempts
         WHERE organization_id = $1 AND assignment_id = $2 AND student_id = $3`,
          [organizationId, assignmentId, actor.userId],
        );
        const existingRow = existing.rows[0];
        if (existingRow !== undefined) {
          const resumeState = await readAttemptResumeState(transaction, existingRow.id);
          return {
            value: {
              id: existingRow.id,
              assignmentId: existingRow.assignment_id,
              status: existingRow.status,
              resumed: true,
              ...resumeState,
            },
            resourceId: existingRow.id,
          };
        }
        const attemptId = randomUUID();
        await transaction.query(
          `INSERT INTO attempts
          (id, organization_id, assignment_id, class_id, student_id, status)
         VALUES ($1, $2, $3, $4, $5, 'READY')`,
          [attemptId, organizationId, assignmentId, assignmentRow.class_id, actor.userId],
        );
        const initialState = await readAttemptResumeState(transaction, attemptId);
        return {
          value: {
            id: attemptId,
            assignmentId,
            status: 'READY' as const,
            resumed: false,
            ...initialState,
          },
          resourceId: attemptId,
        };
      },
    );
  }

  async getPlayerSession(
    actorInput: Actor,
    organizationIdInput: string,
    assignmentIdInput: string,
  ): Promise<PlayerSession> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    const receivedAt = this.now().toISOString();
    const result = await this.database.query<
      VersionRow & { assignment_id: string; attempt_id: string }
    >(
      `SELECT v.id, v.experience_id, v.version, v.specification, v.artifact, v.manifest,
              v.content_hash, v.status, e.public_id, e.title, e.owner_id,
              a.id AS assignment_id, at.id AS attempt_id
       FROM assignments a
       JOIN organizations o
         ON o.id = a.organization_id AND o.status = 'ACTIVE'
       JOIN classes c
         ON c.organization_id = a.organization_id
        AND c.id = a.class_id
        AND c.status = 'ACTIVE'
       JOIN attempts at
         ON at.organization_id = a.organization_id
        AND at.assignment_id = a.id
        AND at.student_id = $1
        AND at.status IN ('READY', 'IN_PROGRESS')
       JOIN class_members cm
         ON cm.organization_id = a.organization_id
        AND cm.class_id = a.class_id
        AND cm.user_id = at.student_id
        AND cm.role = 'STUDENT'
        AND cm.status = 'ACTIVE'
       JOIN organization_members om
         ON om.organization_id = a.organization_id
        AND om.user_id = at.student_id
        AND om.role = 'STUDENT'
        AND om.status = 'ACTIVE'
       JOIN users u ON u.id = at.student_id AND u.platform_role = 'STUDENT' AND u.status = 'ACTIVE'
       JOIN experience_versions v
         ON v.organization_id = a.organization_id
        AND v.id = a.experience_version_id
        AND v.status = 'PUBLISHED'
       JOIN experiences e ON e.organization_id = v.organization_id AND e.id = v.experience_id
       WHERE a.organization_id = $2
         AND a.id = $3
         AND a.status = 'ACTIVE'
         AND a.starts_at <= $4
         AND (a.due_at IS NULL OR a.due_at >= $4)`,
      [actor.userId, organizationId, assignmentId, receivedAt],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new ResourceNotFoundError();
    }
    const artifact = parseStoredArtifact(row.artifact);
    if (!verifyScienceArtifactHash(artifact, row.content_hash)) {
      throw new ContentIntegrityError();
    }
    return {
      assignmentId: row.assignment_id,
      attemptId: row.attempt_id,
      experienceId: row.public_id,
      experienceVersion: row.version,
      contentHash: row.content_hash,
      specification: artifact.specification,
      sandboxDocument: buildScienceSandboxDocument(artifact),
    };
  }

  async ingestLearningEvent(
    actorInput: Actor,
    eventInput: ClientLearningEvent,
    traceIdInput?: string,
  ): Promise<EventIngestionResult> {
    const actor = parseActor(actorInput);
    const event = clientLearningEventSchema.parse(eventInput);
    const traceId = resolveTraceId(traceIdInput);
    return this.runAudited<EventIngestionResult>(
      {
        actor,
        organizationId: event.organizationId,
        traceId,
        action: 'LEARNING_EVENT_INGESTED',
        resourceType: 'ATTEMPT',
        fallbackResourceId: event.attemptId,
      },
      async (transaction) => {
        const receivedAt = this.now().toISOString();
        const context = await transaction.query<{
          assignment_id: string;
          attempt_status: AttemptStatus;
          public_id: string;
          version: number;
          artifact: unknown;
          content_hash: string;
          class_id: string;
        }>(
          `SELECT a.id AS assignment_id, at.status AS attempt_status, at.class_id,
                e.public_id, v.version, v.artifact, v.content_hash
         FROM attempts at
         JOIN assignments a
           ON a.organization_id = at.organization_id
          AND a.id = at.assignment_id
          AND a.status = 'ACTIVE'
          AND a.starts_at <= $4
          AND (a.due_at IS NULL OR a.due_at >= $4)
         JOIN organizations o
           ON o.id = at.organization_id AND o.status = 'ACTIVE'
         JOIN classes c
           ON c.organization_id = at.organization_id
          AND c.id = at.class_id
          AND c.status = 'ACTIVE'
         JOIN class_members cm
           ON cm.organization_id = at.organization_id
          AND cm.class_id = at.class_id
          AND cm.user_id = at.student_id
          AND cm.role = 'STUDENT'
          AND cm.status = 'ACTIVE'
         JOIN organization_members om
           ON om.organization_id = at.organization_id
          AND om.user_id = at.student_id
          AND om.role = 'STUDENT'
          AND om.status = 'ACTIVE'
         JOIN users u
           ON u.id = at.student_id AND u.platform_role = 'STUDENT' AND u.status = 'ACTIVE'
         JOIN experience_versions v
           ON v.organization_id = a.organization_id
          AND v.id = a.experience_version_id
          AND v.status = 'PUBLISHED'
         JOIN experiences e ON e.organization_id = v.organization_id AND e.id = v.experience_id
         WHERE at.organization_id = $1 AND at.id = $2 AND at.student_id = $3
         FOR UPDATE`,
          [event.organizationId, event.attemptId, actor.userId, receivedAt],
        );
        const eventContext = context.rows[0];
        if (
          eventContext === undefined ||
          eventContext.assignment_id !== event.assignmentId ||
          eventContext.public_id !== event.experienceId ||
          eventContext.version !== event.experienceVersion
        ) {
          throw new ResourceNotFoundError();
        }

        const artifact = parseStoredArtifact(eventContext.artifact);
        if (!verifyScienceArtifactHash(artifact, eventContext.content_hash)) {
          throw new ContentIntegrityError();
        }

        const existingById = await transaction.query<{ event_json: unknown }>(
          `SELECT event_json
         FROM learning_events WHERE organization_id = $1 AND id = $2`,
          [event.organizationId, event.eventId],
        );
        const existing = existingById.rows[0];
        if (existing !== undefined) {
          const priorServerEvent = serverLearningEventSchema.parse(parseJson(existing.event_json));
          let priorClientEvent: ClientLearningEvent;
          let priorAnswer: EventIngestionResult['answer'] = null;
          if (
            priorServerEvent.type === 'QUESTION_ANSWERED' ||
            priorServerEvent.type === 'ANSWER_RETRIED'
          ) {
            const { correct, ...clientPayload } = priorServerEvent.payload;
            priorClientEvent = clientLearningEventSchema.parse({
              ...priorServerEvent,
              payload: clientPayload,
            });
            priorAnswer = {
              stepId: priorServerEvent.stepId,
              attempt: priorServerEvent.payload.attempt,
              correct,
            };
          } else {
            priorClientEvent = clientLearningEventSchema.parse(priorServerEvent);
          }
          if (JSON.stringify(priorClientEvent) === JSON.stringify(event)) {
            const next = await transaction.query<{ next_sequence: number }>(
              'SELECT COALESCE(MAX(sequence) + 1, 0)::int AS next_sequence FROM learning_events WHERE attempt_id = $1',
              [event.attemptId],
            );
            return {
              value: {
                accepted: false,
                duplicate: true,
                answer: priorAnswer,
                nextSequence: next.rows[0]?.next_sequence ?? 0,
              },
              resourceId: event.attemptId,
              outcome: 'DUPLICATE',
            };
          }
          throw new ConflictError();
        }

        let storedEvent: ServerLearningEvent;
        let answer: EventIngestionResult['answer'] = null;
        if (event.type === 'QUESTION_ANSWERED' || event.type === 'ANSWER_RETRIED') {
          const quiz = artifact.specification.blocks.find(
            (block) => block.kind === 'QUIZ' && block.id === event.stepId,
          );
          if (quiz?.kind !== 'QUIZ') {
            throw new ResourceNotFoundError();
          }
          const selectedOption = quiz.options.find(({ id }) => id === event.payload.optionId);
          if (selectedOption === undefined) {
            throw new ResourceNotFoundError();
          }
          answer = {
            stepId: event.stepId,
            attempt: event.payload.attempt,
            correct: selectedOption.correct,
          };
          storedEvent = serverLearningEventSchema.parse({
            ...event,
            payload: { ...event.payload, correct: selectedOption.correct },
          });
        } else {
          storedEvent = serverLearningEventSchema.parse(event);
        }
        const exactJson = JSON.stringify(storedEvent);

        const sequenceConflict = await transaction.query<{ id: string }>(
          'SELECT id FROM learning_events WHERE attempt_id = $1 AND sequence = $2',
          [event.attemptId, event.sequence],
        );
        if (sequenceConflict.rows[0] !== undefined) {
          throw new ConflictError();
        }
        const prior = await transaction.query<StoredEventRow>(
          `SELECT type, step_id, sequence, payload
         FROM learning_events WHERE attempt_id = $1 ORDER BY sequence`,
          [event.attemptId],
        );
        const priorTypes = prior.rows.map(({ type }) => type);
        if (event.sequence !== prior.rows.length) {
          throw new InvalidStateError();
        }
        if (event.type === 'EXPERIENCE_STARTED') {
          if (
            priorTypes.length > 0 ||
            event.sequence !== 0 ||
            eventContext.attempt_status !== 'READY'
          ) {
            throw new InvalidStateError();
          }
        } else if (!priorTypes.includes('EXPERIENCE_STARTED')) {
          throw new InvalidStateError();
        }
        if (priorTypes.includes('EXPERIENCE_COMPLETED')) {
          throw new InvalidStateError();
        }

        if (event.type === 'QUESTION_ANSWERED' || event.type === 'ANSWER_RETRIED') {
          const stepAnswers = prior.rows.filter(
            (priorEvent) =>
              priorEvent.step_id === event.stepId &&
              (priorEvent.type === 'QUESTION_ANSWERED' || priorEvent.type === 'ANSWER_RETRIED'),
          );
          const lastAnswer = stepAnswers.at(-1);
          if (event.type === 'QUESTION_ANSWERED') {
            if (stepAnswers.length > 0 || event.payload.attempt !== 1) {
              throw new InvalidStateError();
            }
          } else {
            if (lastAnswer === undefined) {
              throw new InvalidStateError();
            }
            const priorPayload = parseJson<Record<string, unknown>>(lastAnswer.payload);
            if (
              priorPayload['correct'] !== false ||
              typeof priorPayload['attempt'] !== 'number' ||
              event.payload.attempt !== priorPayload['attempt'] + 1
            ) {
              throw new InvalidStateError();
            }
          }
        }

        if (event.type === 'EXPERIENCE_COMPLETED') {
          for (const block of artifact.specification.blocks) {
            if (block.kind !== 'QUIZ') {
              continue;
            }
            const lastAnswer = prior.rows
              .filter(
                (priorEvent) =>
                  priorEvent.step_id === block.id &&
                  (priorEvent.type === 'QUESTION_ANSWERED' || priorEvent.type === 'ANSWER_RETRIED'),
              )
              .at(-1);
            if (lastAnswer === undefined) {
              throw new InvalidStateError();
            }
            const priorPayload = parseJson<Record<string, unknown>>(lastAnswer.payload);
            if (priorPayload['correct'] !== true) {
              throw new InvalidStateError();
            }
          }
        }

        await transaction.query(
          `INSERT INTO learning_events
          (id, organization_id, actor_id, assignment_id, attempt_id, type, step_id,
           sequence, occurred_at, received_at, payload, event_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
          [
            event.eventId,
            event.organizationId,
            actor.userId,
            event.assignmentId,
            event.attemptId,
            storedEvent.type,
            storedEvent.stepId,
            storedEvent.sequence,
            storedEvent.occurredAt,
            receivedAt,
            JSON.stringify(storedEvent.payload),
            exactJson,
          ],
        );
        if (['QUESTION_ANSWERED', 'ANSWER_RETRIED', 'EXPERIENCE_COMPLETED'].includes(event.type)) {
          const campaign = await transaction.query<{ id: string }>(
            `SELECT id FROM class_boss_campaigns
             WHERE organization_id = $1 AND class_id = $2 AND status = 'ACTIVE'
             FOR UPDATE`,
            [event.organizationId, eventContext.class_id],
          );
          const campaignId = campaign.rows[0]?.id;
          if (campaignId !== undefined) {
            await transaction.query(
              `INSERT INTO boss_projection_jobs
                (id, organization_id, learning_event_id, campaign_id, status)
               VALUES ($1, $2, $3, $4, 'PENDING')
               ON CONFLICT (organization_id, learning_event_id) DO NOTHING`,
              [randomUUID(), event.organizationId, event.eventId, campaignId],
            );
          }
        }
        if (event.type === 'EXPERIENCE_STARTED') {
          await transaction.query(
            "UPDATE attempts SET status = 'IN_PROGRESS', started_at = $1 WHERE id = $2",
            [receivedAt, event.attemptId],
          );
        } else if (event.type === 'EXPERIENCE_COMPLETED') {
          await transaction.query(
            "UPDATE attempts SET status = 'COMPLETED', completed_at = $1 WHERE id = $2",
            [receivedAt, event.attemptId],
          );
        }
        await this.rebuildProgress(
          transaction,
          event.organizationId,
          event.assignmentId,
          actor.userId,
          event.attemptId,
        );
        return {
          value: { accepted: true, duplicate: false, answer, nextSequence: event.sequence + 1 },
          resourceId: event.attemptId,
        };
      },
    );
  }

  private async rebuildProgress(
    transaction: Transaction,
    organizationId: string,
    assignmentId: string,
    studentId: string,
    attemptId: string,
  ): Promise<void> {
    const result = await transaction.query<StoredEventRow>(
      `SELECT type, step_id, sequence, payload
       FROM learning_events WHERE attempt_id = $1 ORDER BY sequence`,
      [attemptId],
    );
    const events = result.rows;
    const last = events.at(-1);
    const wrongAnswers = events.filter((event) => {
      if (event.type !== 'QUESTION_ANSWERED' && event.type !== 'ANSWER_RETRIED') {
        return false;
      }
      const payload = parseJson<Record<string, unknown>>(event.payload);
      return payload['correct'] === false;
    }).length;
    const retries = events.filter(({ type }) => type === 'ANSWER_RETRIED').length;
    const started = events.some(({ type }) => type === 'EXPERIENCE_STARTED');
    const completed = events.some(({ type }) => type === 'EXPERIENCE_COMPLETED');
    const hintsUsed = events.filter(({ type }) => type === 'HINT_USED').length;
    await transaction.query(
      `INSERT INTO student_progress
        (organization_id, assignment_id, student_id, started, wrong_answers, retries,
         completed, last_sequence, last_step_id, projection_version, hints_used, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (organization_id, assignment_id, student_id)
       DO UPDATE SET
         started = EXCLUDED.started,
         wrong_answers = EXCLUDED.wrong_answers,
         retries = EXCLUDED.retries,
         completed = EXCLUDED.completed,
         last_sequence = EXCLUDED.last_sequence,
         last_step_id = EXCLUDED.last_step_id,
         projection_version = EXCLUDED.projection_version,
         hints_used = EXCLUDED.hints_used,
         updated_at = EXCLUDED.updated_at`,
      [
        organizationId,
        assignmentId,
        studentId,
        started,
        wrongAnswers,
        retries,
        completed,
        last?.sequence ?? null,
        last?.step_id ?? null,
        events.length,
        hintsUsed,
        this.now().toISOString(),
      ],
    );
  }

  async listTeacherProgress(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    assignmentIdInput: string,
    traceIdInput?: string,
  ): Promise<StudentProgress[]> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    const traceId = resolveTraceId(traceIdInput);
    return this.runAudited<StudentProgress[]>(
      {
        actor,
        organizationId,
        traceId,
        action: 'PROGRESS_READ',
        resourceType: 'ASSIGNMENT',
        fallbackResourceId: assignmentId,
      },
      async (transaction) => {
        await requireTeacher(transaction, actor, organizationId);
        const assignment = await transaction.query<{ id: string }>(
          `SELECT a.id FROM assignments a
       JOIN classes c
         ON c.organization_id = a.organization_id AND c.id = a.class_id AND c.status = 'ACTIVE'
       JOIN organization_members m
         ON m.organization_id = c.organization_id
        AND m.user_id = $4
        AND m.status = 'ACTIVE'
        AND m.role IN ('TEACHER', 'ORG_ADMIN')
       WHERE a.organization_id = $1
         AND a.class_id = $2
         AND a.id = $3
         AND (c.owner_teacher_id = $4 OR m.role = 'ORG_ADMIN')`,
          [organizationId, classId, assignmentId, actor.userId],
        );
        if (assignment.rows[0] === undefined) {
          throw new ResourceNotFoundError();
        }
        const progress = await transaction.query<{
          assignment_id: string;
          student_id: string;
          started: boolean;
          wrong_answers: number;
          retries: number;
          completed: boolean;
          last_sequence: number | null;
          last_step_id: string | null;
          projection_version: number;
          hints_used: number;
          updated_at: string | Date;
        }>(
          `SELECT assignment_id, student_id, started, wrong_answers, retries, completed,
              last_sequence, last_step_id, projection_version, hints_used, updated_at
       FROM student_progress
       WHERE organization_id = $1 AND assignment_id = $2
       ORDER BY student_id`,
          [organizationId, assignmentId],
        );
        return {
          value: progress.rows.map((row) => ({
            assignmentId: row.assignment_id,
            studentId: row.student_id,
            started: row.started,
            wrongAnswers: row.wrong_answers,
            retries: row.retries,
            completed: row.completed,
            lastSequence: row.last_sequence,
            lastStepId: row.last_step_id,
            projectionVersion: row.projection_version,
            hintsUsed: row.hints_used,
            updatedAt: toIso(row.updated_at),
          })),
          resourceId: assignmentId,
        };
      },
    );
  }
}
