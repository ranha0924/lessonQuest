import type { ReactNode } from 'react';

export function CosmicShell({
  role,
  children,
  previewControls,
}: {
  readonly role: 'TEACHER' | 'STUDENT';
  readonly children: ReactNode;
  readonly previewControls?: ReactNode;
}) {
  const teacher = role === 'TEACHER';
  return (
    <div className="cosmic-service" data-theme="cosmic">
      <aside className="cosmic-rail" aria-label="LessonQuest 탐험 메뉴">
        <a className="cosmic-brand" href={teacher ? '#studio-title' : '#student-title'}>
          <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <circle
              cx="20"
              cy="20"
              r="12"
              fill="none"
              stroke="#20c7df"
              strokeWidth="6"
              strokeDasharray="56 20"
              transform="rotate(-60 20 20)"
            />
            <path
              d="m23 25 10 9M28 7a16 16 0 0 1 5 21"
              fill="none"
              stroke="#ffc85a"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <span>
            LessonQuest<small>LEARN · PLAY · DISCOVER</small>
          </span>
        </a>
        <p className="cosmic-label rail-label">
          {teacher ? 'TEACHER STATION' : 'EXPLORER STATION'}
        </p>
        {previewControls ?? (
          <nav aria-label="현재 서비스">
            <a
              className="cosmic-current"
              href={teacher ? '#studio-title' : '#student-title'}
              aria-current="page"
            >
              {teacher ? '탐험 제작소' : '내 과학 탐험'}
            </a>
          </nav>
        )}
        <div className="cosmic-rail-note">
          <span className="cosmic-orbit-mark" aria-hidden="true">
            ✧
          </span>
          <p>
            작은 질문에서 시작되는
            <br />
            <strong>커다란 발견의 세계.</strong>
          </p>
        </div>
        <p className="cosmic-rail-footer">LESSONQUEST {teacher ? 'STUDIO' : 'PLAY'}</p>
      </aside>
      <div className="cosmic-content">
        <header className="cosmic-topbar">
          <p>
            <span className="cosmic-online" aria-hidden="true" />
            {teacher ? '탐험 제작소' : '내 학습 공간'}{' '}
            <span className="cosmic-topbar-divider">/</span> 과학
          </p>
          <div className="cosmic-profile">
            <span aria-hidden="true">{teacher ? 'T' : 'S'}</span>
            <p>
              {teacher ? '교사' : '학생 탐험가'}
              <small>{previewControls ? '가상 계정 · 개발 미리보기' : 'LessonQuest'}</small>
            </p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
