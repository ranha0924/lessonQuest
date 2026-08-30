import { rasaContextSchema, showHintActionSchema } from '@lessonquest/contracts';

import { RasaProviderError, type RasaHintProvider, type RasaProviderInput } from './provider.js';
import { estimateTokens } from './token-estimate.js';

const templates = {
  1: (concept: string) => `${concept}에서 무엇이 계속 유지되는지 먼저 찾아보자.`,
  2: (concept: string, simulation?: string) =>
    `${simulation ?? concept} 전과 후의 운동 상태를 각각 비교해 보자.`,
  3: (concept: string) => `${concept}의 원인, 변한 것, 유지된 것을 차례로 설명해 보자.`,
} as const;

export class LocalRasaProvider implements RasaHintProvider {
  constructor(private readonly latency: () => number = () => 0) {}

  generateHint(input: RasaProviderInput, signal: AbortSignal) {
    if (signal.aborted)
      return Promise.reject(
        new RasaProviderError('RASA_PROVIDER_ABORTED', 'Local hint request aborted'),
      );
    const context = rasaContextSchema.parse(input.context);
    const content = templates[input.hintLevel](
      input.conceptSummary.trim(),
      input.simulationSummary?.trim(),
    );
    const action = showHintActionSchema.parse({
      action: 'SHOW_HINT',
      experienceId: context.learning.experienceId,
      stepId: context.learning.stepId,
      level: input.hintLevel,
      content,
    });
    const safeInput = JSON.stringify({
      context,
      hintLevel: input.hintLevel,
      conceptSummary: input.conceptSummary,
      simulationSummary: input.simulationSummary,
    });
    return Promise.resolve({
      action,
      usage: {
        provider: 'local' as const,
        model: 'local-rasa-v1' as const,
        inputTokens: estimateTokens(safeInput),
        outputTokens: estimateTokens(content),
        costMicros: 0 as const,
        latencyMs: Math.max(0, Math.trunc(this.latency())),
      },
    });
  }
}
