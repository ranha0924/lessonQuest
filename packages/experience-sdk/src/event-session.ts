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
  answered(
    stepId: string,
    optionId: string,
    attempt: number,
    elapsedMs: number,
  ): ClientLearningEvent;
  retried(
    stepId: string,
    optionId: string,
    attempt: number,
    elapsedMs: number,
  ): ClientLearningEvent;
  completed(stepId: string, elapsedMs: number): ClientLearningEvent;
}

export interface ExperienceEventSessionOptions {
  readonly createId?: () => string;
  readonly initialSequence?: number;
  readonly now?: () => Date;
}

export function createExperienceEventSession(
  contextInput: ExperienceEventContext,
  options: ExperienceEventSessionOptions = {},
): ExperienceEventSession {
  const context = eventContextSchema.parse(contextInput);
  const createId = options.createId ?? (() => globalThis.crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  let sequence = z
    .int()
    .min(0)
    .max(1_000_000)
    .parse(options.initialSequence ?? 0);

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
    answered: (stepId: string, optionId: string, attempt: number, elapsedMs: number) =>
      build('QUESTION_ANSWERED', stepId, { optionId, attempt, elapsedMs }),
    retried: (stepId: string, optionId: string, attempt: number, elapsedMs: number) =>
      build('ANSWER_RETRIED', stepId, { optionId, attempt, elapsedMs }),
    completed: (stepId: string, elapsedMs: number) =>
      build('EXPERIENCE_COMPLETED', stepId, { elapsedMs }),
  });
}
