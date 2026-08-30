import { useState } from 'react';

import { ClassBossCard } from './components/class-boss-card.js';
import { RasaHintPanel } from './components/rasa-hint-panel.js';

const DEMO_HINT = {
  stepId: 'quiz_force',
  level: 1 as const,
  content: '문제에서 무엇이 계속 유지되는지 먼저 찾아보자.',
};

export function DemoStudentHome() {
  const [missionStarted, setMissionStarted] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [completed, setCompleted] = useState(false);

  return (
    <div className="demo-student-layout">
      <nav className="demo-navigation" aria-label="주요 메뉴">
        <a className="demo-brand" href="#student-mission">
          <span className="demo-brand-mark" aria-hidden="true">
            LQ
          </span>
          <span>LessonQuest</span>
        </a>
        <div className="demo-navigation-links">
          <a className="is-active" href="#student-mission" aria-current="page">
            <span aria-hidden="true">01</span>
            대시보드
          </a>
          <a href="#mission-question">
            <span aria-hidden="true">02</span>
            내 미션
          </a>
          <a href="#class-boss">
            <span aria-hidden="true">03</span>
            우리 반
          </a>
          <a href="#growth-summary">
            <span aria-hidden="true">04</span>
            성장 기록
          </a>
        </div>
        <p className="demo-navigation-note">
          <span>이번 주 탐험</span>
          <strong>3일 연속</strong>
        </p>
      </nav>

      <section
        className="demo-mission-column"
        id="student-mission"
        aria-labelledby="demo-student-title"
      >
        <header className="demo-student-header">
          <div>
            <p className="eyebrow">LESSONQUEST PLAY · DEMO</p>
            <p>오늘도 한 걸음, 배운 것을 내 힘으로 만들어 볼까요?</p>
          </div>
          <div className="demo-profile" aria-label="합성 학생 프로필">
            <span aria-hidden="true">ST</span>
            <div>
              <strong>학생 탐험가</strong>
              <small>레벨 7 · 합성 데이터</small>
            </div>
          </div>
        </header>

        <article className="demo-mission-card">
          <div className="demo-mission-copy">
            <p className="demo-section-label">오늘의 미션</p>
            <h1 id="demo-student-title">힘과 운동 탐험</h1>
            <p>
              움직임을 바꾸는 힘의 규칙을 찾아 우주 정거장의 궤도를 안정시켜 보세요.
            </p>
            <div className="demo-mission-meta" aria-label="미션 정보">
              <span>과학</span>
              <span>약 8분</span>
              <span>진행 60%</span>
            </div>
            {!missionStarted ? (
              <button
                type="button"
                className="demo-primary"
                onClick={() => setMissionStarted(true)}
              >
                탐험 계속하기
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>

          <div className="demo-trajectory" aria-hidden="true">
            <svg viewBox="0 0 460 300" focusable="false">
              <defs>
                <linearGradient id="trajectory-orbit" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="currentColor" />
                  <stop offset="1" stopColor="#20c7df" />
                </linearGradient>
              </defs>
              <circle className="trajectory-halo" cx="307" cy="126" r="82" />
              <circle className="trajectory-core" cx="307" cy="126" r="48" />
              <path
                className="trajectory-path"
                d="M38 245C116 263 129 177 195 185c47 5 43-74 112-59 46 10 60 58 118 26"
              />
              <path className="trajectory-arrow" d="m400 139 25 13-19 20" />
              <circle className="trajectory-node" cx="69" cy="245" r="10" />
              <circle className="trajectory-node" cx="195" cy="185" r="10" />
              <circle className="trajectory-node is-current" cx="307" cy="126" r="14" />
              <path className="trajectory-craft" d="m179 165 28 18-24 23-2-15-15-7z" />
              <path className="trajectory-force" d="M80 88h80m-18-18 18 18-18 18" />
              <path className="trajectory-force secondary" d="M113 122h-55m16-16-16 16 16 16" />
            </svg>
            <span>궤도 안정화 60%</span>
          </div>
        </article>

        {missionStarted ? (
          <article className="demo-question-card" id="mission-question">
            <div className="demo-question-heading">
              <p className="demo-section-label">탐험 체크포인트 3</p>
              <span>한 번 더 생각해도 괜찮아요</span>
            </div>
            <h2>같은 힘을 받을 때 가속도가 더 큰 물체는?</h2>
            <p>두 물체가 같은 크기의 힘을 받는 상황을 떠올려 보세요.</p>
            <div className="choice-grid">
              <button
                type="button"
                onClick={() => {
                  setWrong(false);
                  setCompleted(true);
                }}
              >
                <span aria-hidden="true">A</span>
                질량 2 kg 선택
              </button>
              <button
                type="button"
                onClick={() => {
                  setWrong(true);
                  setCompleted(false);
                }}
              >
                <span aria-hidden="true">B</span>
                질량 6 kg 선택
              </button>
            </div>
            {wrong ? <p className="retry">좋은 시도예요. 단서를 살펴보고 다시 골라 보세요.</p> : null}
            <RasaHintPanel
              hints={hintVisible ? [DEMO_HINT] : []}
              available={wrong}
              pending={false}
              exhausted={hintVisible}
              onRequest={() => setHintVisible(true)}
            />
            {completed ? <p className="pass-stamp">재도전 성공 · 탐험 완료</p> : null}
          </article>
        ) : null}

        <section className="demo-growth-summary" id="growth-summary" aria-label="이번 주 성장">
          <div>
            <p className="demo-section-label">이번 주 성장</p>
            <strong>개념 연결하기</strong>
          </div>
          <p>힘과 질량의 관계를 설명하는 미션을 2개 완료했어요.</p>
        </section>
      </section>

      <aside className="demo-support-column" aria-label="학습 지원">
        <section className="demo-rasa-companion" aria-labelledby="demo-rasa-title">
          <div className="demo-rasa-orbit" aria-hidden="true">
            <span>R</span>
          </div>
          <p className="demo-section-label">RASA COMPANION</p>
          <h2 id="demo-rasa-title">막히면, 답 대신 길을 찾자</h2>
          <p>한 번 시도한 뒤에는 Rasa가 생각을 이어 갈 작은 단서를 건네요.</p>
        </section>

        <div id="class-boss">
          <ClassBossCard
            progress={{
              campaignId: '018f72a4-cc52-7c5a-a6f9-8b21aa27de01',
              title: '우리 반 관성 보스',
              targetHp: 100,
              damage: completed ? 40 : 32,
              completed: false,
            }}
          />
        </div>

        <section className="demo-next-session" aria-labelledby="next-session-title">
          <p className="demo-section-label">다음 탐험</p>
          <h2 id="next-session-title">에너지 전환 연구소</h2>
          <p>현재 미션을 마치면 새로운 탐험이 열려요.</p>
        </section>
      </aside>
    </div>
  );
}
