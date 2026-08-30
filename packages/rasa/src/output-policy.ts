import {
  rasaContextSchema,
  showHintActionSchema,
  type RasaContext,
  type ShowHintAction,
} from '@lessonquest/contracts';

import { RasaProviderError } from './provider.js';

const normalize = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');

export function validateHintOutput(input: {
  rawAction: unknown;
  context: RasaContext;
  expectedLevel: 1 | 2 | 3;
  correctOptionId: string;
  correctOptionLabel: string;
}): ShowHintAction {
  const context = rasaContextSchema.parse(input.context);
  const parsed = showHintActionSchema.safeParse(input.rawAction);
  if (!parsed.success)
    throw new RasaProviderError('RASA_OUTPUT_REJECTED', 'Hint action schema rejected');
  const action = parsed.data;
  const content = normalize(action.content);
  const forbidden = [
    /https?:\/\//iu,
    /<\/?[a-z][^>]*>/iu,
    /(?:정답|답)은?(?:바로)?/u,
    /(?:correctanswer|theansweris)/iu,
    /(?:[1-9]|첫|두|세|네|다섯)(?:번|번째)(?:선택지|보기)?(?:을|를|가|이)?(?:고르|선택|맞)/u,
    /(?:choose|select|pick)(?:option|choice)?[a-z0-9]/iu,
    /[a-z0-9](?:번)?(?:을|를)?(?:선택|고르)/iu,
    /[a-z0-9](?:가|이)?맞/u,
    /(?:option|choice)[a-z0-9](?:is)?correct/iu,
    /correct(?:option|choice)(?:is)?[a-z0-9]/iu,
    /적절한것은[a-z0-9](?:입니다)?/u,
    /mark[a-z0-9]asyouranswer/iu,
    /(?:코드|명령).*(?:실행|run)/iu,
  ];
  if (
    action.experienceId !== context.learning.experienceId ||
    action.stepId !== context.learning.stepId ||
    action.level !== input.expectedLevel
  ) {
    throw new RasaProviderError('RASA_OUTPUT_REJECTED', 'Hint target or level rejected');
  }
  if (
    forbidden.some((pattern) => pattern.test(content)) ||
    content.includes(normalize(input.correctOptionId)) ||
    content.includes(normalize(input.correctOptionLabel))
  ) {
    throw new RasaProviderError('RASA_OUTPUT_REJECTED', 'Hint content rejected');
  }
  return action;
}
