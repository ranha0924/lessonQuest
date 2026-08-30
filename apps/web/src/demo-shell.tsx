import { useState } from 'react';

import { DemoStudentHome } from './demo-student-home.js';

export function DemoShell() {
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');

  return (
    <main className="demo-shell" data-theme="dark">
      <aside className="demo-toolbar" aria-label="데모 보기 전환">
        <strong>합성 데이터 데모 · 새로고침하면 초기화됩니다</strong>
        <div>
          <button
            type="button"
            onClick={() => setRole('STUDENT')}
            aria-pressed={role === 'STUDENT'}
          >
            학생 화면
          </button>
          <button
            type="button"
            onClick={() => setRole('TEACHER')}
            aria-pressed={role === 'TEACHER'}
          >
            교사 화면
          </button>
        </div>
      </aside>

      {role === 'STUDENT' ? (
        <DemoStudentHome />
      ) : (
        <section className="workbench" aria-labelledby="demo-teacher-title">
          <header className="mission-header">
            <p className="eyebrow">LESSONQUEST STUDIO · DEMO</p>
            <h1 id="demo-teacher-title">교사 운영 화면</h1>
            <p>검증·승인된 과제와 Rasa 정책, 반 공동 보스 현황을 확인합니다.</p>
          </header>
          <div className="workbench-grid">
            <section className="panel">
              <p className="panel-kicker">과제 정책</p>
              <h2>힘과 운동 탐험</h2>
              <p>상태 · 배포 완료</p>
              <p>Rasa · 사용, 최대 2단계</p>
              <p className="pass-stamp">독립 검증·교사 승인 완료</p>
            </section>
            <section className="panel">
              <p className="panel-kicker">학습 과정</p>
              <h2>합성 학생 진행</h2>
              <p>시작 24명 · 완료 18명</p>
              <p>오답 7회 · 재도전 6회 · 힌트 4회</p>
              <p>개인 순위는 공개하지 않습니다.</p>
            </section>
            <section className="panel boss-admin">
              <p className="panel-kicker">CLASS BOSS</p>
              <h2>우리 반 관성 보스</h2>
              <p>32 / 100 HP · 투영 대기 0 · 실패 0</p>
              <p>첫 정답·재도전·완료 이벤트만 서버 규칙으로 합산합니다.</p>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
