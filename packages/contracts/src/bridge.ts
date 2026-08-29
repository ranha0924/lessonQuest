import { z } from 'zod';

import { clientLearningEventSchema } from './events.js';
import { capabilitySchema } from './manifest.js';
import { boundedIdentifierSchema, experienceIdSchema, uuidSchema } from './primitives.js';
import { rasaActionSchema } from './rasa.js';

const nonceSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const bridgeBaseShape = {
  channel: z.literal('lessonquest'),
  schemaVersion: z.literal(1),
  sessionId: uuidSchema,
  nonce: nonceSchema,
};

export const bridgeMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('PLATFORM_INIT'),
    payload: z.strictObject({
      experienceId: experienceIdSchema,
      experienceVersion: z.int().positive().max(1_000_000),
      assignmentId: uuidSchema,
      capabilities: z.array(capabilitySchema).max(3),
    }),
  }),
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('RUNNER_READY'),
    payload: z.strictObject({
      experienceId: experienceIdSchema,
      experienceVersion: z.int().positive().max(1_000_000),
    }),
  }),
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('RUNNER_STATUS'),
    payload: z.strictObject({
      stepId: boundedIdentifierSchema,
      status: z.enum(['active', 'paused', 'completed']),
    }),
  }),
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('RUNNER_ERROR'),
    payload: z.strictObject({
      code: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[A-Z][A-Z0-9_]*$/),
      recoverable: z.boolean(),
    }),
  }),
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('LEARNING_EVENT'),
    payload: clientLearningEventSchema,
  }),
  z.strictObject({
    ...bridgeBaseShape,
    type: z.literal('RASA_ACTION'),
    payload: rasaActionSchema,
  }),
]);

export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;

export interface BridgeTrust {
  actualOrigin: string;
  expectedOrigin: string;
  expectedNonce: string;
  sourceMatches: boolean;
}

export type BridgeMessageErrorCode =
  'SOURCE_MISMATCH' | 'ORIGIN_MISMATCH' | 'NONCE_MISMATCH' | 'INVALID_MESSAGE';

export class BridgeMessageError extends Error {
  readonly code: BridgeMessageErrorCode;

  constructor(code: BridgeMessageErrorCode) {
    super('Bridge message rejected');
    this.name = 'BridgeMessageError';
    this.code = code;
  }
}

export function parseBridgeMessage(input: unknown, trust: BridgeTrust): BridgeMessage {
  if (!trust.sourceMatches) {
    throw new BridgeMessageError('SOURCE_MISMATCH');
  }

  if (trust.actualOrigin !== trust.expectedOrigin) {
    throw new BridgeMessageError('ORIGIN_MISMATCH');
  }

  const parsed = bridgeMessageSchema.safeParse(input);
  if (!parsed.success) {
    throw new BridgeMessageError('INVALID_MESSAGE');
  }

  if (parsed.data.nonce !== trust.expectedNonce) {
    throw new BridgeMessageError('NONCE_MISMATCH');
  }

  return parsed.data;
}
