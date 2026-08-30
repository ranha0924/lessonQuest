export function estimateTokens(value: string): number {
  return value.length === 0 ? 0 : Math.ceil([...value].length / 4);
}
