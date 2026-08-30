import type { RasaContext } from '@lessonquest/contracts';

export interface RasaProviderInput {
  readonly context: RasaContext;
  readonly hintLevel: 1 | 2 | 3;
  readonly conceptSummary: string;
  readonly simulationSummary?: string;
}

export interface RasaProviderResult {
  readonly action: unknown;
  readonly usage: {
    readonly provider: 'local';
    readonly model: 'local-rasa-v1';
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costMicros: 0;
    readonly latencyMs: number;
  };
}

export interface RasaHintProvider {
  generateHint(input: RasaProviderInput, signal: AbortSignal): Promise<RasaProviderResult>;
}

export class RasaProviderError extends Error {
  constructor(
    readonly code: 'RASA_PROVIDER_ABORTED' | 'RASA_OUTPUT_REJECTED',
    message: string,
  ) {
    super(message);
    this.name = 'RasaProviderError';
  }
}
