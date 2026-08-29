import {
  createExperienceEventSession,
  type ExperienceEventSession,
} from '@lessonquest/experience-sdk';
import { useEffect, useRef, useState } from 'react';

import type {
  LessonQuestApi,
  StudentAssignmentSummary,
  StudentScienceSpecification,
} from '../api-client.js';

interface StudentPlayProps {
  readonly api: LessonQuestApi;
  readonly organizationId: string;
}

export function StudentPlay({ api, organizationId }: StudentPlayProps) {
  const [assignments, setAssignments] = useState<StudentAssignmentSummary[]>([]);
  const [specification, setSpecification] = useState<StudentScienceSpecification | null>(null);
  const [status, setStatus] = useState('내 탐험을 불러오는 중');
  const [retryReady, setRetryReady] = useState(false);
  const [retryComplete, setRetryComplete] = useState(false);
  const sessionRef = useRef<ExperienceEventSession | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .listStudentAssignments(organizationId)
      .then((items) => {
        if (active) {
          setAssignments(items);
          setStatus(items.length === 0 ? '지금 할 탐험이 없어요.' : '탐험을 골라 보세요.');
        }
      })
      .catch(() => {
        if (active) setStatus('탐험을 불러오지 못했어요.');
      });
    return () => {
      active = false;
    };
  }, [api, organizationId]);

  const start = (assignmentId: string) => {
    void (async () => {
      const attempt = await api.startAttempt(organizationId, assignmentId);
      const player = await api.getPlayer(organizationId, assignmentId);
      const session = createExperienceEventSession({
        organizationId,
        assignmentId,
        attemptId: attempt.id,
        experienceId: player.experienceId,
        experienceVersion: player.experienceVersion,
      });
      sessionRef.current = session;
      await api.ingestEvent(session.started('start'));
      setSpecification(player.specification);
      setStatus('탐험 진행 중');
    })().catch(() => setStatus('탐험을 시작하지 못했어요.'));
  };

  const submitFirstChoice = (stepId: string) => {
    const session = sessionRef.current;
    if (session === null) return;
    void api
      .ingestEvent(session.wrongAnswer(stepId, 1, 1_000))
      .then(() => {
        setRetryReady(true);
        setStatus('다시 생각해 볼까요?');
      })
      .catch(() => setStatus('답을 기록하지 못했어요.'));
  };

  const retry = (stepId: string) => {
    const session = sessionRef.current;
    if (session === null) return;
    void api
      .ingestEvent(session.retriedAnswer(stepId, 2, 700))
      .then(() => {
        setRetryComplete(true);
        setStatus('재도전 성공');
      })
      .catch(() => setStatus('재도전을 기록하지 못했어요.'));
  };

  const complete = () => {
    const session = sessionRef.current;
    if (session === null) return;
    void api
      .ingestEvent(session.completed('complete', 8_000))
      .then(() => setStatus('탐험을 완료했습니다!'))
      .catch(() => setStatus('완료를 기록하지 못했어요.'));
  };

  const quiz = specification?.blocks.find((block) => block.kind === 'QUIZ');

  return (
    <main className="student-shell">
      <header className="mission-header">
        <p className="eyebrow">LESSONQUEST PLAY</p>
        <h1>내 과학 탐험</h1>
        <p>궁금한 것을 예상하고, 실험하고, 다시 도전해 보세요.</p>
      </header>

      {specification === null ? (
        <section className="assignment-grid" aria-label="배포된 탐험">
          {assignments.map((assignment) => (
            <article className="assignment-card" aria-label={assignment.title} key={assignment.id}>
              <span className="mission-tag">과학 미션</span>
              <h2>{assignment.title}</h2>
              <p>{assignment.attemptStatus === null ? '새 탐험' : '진행 중인 탐험'}</p>
              <button className="primary" type="button" onClick={() => start(assignment.id)}>
                {assignment.attemptStatus === null ? '탐험 시작' : '이어하기'}
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="player-canvas" aria-labelledby="player-title">
          <p className="eyebrow">FORCE &amp; MOTION EXPEDITION</p>
          <h2 id="player-title">{specification.title}</h2>
          {specification.blocks.map((block) => (
            <article className="play-block" key={block.id}>
              {block.kind === 'CONCEPT_CARD' ? (
                <>
                  <h3>{block.title}</h3>
                  <p>{block.body}</p>
                </>
              ) : null}
              {block.kind === 'PREDICTION' ? (
                <>
                  <h3>예상</h3>
                  <p>{block.prompt}</p>
                </>
              ) : null}
              {block.kind === 'SIMULATION' ? (
                <>
                  <h3>실험</h3>
                  <p>{block.prompt}</p>
                  <strong>
                    {(
                      0.5 *
                      (block.parameters.forceN / block.parameters.massKg) *
                      block.parameters.durationSec ** 2
                    ).toFixed(1)}{' '}
                    m
                  </strong>
                </>
              ) : null}
              {block.kind === 'REFLECTION' ? (
                <>
                  <h3>성찰</h3>
                  <p>{block.prompt}</p>
                </>
              ) : null}
              {block.kind === 'QUIZ' ? (
                <>
                  <h3>{block.question}</h3>
                  <div className="choice-grid">
                    {block.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => submitFirstChoice(block.id)}
                        disabled={retryReady}
                      >
                        {option.label} 선택
                      </button>
                    ))}
                  </div>
                  {retryReady && !retryComplete ? (
                    <button className="retry" type="button" onClick={() => retry(block.id)}>
                      다시 도전
                    </button>
                  ) : null}
                </>
              ) : null}
            </article>
          ))}
          <button
            className="primary complete"
            type="button"
            onClick={complete}
            disabled={quiz !== undefined && !retryComplete}
          >
            탐험 완료
          </button>
        </section>
      )}
      <p className="status-banner" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
