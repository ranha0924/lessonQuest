import { createHash, randomUUID } from 'node:crypto';

import type { PGliteInterface } from '@electric-sql/pglite';
import {
  actorSchema,
  rasaHintRequestSchema,
  rasaHintResultSchema,
  serverLearningEventSchema,
  uuidSchema,
  type Actor,
  type RasaContext,
  type RasaHintRequest,
  type RasaHintResult,
} from '@lessonquest/contracts';
import { validateHintOutput, type RasaHintProvider } from '@lessonquest/rasa';
import { parseScienceArtifact } from '@lessonquest/science-studio';

import { ConflictError, ResourceNotFoundError } from './tenant-repository.js';

export interface RequestRasaHintOptions {
  provider: RasaHintProvider;
  timeoutMs?: number;
  now?: () => Date;
  createId?: () => string;
}

export class RasaRequestError extends Error {
  constructor(
    readonly code: 'RASA_OUTPUT_REJECTED' | 'RASA_PROVIDER_FAILED' | 'RASA_PROVIDER_TIMEOUT',
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = 'RasaRequestError';
  }
}

const json = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;

export class RasaRepository {
  constructor(private readonly database: PGliteInterface) {}

  async requestHint(
    actorInput: Actor,
    organizationIdInput: string,
    classIdInput: string,
    inputValue: RasaHintRequest,
    traceIdInput: string,
    options: RequestRasaHintOptions,
  ): Promise<RasaHintResult> {
    const actor = actorSchema.parse(actorInput);
    const organizationId = uuidSchema.parse(organizationIdInput);
    const classId = uuidSchema.parse(classIdInput);
    const input = rasaHintRequestSchema.parse(inputValue);
    const traceId = uuidSchema.parse(traceIdInput);
    const now = options.now ?? (() => new Date());
    const createId = options.createId ?? randomUUID;

    const prepared = await this.database.transaction(async (tx) => {
      const currentlyAuthorized = await tx.query(
        `SELECT 1 FROM attempts at
         JOIN assignments a ON a.organization_id=at.organization_id AND a.id=at.assignment_id AND a.class_id=$3 AND a.status='ACTIVE' AND a.starts_at <= $5 AND (a.due_at IS NULL OR a.due_at >= $5)
         JOIN organizations o ON o.id=at.organization_id AND o.status='ACTIVE'
         JOIN classes c ON c.organization_id=at.organization_id AND c.id=at.class_id AND c.status='ACTIVE'
         JOIN class_members cm ON cm.organization_id=at.organization_id AND cm.class_id=at.class_id AND cm.user_id=$4 AND cm.status='ACTIVE'
         JOIN organization_members om ON om.organization_id=at.organization_id AND om.user_id=$4 AND om.role='STUDENT' AND om.status='ACTIVE'
         JOIN users u ON u.id=$4 AND u.platform_role='STUDENT' AND u.status='ACTIVE'
         JOIN assignment_rasa_policies p ON p.organization_id=a.organization_id AND p.assignment_id=a.id AND p.enabled=true
         JOIN experience_versions v ON v.organization_id=a.organization_id AND v.id=a.experience_version_id AND v.status='PUBLISHED'
         WHERE at.organization_id=$1 AND at.id=$2 AND at.student_id=$4 AND at.status='IN_PROGRESS'`,
        [organizationId, input.attemptId, classId, actor.userId, now().toISOString()],
      );
      if (currentlyAuthorized.rows[0] === undefined) throw new ResourceNotFoundError();
      await tx.query(
        `INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome) VALUES($1,$2,$3,$4,'RASA_HINT_REQUESTED','RASA_REQUEST',$5,'SUCCEEDED')`,
        [randomUUID(), traceId, actor.userId, organizationId, input.requestId],
      );
      const existing = await tx.query<{
        status: string;
        action: unknown;
        session_id: string;
        attempt_id: string;
        step_id: string;
      }>(
        `SELECT rr.status, ra.action, rr.session_id, rs.attempt_id, rr.step_id
         FROM rasa_requests rr JOIN rasa_sessions rs ON rs.organization_id = rr.organization_id AND rs.id = rr.session_id
         LEFT JOIN rasa_actions ra ON ra.organization_id = rr.organization_id AND ra.request_id = rr.id AND ra.status = 'ACCEPTED'
         WHERE rr.organization_id = $1 AND rr.id = $2`,
        [organizationId, input.requestId],
      );
      const prior = existing.rows[0];
      if (prior !== undefined) {
        if (prior.attempt_id !== input.attemptId || prior.step_id !== input.stepId)
          throw new ConflictError();
        if (prior.status === 'SUCCEEDED' && prior.action !== null) {
          await tx.query(
            `INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome) VALUES($1,$2,$3,$4,'RASA_HINT_DELIVERED','RASA_REQUEST',$5,'DUPLICATE')`,
            [randomUUID(), traceId, actor.userId, organizationId, input.requestId],
          );
          const next = await tx.query<{ value: number }>(
            'SELECT COALESCE(MAX(sequence)+1,0)::int value FROM learning_events WHERE attempt_id=$1',
            [input.attemptId],
          );
          return {
            duplicate: rasaHintResultSchema.parse({
              requestId: input.requestId,
              sessionId: prior.session_id,
              duplicate: true,
              action: json(prior.action),
              nextSequence: next.rows[0]?.value ?? 0,
            }),
          };
        }
        if (prior.status === 'TIMED_OUT') throw new RasaRequestError('RASA_PROVIDER_TIMEOUT', true);
        if (prior.status === 'FAILED') throw new RasaRequestError('RASA_PROVIDER_FAILED', true);
        if (prior.status === 'REJECTED') throw new RasaRequestError('RASA_OUTPUT_REJECTED', false);
        throw new ConflictError();
      }

      const eligible = await tx.query<{
        assignment_id: string;
        student_id: string;
        status: string;
        artifact: unknown;
        public_id: string;
        version: number;
        max_hint_level: 1 | 2 | 3;
        policy_version: number;
      }>(
        `SELECT at.assignment_id, at.student_id, at.status, v.artifact, e.public_id, v.version, p.max_hint_level, p.policy_version
         FROM attempts at
         JOIN assignments a ON a.organization_id=at.organization_id AND a.id=at.assignment_id AND a.class_id=$3 AND a.status='ACTIVE' AND a.starts_at <= $5 AND (a.due_at IS NULL OR a.due_at >= $5)
         JOIN organizations o ON o.id=at.organization_id AND o.status='ACTIVE'
         JOIN classes c ON c.organization_id=at.organization_id AND c.id=at.class_id AND c.status='ACTIVE'
         JOIN class_members cm ON cm.organization_id=at.organization_id AND cm.class_id=at.class_id AND cm.user_id=$4 AND cm.status='ACTIVE'
         JOIN organization_members om ON om.organization_id=at.organization_id AND om.user_id=$4 AND om.role='STUDENT' AND om.status='ACTIVE'
         JOIN users u ON u.id=$4 AND u.platform_role='STUDENT' AND u.status='ACTIVE'
         JOIN assignment_rasa_policies p ON p.organization_id=a.organization_id AND p.assignment_id=a.id AND p.enabled=true
         JOIN experience_versions v ON v.organization_id=a.organization_id AND v.id=a.experience_version_id AND v.status='PUBLISHED'
         JOIN experiences e ON e.organization_id=v.organization_id AND e.id=v.experience_id
         WHERE at.organization_id=$1 AND at.id=$2 AND at.student_id=$4 AND at.status='IN_PROGRESS' FOR UPDATE`,
        [organizationId, input.attemptId, classId, actor.userId, now().toISOString()],
      );
      const row = eligible.rows[0];
      if (row === undefined) throw new ResourceNotFoundError();
      const artifact = parseScienceArtifact(json(row.artifact));
      const quiz = artifact.specification.blocks.find(
        (block) => block.kind === 'QUIZ' && block.id === input.stepId,
      );
      if (quiz?.kind !== 'QUIZ') throw new ResourceNotFoundError();
      const history = await tx.query<{ type: string; payload: unknown }>(
        `SELECT type,payload FROM learning_events WHERE attempt_id=$1 AND step_id=$2 ORDER BY sequence`,
        [input.attemptId, input.stepId],
      );
      const answers = history.rows
        .filter(({ type }) => type === 'QUESTION_ANSWERED' || type === 'ANSWER_RETRIED')
        .map(({ payload }) => json<{ correct: boolean }>(payload));
      if (answers.length === 0 || answers.at(-1)?.correct !== false) throw new ConflictError();
      const used = await tx.query<{ level: number }>(
        `SELECT rr.hint_level AS level FROM rasa_sessions rs JOIN rasa_requests rr ON rr.organization_id=rs.organization_id AND rr.session_id=rs.id AND rr.status='SUCCEEDED' WHERE rs.attempt_id=$1 AND rr.step_id=$2 ORDER BY rr.hint_level`,
        [input.attemptId, input.stepId],
      );
      const level = (used.rows.length + 1) as 1 | 2 | 3;
      if (level > row.max_hint_level) throw new ConflictError();
      const session = await tx.query<{ id: string }>(
        'SELECT id FROM rasa_sessions WHERE organization_id=$1 AND attempt_id=$2',
        [organizationId, input.attemptId],
      );
      let sessionId = session.rows[0]?.id;
      if (sessionId === undefined) {
        sessionId = uuidSchema.parse(createId());
        await tx.query(
          `INSERT INTO rasa_sessions(id,organization_id,assignment_id,attempt_id,student_id,policy_version,status) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE')`,
          [
            sessionId,
            organizationId,
            row.assignment_id,
            input.attemptId,
            actor.userId,
            row.policy_version,
          ],
        );
      }
      const concept = artifact.specification.blocks.find((block) => block.kind === 'CONCEPT_CARD');
      const simulation = artifact.specification.blocks.find((block) => block.kind === 'SIMULATION');
      const context: RasaContext = {
        schemaVersion: 1,
        organizationId,
        assignmentId: row.assignment_id,
        sessionId,
        student: { id: actor.userId, gradeBand: artifact.specification.gradeBand },
        learning: {
          subject: 'science',
          unit: artifact.specification.unit,
          experienceId: row.public_id,
          experienceVersion: row.version,
          sceneId: simulation?.id ?? input.stepId,
          stepId: input.stepId,
          questionSummary: quiz.question,
          recentResponses: answers.slice(-20).map(({ correct }) => ({ correct })),
          usedHintLevels: used.rows.map(({ level: item }) => item) as (1 | 2 | 3)[],
        },
        teacherPolicy: {
          learningObjectives: artifact.specification.learningObjectives.map(({ text }) => text),
          maxHintLevel: row.max_hint_level,
          forbidFinalAnswer: true,
        },
      };
      const contextHash = `sha256:${createHash('sha256').update(JSON.stringify(context)).digest('hex')}`;
      await tx.query(
        `INSERT INTO rasa_requests(id,organization_id,session_id,step_id,hint_level,context_hash,status,trace_id) VALUES($1,$2,$3,$4,$5,$6,'RUNNING',$7)`,
        [input.requestId, organizationId, sessionId, input.stepId, level, contextHash, traceId],
      );
      return {
        row,
        artifact,
        quiz,
        context,
        level,
        sessionId,
        conceptSummary:
          concept?.kind === 'CONCEPT_CARD' ? concept.body : artifact.specification.title,
        simulationSummary: simulation?.kind === 'SIMULATION' ? simulation.prompt : undefined,
      };
    });
    if ('duplicate' in prepared) return prepared.duplicate;

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 2000;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let providerResult;
    try {
      providerResult = await Promise.race([
        options.provider.generateHint(
          {
            context: prepared.context,
            hintLevel: prepared.level,
            conceptSummary: prepared.conceptSummary,
            ...(prepared.simulationSummary === undefined
              ? {}
              : { simulationSummary: prepared.simulationSummary }),
          },
          controller.signal,
        ),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error('RASA_PROVIDER_TIMEOUT'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (timeout !== undefined) clearTimeout(timeout);
      const timedOut = controller.signal.aborted;
      await this.failRequest(
        organizationId,
        input.requestId,
        actor.userId,
        traceId,
        timedOut ? 'TIMED_OUT' : 'FAILED',
        timedOut ? 'RASA_PROVIDER_TIMEOUT' : 'RASA_PROVIDER_FAILED',
      );
      throw new RasaRequestError(
        timedOut ? 'RASA_PROVIDER_TIMEOUT' : 'RASA_PROVIDER_FAILED',
        true,
        { cause: error },
      );
    }
    if (timeout !== undefined) clearTimeout(timeout);
    let action;
    try {
      const correct = prepared.quiz.options.find(({ correct }) => correct)!;
      action = validateHintOutput({
        rawAction: providerResult.action,
        context: prepared.context,
        expectedLevel: prepared.level,
        correctOptionId: correct.id,
        correctOptionLabel: correct.label,
      });
    } catch {
      await this.failRequest(
        organizationId,
        input.requestId,
        actor.userId,
        traceId,
        'REJECTED',
        'RASA_OUTPUT_REJECTED',
      );
      throw new RasaRequestError('RASA_OUTPUT_REJECTED', false);
    }

    try {
      return await this.database.transaction(async (tx) => {
        const locked = await tx.query<{ status: string }>(
          `SELECT at.status FROM attempts at
         JOIN assignments a ON a.organization_id=at.organization_id AND a.id=at.assignment_id AND a.class_id=$4 AND a.status='ACTIVE' AND a.starts_at <= $5 AND (a.due_at IS NULL OR a.due_at >= $5)
         JOIN organizations o ON o.id=at.organization_id AND o.status='ACTIVE'
         JOIN classes c ON c.organization_id=at.organization_id AND c.id=at.class_id AND c.status='ACTIVE'
         JOIN class_members cm ON cm.organization_id=at.organization_id AND cm.class_id=at.class_id AND cm.user_id=$3 AND cm.status='ACTIVE'
         JOIN organization_members om ON om.organization_id=at.organization_id AND om.user_id=$3 AND om.role='STUDENT' AND om.status='ACTIVE'
         JOIN users u ON u.id=$3 AND u.platform_role='STUDENT' AND u.status='ACTIVE'
         JOIN assignment_rasa_policies p ON p.organization_id=a.organization_id AND p.assignment_id=a.id AND p.enabled=true
         JOIN experience_versions v ON v.organization_id=a.organization_id AND v.id=a.experience_version_id AND v.status='PUBLISHED'
         WHERE at.organization_id=$1 AND at.id=$2 AND at.student_id=$3 AND at.status='IN_PROGRESS' FOR UPDATE`,
          [organizationId, input.attemptId, actor.userId, classId, now().toISOString()],
        );
        if (locked.rows[0] === undefined) throw new ResourceNotFoundError();
        const next = await tx.query<{ value: number }>(
          'SELECT COALESCE(MAX(sequence)+1,0)::int value FROM learning_events WHERE attempt_id=$1',
          [input.attemptId],
        );
        let sequence = next.rows[0]?.value ?? 0;
        const opened = await tx.query<{ count: number }>(
          "SELECT COUNT(*)::int count FROM learning_events WHERE attempt_id=$1 AND type='RASA_OPENED'",
          [input.attemptId],
        );
        const events = [] as Array<{
          id: string;
          type: 'RASA_OPENED' | 'HINT_USED';
          sequence: number;
          payload: Record<string, unknown>;
        }>;
        if ((opened.rows[0]?.count ?? 0) === 0)
          events.push({
            id: uuidSchema.parse(createId()),
            type: 'RASA_OPENED',
            sequence: sequence++,
            payload: {},
          });
        events.push({
          id: uuidSchema.parse(createId()),
          type: 'HINT_USED',
          sequence: sequence++,
          payload: { level: prepared.level },
        });
        for (const event of events) {
          const envelope = serverLearningEventSchema.parse({
            schemaVersion: 1,
            eventId: event.id,
            type: event.type,
            organizationId,
            assignmentId: prepared.row.assignment_id,
            attemptId: input.attemptId,
            experienceId: prepared.context.learning.experienceId,
            experienceVersion: prepared.context.learning.experienceVersion,
            stepId: input.stepId,
            sequence: event.sequence,
            occurredAt: now().toISOString(),
            payload: event.payload,
          });
          await tx.query(
            `INSERT INTO learning_events(id,organization_id,actor_id,assignment_id,attempt_id,type,step_id,sequence,occurred_at,received_at,payload,event_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10::jsonb,$11::jsonb)`,
            [
              event.id,
              organizationId,
              actor.userId,
              prepared.row.assignment_id,
              input.attemptId,
              event.type,
              input.stepId,
              event.sequence,
              now().toISOString(),
              JSON.stringify(event.payload),
              JSON.stringify(envelope),
            ],
          );
        }
        await tx.query(
          `INSERT INTO rasa_actions(id,organization_id,request_id,action,status) VALUES($1,$2,$3,$4::jsonb,'ACCEPTED')`,
          [uuidSchema.parse(createId()), organizationId, input.requestId, JSON.stringify(action)],
        );
        await tx.query(
          `INSERT INTO ai_usage(id,organization_id,rasa_request_id,provider,model,input_tokens,output_tokens,cost_micros,latency_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            uuidSchema.parse(createId()),
            organizationId,
            input.requestId,
            providerResult.usage.provider,
            providerResult.usage.model,
            providerResult.usage.inputTokens,
            providerResult.usage.outputTokens,
            providerResult.usage.costMicros,
            providerResult.usage.latencyMs,
          ],
        );
        await tx.query(
          `UPDATE rasa_requests SET status='SUCCEEDED',provider=$1,model=$2,finished_at=$3 WHERE organization_id=$4 AND id=$5 AND status='RUNNING'`,
          [
            providerResult.usage.provider,
            providerResult.usage.model,
            now().toISOString(),
            organizationId,
            input.requestId,
          ],
        );
        await tx.query(
          `UPDATE student_progress SET hints_used=hints_used+1,last_sequence=$1,last_step_id=$2,projection_version=projection_version+$3,updated_at=$4 WHERE organization_id=$5 AND assignment_id=$6 AND student_id=$7`,
          [
            sequence - 1,
            input.stepId,
            events.length,
            now().toISOString(),
            organizationId,
            prepared.row.assignment_id,
            actor.userId,
          ],
        );
        await tx.query(
          `INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome) VALUES($1,$2,$3,$4,'RASA_HINT_DELIVERED','RASA_REQUEST',$5,'SUCCEEDED')`,
          [randomUUID(), traceId, actor.userId, organizationId, input.requestId],
        );
        return rasaHintResultSchema.parse({
          requestId: input.requestId,
          sessionId: prepared.sessionId,
          duplicate: false,
          action,
          nextSequence: sequence,
        });
      });
    } catch (error) {
      await this.failRequest(
        organizationId,
        input.requestId,
        actor.userId,
        traceId,
        'FAILED',
        'RASA_AUTHORIZATION_REVOKED',
      );
      throw error;
    }
  }

  private async failRequest(
    organizationId: string,
    requestId: string,
    actorId: string,
    traceId: string,
    status: 'REJECTED' | 'FAILED' | 'TIMED_OUT',
    code: string,
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.query(
        "UPDATE rasa_requests SET status=$1,error_code=$2,finished_at=CURRENT_TIMESTAMP WHERE organization_id=$3 AND id=$4 AND status='RUNNING'",
        [status, code, organizationId, requestId],
      );
      await tx.query(
        `INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome) VALUES($1,$2,$3,$4,'RASA_HINT_REJECTED','RASA_REQUEST',$5,'CONFLICT')`,
        [randomUUID(), traceId, actorId, organizationId, requestId],
      );
    });
  }
}
