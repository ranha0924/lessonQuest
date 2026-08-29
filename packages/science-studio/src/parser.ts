import { scienceBlockSpecSchema, type ScienceBlockSpec } from '@lessonquest/contracts';

export type ScienceGenerationErrorCode = 'INVALID_JSON' | 'INVALID_SPEC' | 'SPEC_TOO_LARGE';

export class ScienceGenerationError extends Error {
  constructor(readonly code: ScienceGenerationErrorCode) {
    super('Generated science specification was rejected');
    this.name = 'ScienceGenerationError';
  }
}

const maximumSpecificationBytes = 32_768;

export function parseGeneratedScienceSpec(input: string): ScienceBlockSpec {
  if (Buffer.byteLength(input, 'utf8') > maximumSpecificationBytes) {
    throw new ScienceGenerationError('SPEC_TOO_LARGE');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(input) as unknown;
  } catch {
    throw new ScienceGenerationError('INVALID_JSON');
  }

  const parsed = scienceBlockSpecSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new ScienceGenerationError('INVALID_SPEC');
  }
  return parsed.data;
}
