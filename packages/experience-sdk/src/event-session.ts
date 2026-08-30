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
  acknowledge(eventId: string, nextSequence: number): void;
  synchronize(nextSequence: number): void;
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
  let pending: { signature: string; event: ClientLearningEvent } | undefined;

  const build = (
    type: ClientLearningEvent['type'],
    stepId: string,
    payload: Record<string, unknown>,
  ): ClientLearningEvent => {
    const signature = JSON.stringify([type, stepId, payload]);
    if (pending !== undefined) {
      if (pending.signature === signature) return pending.event;
      throw new Error('A different learning event is pending acknowledgement');
    }
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
    const frozen = Object.freeze(event);
    pending = { signature, event: frozen };
    return frozen;
  };

  const nextSequenceSchema = z.int().min(0).max(1_000_000);

  return Object.freeze({
    started: (stepId: string) => build('EXPERIENCE_STARTED', stepId, {}),
    answered: (stepId: string, optionId: string, attempt: number, elapsedMs: number) =>
      build('QUESTION_ANSWERED', stepId, { optionId, attempt, elapsedMs }),
    retried: (stepId: string, optionId: string, attempt: number, elapsedMs: number) =>
      build('ANSWER_RETRIED', stepId, { optionId, attempt, elapsedMs }),
    completed: (stepId: string, elapsedMs: number) =>
      build('EXPERIENCE_COMPLETED', stepId, { elapsedMs }),
    acknowledge: (eventId: string, nextSequence: number) => {
      const parsedEventId = uuidSchema.parse(eventId);
      const parsedNextSequence = nextSequenceSchema.parse(nextSequence);
      if (pending === undefined || pending.event.eventId !== parsedEventId) {
        throw new Error('No matching learning event is pending acknowledgement');
      }
      if (parsedNextSequence <= sequence) {
        throw new Error('Acknowledged sequence must move forward');
      }
      sequence = parsedNextSequence;
      pending = undefined;
    },
    synchronize: (nextSequence: number) => {
      const parsedNextSequence = nextSequenceSchema.parse(nextSequence);
      if (pending !== undefined) throw new Error('Cannot synchronize while an event is pending');
      if (parsedNextSequence < sequence) throw new Error('Cannot synchronize sequence backward');
      sequence = parsedNextSequence;
    },
  });
}
