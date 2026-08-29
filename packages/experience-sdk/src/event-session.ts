import {
  clientLearningEventSchema,
  experienceIdSchema,
  uuidSchema,
  type ClientLearningEvent,
} from '@lessonquest/contracts';
import { z } from 'zod';

const eventContextSchema = z.strictObject({
  organizationId: uuidSchema,
  assignmentId: uuidSchema,
  attemptId: uuidSchema,
  experienceId: experienceIdSchema,
  experienceVersion: z.int().positive().max(1_000_000),
});

export type ExperienceEventContext = z.infer<typeof eventContextSchema>;

export interface ExperienceEventSession {
  started(stepId: string): ClientLearningEvent;
  wrongAnswer(stepId: string, attempt: number, elapsedMs: number): ClientLearningEvent;
  retriedAnswer(stepId: string, attempt: number, elapsedMs: number): ClientLearningEvent;
  completed(stepId: string, elapsedMs: number): ClientLearningEvent;
}

export interface ExperienceEventSessionOptions {
  readonly createId?: () => string;
  readonly now?: () => Date;
}

export function createExperienceEventSession(
  contextInput: ExperienceEventContext,
  options: ExperienceEventSessionOptions = {},
): ExperienceEventSession {
  const context = eventContextSchema.parse(contextInput);
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  let sequence = 0;

  const build = (
    type: ClientLearningEvent['type'],
    stepId: string,
    payload: Record<string, unknown>,
  ): ClientLearningEvent => {
    const event = clientLearningEventSchema.parse({
      schemaVersion: 1,
      eventId: createId(),
      type,
      ...context,
      stepId,
      sequence,
      occurredAt: now().toISOString(),
      payload,
    });
    sequence += 1;
    return event;
  };

  return Object.freeze({
    started: (stepId: string) => build('EXPERIENCE_STARTED', stepId, {}),
    wrongAnswer: (stepId: string, attempt: number, elapsedMs: number) =>
      build('QUESTION_ANSWERED', stepId, { correct: false, attempt, elapsedMs }),
    retriedAnswer: (stepId: string, attempt: number, elapsedMs: number) =>
      build('ANSWER_RETRIED', stepId, { correct: true, attempt, elapsedMs }),
    completed: (stepId: string, elapsedMs: number) =>
      build('EXPERIENCE_COMPLETED', stepId, { elapsedMs }),
  });
}
