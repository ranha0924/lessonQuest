import type { OfflineEventQueueState } from '@lessonquest/experience-sdk';

export function OfflineEventStatus({
  state,
  message,
  onRetry,
  onClear,
}: {
  readonly state: OfflineEventQueueState;
  readonly message: string;
  readonly onRetry: () => void;
  readonly onClear: () => void;
}) {
  if (state.pendingCount === 0 && message === '') return null;
  return (
    <section className="offline-event-status" aria-label="오프라인 학습 기록">
      <p role="status" aria-live="polite">
        {message !== ''
          ? message
          : `오프라인 대기 기록 ${state.pendingCount}건 · 연결되면 자동 전송합니다.`}
      </p>
      {state.pendingCount > 0 ? (
        <div className="offline-event-actions">
          <button type="button" disabled={state.sending} onClick={onRetry}>
            {state.sending ? '대기 기록 전송 중' : '대기 기록 지금 보내기'}
          </button>
          <button type="button" disabled={state.sending} onClick={onClear}>
            이 기기의 대기 기록 지우기
          </button>
        </div>
      ) : null}
    </section>
  );
}
