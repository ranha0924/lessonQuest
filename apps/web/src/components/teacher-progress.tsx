import type { StudentProgress } from '@lessonquest/contracts';

interface TeacherProgressProps {
  readonly items: readonly StudentProgress[];
}

export function TeacherProgress({ items }: TeacherProgressProps) {
  return (
    <section className="progress-ledger" aria-labelledby="progress-title">
      <header>
        <p className="eyebrow">TEACHER EVIDENCE</p>
        <h2 id="progress-title">학습 과정 기록</h2>
      </header>
      <div className="progress-list">
        {items.map((item) => (
          <article
            className="progress-row"
            key={item.studentId}
            aria-label={`학생 ${item.studentId.slice(-4)}`}
          >
            <strong>학생 ••{item.studentId.slice(-4)}</strong>
            <span>{item.started ? '시작함' : '시작 전'}</span>
            <span>오답 {item.wrongAnswers}회</span>
            <span>재도전 {item.retries}회</span>
            <span className={item.completed ? 'status-complete' : 'status-active'}>
              {item.completed ? '완료' : '진행 중'}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
