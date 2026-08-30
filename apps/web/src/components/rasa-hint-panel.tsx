interface Hint {
  readonly stepId: string;
  readonly level: 1 | 2 | 3;
  readonly content: string;
}
export function RasaHintPanel({
  hints,
  available,
  pending,
  exhausted,
  onRequest,
}: {
  readonly hints: readonly Hint[];
  readonly available: boolean;
  readonly pending: boolean;
  readonly exhausted: boolean;
  readonly onRequest: () => void;
}) {
  if (!available && hints.length === 0) return null;
  return (
    <section className="rasa-panel" aria-labelledby="rasa-title">
      <p className="panel-kicker">RASA</p>
      <h3 id="rasa-title">생각을 여는 힌트</h3>
      {hints.map((hint) => (
        <p key={`${hint.stepId}-${hint.level}`}>
          <strong>힌트 {hint.level}</strong> {hint.content}
        </p>
      ))}
      <button type="button" onClick={onRequest} disabled={pending || exhausted || !available}>
        {pending ? '힌트 준비 중' : exhausted ? '힌트를 모두 사용했어요' : '힌트 받기'}
      </button>
      <p role="status" aria-live="polite">
        {pending ? 'Rasa가 질문을 살펴보고 있어요.' : ''}
      </p>
    </section>
  );
}
