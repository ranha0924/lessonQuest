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
  uuidSchema,
  type Actor,
  type ClientLearningEvent,
  type CreateAssignmentInput,
  type ReviewExperienceVersionInput,
  type ScienceBlockSpec,
  type StudentProgress,
} from '@lessonquest/contracts';
import {
  buildScienceArtifact,
  buildScienceSandboxDocument,
  hashScienceArtifact,
  parseGeneratedScienceSpec,
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
  type: ClientLearningEvent['type'];
  step_id: string;
  sequence: number;
  payload: unknown;
}

type ExperienceVersionStatus =
  'GENERATED' | 'VALIDATED' | 'REJECTED' | 'APPROVED' | 'PUBLISHED' | 'RETIRED';
type AttemptStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED';

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
  const artifact = parseJson<Record<string, unknown>>(value);
  if (
    artifact['schemaVersion'] !== 1 ||
    artifact['rendererVersion'] !== 'science-blocks-1' ||
    artifact['specification'] === undefined
  ) {
    throw new ContentIntegrityError();
  }
  try {
    return buildScienceArtifact(scienceBlockSpecSchema.parse(artifact['specification']));
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

export class LearningRepository {
  private readonly now: () => Date;

  constructor(
    private readonly database: PGliteInterface,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async createScienceExperience(
    actorInput: Actor,
    organizationIdInput: string,
    rawTitle: string,
    generatedSpecText: string,
  ): Promise<CreatedScienceExperience> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const input = createScienceExperienceInputSchema.parse({ title: rawTitle, generatedSpecText });
    const specification = parseGeneratedScienceSpec(input.generatedSpecText);
    const artifact = buildScienceArtifact(specification);
    const contentHash = hashScienceArtifact(artifact);

    return this.database.transaction(async (transaction) => {
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
        experienceId,
        publicId,
        versionId,
        version: 1,
        status: 'GENERATED',
        contentHash,
      };
    });
  }

  async validateExperienceVersion(
    actorInput: Actor,
    organizationIdInput: string,
    versionIdInput: string,
  ): Promise<ExperienceValidationResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const versionId = parseUuidOrNotFound(versionIdInput);

    return this.database.transaction(async (transaction) => {
      await requireTeacher(transaction, actor, organizationId);
      const result = await transaction.query<Pick<VersionRow, 'specification' | 'status'>>(
        `SELECT v.specification, v.status
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
      const report = validateScienceSpec(specification);
      const status = report.verdict === 'PASS' ? 'VALIDATED' : 'REJECTED';
      await transaction.query(
        `INSERT INTO experience_validations
          (id, organization_id, version_id, validator_policy_version, verdict, findings, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          randomUUID(),
          organizationId,
          versionId,
          report.policyVersion,
          report.verdict,
          JSON.stringify(report.findings),
          this.now().toISOString(),
        ],
      );
      await transaction.query('UPDATE experience_versions SET status = $1 WHERE id = $2', [
        status,
        versionId,
      ]);
      return { versionId, status, report };
    });
  }

  async reviewExperienceVersion(
    actorInput: Actor,
    organizationIdInput: string,
    versionIdInput: string,
    reviewInput: ReviewExperienceVersionInput,
  ): Promise<ExperienceReviewResult> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const versionId = parseUuidOrNotFound(versionIdInput);
    const review = reviewExperienceVersionInputSchema.parse(reviewInput);

    return this.database.transaction(async (transaction) => {
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
          (id, organization_id, version_id, teacher_id, decision, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          organizationId,
          versionId,
          actor.userId,
          review.decision,
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
      return { versionId, status };
    });
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
               WHERE ev.organization_id = v.organization_id AND ev.version_id = v.id
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
  ): Promise<Assignment> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const input = createAssignmentInputSchema.parse(assignmentInput);

    return this.database.transaction(async (transaction) => {
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
      return mapAssignment(row);
    });
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
  ): Promise<AttemptSession> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    return this.database.transaction(async (transaction) => {
      const assignment = await transaction.query<AssignmentRow>(
        `SELECT a.id, a.organization_id, a.class_id, a.experience_version_id,
                a.starts_at, a.due_at, a.status
         FROM assignments a
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
        return {
          id: existingRow.id,
          assignmentId: existingRow.assignment_id,
          status: existingRow.status,
          resumed: true,
        };
      }
      const attemptId = randomUUID();
      await transaction.query(
        `INSERT INTO attempts
          (id, organization_id, assignment_id, class_id, student_id, status)
         VALUES ($1, $2, $3, $4, $5, 'READY')`,
        [attemptId, organizationId, assignmentId, assignmentRow.class_id, actor.userId],
      );
      return { id: attemptId, assignmentId, status: 'READY', resumed: false };
    });
  }

  async getPlayerSession(
    actorInput: Actor,
    organizationIdInput: string,
    assignmentIdInput: string,
  ): Promise<PlayerSession> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    const result = await this.database.query<
      VersionRow & { assignment_id: string; attempt_id: string }
    >(
      `SELECT v.id, v.experience_id, v.version, v.specification, v.artifact, v.manifest,
              v.content_hash, v.status, e.public_id, e.title, e.owner_id,
              a.id AS assignment_id, at.id AS attempt_id
       FROM assignments a
       JOIN attempts at
         ON at.organization_id = a.organization_id
        AND at.assignment_id = a.id
        AND at.student_id = $1
       JOIN class_members cm
         ON cm.organization_id = a.organization_id
        AND cm.class_id = a.class_id
        AND cm.user_id = at.student_id
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
       WHERE a.organization_id = $2 AND a.id = $3 AND a.status = 'ACTIVE'`,
      [actor.userId, organizationId, assignmentId],
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
  ): Promise<{ accepted: boolean; duplicate: boolean }> {
    const actor = parseActor(actorInput);
    const event = clientLearningEventSchema.parse(eventInput);
    return this.database.transaction(async (transaction) => {
      const exactJson = JSON.stringify(event);
      const context = await transaction.query<{
        assignment_id: string;
        attempt_status: AttemptStatus;
        public_id: string;
        version: number;
      }>(
        `SELECT a.id AS assignment_id, at.status AS attempt_status,
                e.public_id, v.version
         FROM attempts at
         JOIN assignments a
           ON a.organization_id = at.organization_id
          AND a.id = at.assignment_id
          AND a.status = 'ACTIVE'
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
         WHERE at.organization_id = $1 AND at.id = $2 AND at.student_id = $3`,
        [event.organizationId, event.attemptId, actor.userId],
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

      const existingById = await transaction.query<{ exact: boolean }>(
        `SELECT event_json = $3::jsonb AS exact
         FROM learning_events WHERE organization_id = $1 AND id = $2`,
        [event.organizationId, event.eventId, exactJson],
      );
      const existing = existingById.rows[0];
      if (existing !== undefined) {
        if (existing.exact) {
          return { accepted: false, duplicate: true };
        }
        throw new ConflictError();
      }

      const sequenceConflict = await transaction.query<{ id: string }>(
        'SELECT id FROM learning_events WHERE attempt_id = $1 AND sequence = $2',
        [event.attemptId, event.sequence],
      );
      if (sequenceConflict.rows[0] !== undefined) {
        throw new ConflictError();
      }
      const prior = await transaction.query<{ type: string }>(
        'SELECT type FROM learning_events WHERE attempt_id = $1 ORDER BY sequence',
        [event.attemptId],
      );
      const priorTypes = prior.rows.map(({ type }) => type);
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
      if (event.type === 'ANSWER_RETRIED' && !priorTypes.includes('QUESTION_ANSWERED')) {
        throw new InvalidStateError();
      }

      const receivedAt = this.now().toISOString();
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
          event.type,
          event.stepId,
          event.sequence,
          event.occurredAt,
          receivedAt,
          JSON.stringify(event.payload),
          exactJson,
        ],
      );
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
      return { accepted: true, duplicate: false };
    });
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
      if (event.type !== 'QUESTION_ANSWERED') {
        return false;
      }
      const payload = parseJson<Record<string, unknown>>(event.payload);
      return payload['correct'] === false;
    }).length;
    const retries = events.filter(({ type }) => type === 'ANSWER_RETRIED').length;
    const started = events.some(({ type }) => type === 'EXPERIENCE_STARTED');
    const completed = events.some(({ type }) => type === 'EXPERIENCE_COMPLETED');
    await transaction.query(
      `INSERT INTO student_progress
        (organization_id, assignment_id, student_id, started, wrong_answers, retries,
         completed, last_sequence, last_step_id, projection_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (organization_id, assignment_id, student_id)
       DO UPDATE SET
         started = EXCLUDED.started,
         wrong_answers = EXCLUDED.wrong_answers,
         retries = EXCLUDED.retries,
         completed = EXCLUDED.completed,
         last_sequence = EXCLUDED.last_sequence,
         last_step_id = EXCLUDED.last_step_id,
         projection_version = EXCLUDED.projection_version,
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
        this.now().toISOString(),
      ],
    );
  }

  async listTeacherProgress(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    assignmentIdInput: string,
  ): Promise<StudentProgress[]> {
    const actor = parseActor(actorInput);
    const organizationId = parseUuidOrNotFound(organizationIdInput);
    const classId = parseUuidOrNotFound(classIdInput);
    const assignmentId = parseUuidOrNotFound(assignmentIdInput);
    await requireTeacher(this.database, actor, organizationId);
    const assignment = await this.database.query<{ id: string }>(
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
    const progress = await this.database.query<{
      assignment_id: string;
      student_id: string;
      started: boolean;
      wrong_answers: number;
      retries: number;
      completed: boolean;
      last_sequence: number | null;
      last_step_id: string | null;
      projection_version: number;
      updated_at: string | Date;
    }>(
      `SELECT assignment_id, student_id, started, wrong_answers, retries, completed,
              last_sequence, last_step_id, projection_version, updated_at
       FROM student_progress
       WHERE organization_id = $1 AND assignment_id = $2
       ORDER BY student_id`,
      [organizationId, assignmentId],
    );
    return progress.rows.map((row) => ({
      assignmentId: row.assignment_id,
      studentId: row.student_id,
      started: row.started,
      wrongAnswers: row.wrong_answers,
      retries: row.retries,
      completed: row.completed,
      lastSequence: row.last_sequence,
      lastStepId: row.last_step_id,
      projectionVersion: row.projection_version,
      updatedAt: toIso(row.updated_at),
    }));
  }
}
