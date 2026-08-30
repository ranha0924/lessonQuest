import {
  rasaContextSchema,
  showHintActionSchema,
  type RasaContext,
  type ShowHintAction,
} from '@lessonquest/contracts';

import { RasaProviderError } from './provider.js';

const normalize = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
const normalizeSemantic = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
const normalizeStructural = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s\p{Cf}\p{M}]+/gu, '');
const isAllowedPhaseOneText = (value: string) =>
  [...value.normalize('NFKC')].every((character) => {
    const codePoint = character.codePointAt(0) ?? -1;
    return (
      character === '\t' ||
      character === '\n' ||
      character === '\r' ||
      (codePoint >= 0x20 && codePoint <= 0x7e) ||
      (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
      (codePoint >= 0x3130 && codePoint <= 0x318f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7af)
    );
  });

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
  const semanticContent = normalizeSemantic(action.content);
  const structuralContent = normalizeStructural(action.content);
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
    /(?:choose|select|pick)(?:option|choice)/iu,
    /(?:option|choice).*correct/iu,
    /correct(?:option|choice)/iu,
    /mark.*answer/iu,
    /(?:번|번째).*(?:고르|선택|맞)/u,
    /(?:가|이)?맞(?:아요|습니다)/u,
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
    !isAllowedPhaseOneText(action.content) ||
    forbidden.some(
      (pattern) =>
        pattern.test(content) || pattern.test(semanticContent) || pattern.test(structuralContent),
    ) ||
    semanticContent.includes(normalizeSemantic(input.correctOptionId)) ||
    semanticContent.includes(normalizeSemantic(input.correctOptionLabel))
  ) {
    throw new RasaProviderError('RASA_OUTPUT_REJECTED', 'Hint content rejected');
  }
  return action;
}
