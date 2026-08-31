import { useId } from 'react';
import explorerUrl from '../assets/cosmic-explorer.png';

export function RasaAvatar() {
  const glow = useId();
  return (
    <svg className="cosmic-rasa-avatar" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={glow} cx="30%" cy="25%" r="80%">
          <stop stopColor="#e2fcff" />
          <stop offset="0.5" stopColor="#7cd9e9" />
          <stop offset="1" stopColor="#357cc0" />
        </radialGradient>
      </defs>
      <path d="m88 28 12-13" stroke="#8ce9f0" strokeWidth="5" strokeLinecap="round" />
      <circle cx="101" cy="13" r="7" fill="#a5f6f9" />
      <rect x="17" y="23" width="88" height="82" rx="38" fill={`url(#${glow})`} />
      <rect x="29" y="37" width="64" height="52" rx="23" fill="#091532" />
      <ellipse cx="46" cy="58" rx="5" ry="8" fill="#7bffff" />
      <ellipse cx="77" cy="58" rx="5" ry="8" fill="#7bffff" />
      <path
        d="M53 74q8 7 16 0"
        fill="none"
        stroke="#7bffff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MissionWelcome({ teacher = false }: { readonly teacher?: boolean }) {
  return (
    <section
      className={`cosmic-hero${teacher ? ' is-studio' : ''}`}
      aria-label={teacher ? '탐험 제작 안내' : '우주 탐험 안내'}
    >
      <div className="cosmic-hero-copy">
        <p className="cosmic-label">{teacher ? 'MISSION CONTROL' : 'YOUR NEXT DISCOVERY'}</p>
        <h2>
          {teacher ? (
            <>
              배움의 새로운
              <br />
              항로를 열어보세요.
            </>
          ) : (
            <>
              배움의 우주로,
              <br />
              다음 한 걸음.
            </>
          )}
        </h2>
        <p>
          {teacher
            ? '아이들의 호기심이 미션이 되는 곳.\n체험을 검증하고, 우리 반에 보내세요.'
            : '예상하고, 실험하고, 다시 도전하며\n나만의 발견을 만들어 보세요.'}
        </p>
        <a className="cosmic-cta" href={teacher ? '#studio-editor' : '#student-assignments'}>
          {teacher ? '탐험 만들기' : '내 미션 보기'} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <img
        className="cosmic-astronaut"
        src={explorerUrl}
        alt=""
        width="1536"
        height="1024"
        fetchPriority="high"
      />
    </section>
  );
}

export function RasaCompanion() {
  return (
    <aside className="cosmic-companion" aria-label="Rasa 탐험 가이드">
      <RasaAvatar />
      <p className="cosmic-label">YOUR COMPANION</p>
      <h2>함께 찾는 즐거움, Rasa</h2>
      <p>
        막혀도 괜찮아요. 한 번 시도하면
        <br />답 대신 생각할 단서를 건네요.
      </p>
    </aside>
  );
}
