import { createHash } from 'node:crypto';

import {
  contentHashSchema,
  scienceBlockSpecSchema,
  type ScienceBlockSpec,
} from '@lessonquest/contracts';
import { z } from 'zod';

export const scienceArtifactSchema = z.strictObject({
  rendererVersion: z.literal('science-blocks-1'),
  schemaVersion: z.literal(1),
  specification: scienceBlockSpecSchema,
});

export type ScienceArtifact = z.infer<typeof scienceArtifactSchema>;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON cannot encode a non-finite number');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Canonical JSON received an unsupported value');
}

export function buildScienceArtifact(specificationInput: ScienceBlockSpec): ScienceArtifact {
  const specification = scienceBlockSpecSchema.parse(specificationInput);
  return Object.freeze({
    rendererVersion: 'science-blocks-1',
    schemaVersion: 1,
    specification,
  });
}

export function parseScienceArtifact(input: unknown): ScienceArtifact {
  return scienceArtifactSchema.parse(input);
}

export function serializeScienceArtifact(artifact: ScienceArtifact): string {
  return canonicalJson(artifact);
}

export function hashScienceArtifact(artifact: ScienceArtifact): string {
  return `sha256:${createHash('sha256').update(serializeScienceArtifact(artifact), 'utf8').digest('hex')}`;
}

export function verifyScienceArtifactHash(
  artifact: ScienceArtifact,
  expectedHashInput: string,
): boolean {
  const parsed = contentHashSchema.safeParse(expectedHashInput);
  return parsed.success && hashScienceArtifact(artifact) === parsed.data;
}
