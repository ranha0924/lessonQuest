import {
  createExperienceEventSession,
  type ExperienceEventSession,
} from '@lessonquest/experience-sdk';
import { useEffect, useRef, useState } from 'react';
import type { ClientLearningEvent } from '@lessonquest/contracts';

import { LessonQuestApiError } from '../api-client.js';
import type {
  LessonQuestApi,
  StudentAssignmentSummary,
  StudentScienceSpecification,
} from '../api-client.js';
import { ClassBossCard } from './class-boss-card.js';
import { RasaHintPanel } from './rasa-hint-panel.js';

interface StudentPlayProps {
  readonly api: LessonQuestApi;
  readonly organizationId: string;
}

export function StudentPlay({ api, organizationId }: StudentPlayProps) {
  const [assignments, setAssignments] = useState<StudentAssignmentSummary[]>([]);
  const [specification, setSpecification] = useState<StudentScienceSpecification | null>(null);
  const [status, setStatus] = useState('내 탐험을 불러오는 중');
  const [answerAttempts, setAnswerAttempts] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [hints, setHints] = useState<
    readonly { stepId: string; level: 1 | 2 | 3; content: string }[]
  >([]);
  const [maxHintLevel, setMaxHintLevel] = useState<1 | 2 | 3>(1);
  const [rasaEnabled, setRasaEnabled] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<ClientLearningEvent | null>(null);
  const pendingEventRef = useRef<ClientLearningEvent | null>(null);
  const writeInFlight = useRef(false);
  const [hintUncertain, setHintUncertain] = useState(false);
  const [newHintAllowed, setNewHintAllowed] = useState(false);
  const [bossProgress, setBossProgress] =
    useState<Awaited<ReturnType<LessonQuestApi['getStudentBossProgress']>>>(null);
  const hintRequestId = useRef<string | null>(null);
  const sessionRef = useRef<ExperienceEventSession | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .listStudentAssignments(organizationId)
      .then((items) => {
        if (active) {
          setAssignments(items);
          const classId = items[0]?.classId;
          if (classId !== undefined) {
            setCurrentClassId(classId);
            void api
              .getStudentBossProgress(organizationId, classId)
              .then(setBossProgress)
              .catch(() => undefined);
          }
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
    if (writeInFlight.current) return;
    writeInFlight.current = true;
    setStarting(true);
    void (async () => {
      const attempt = await api.startAttempt(organizationId, assignmentId);
      if (attempt.status === 'COMPLETED') {
        setStatus('이미 완료한 탐험입니다.');
        return;
      }
      const player = await api.getPlayer(organizationId, assignmentId);
      const session = createExperienceEventSession(
        {
          organizationId,
          assignmentId,
          attemptId: attempt.id,
          experienceId: player.experienceId,
          experienceVersion: player.experienceVersion,
        },
        {
          initialSequence: attempt.nextSequence,
        },
      );
      sessionRef.current = session;
      setCurrentClassId(
        player.assignmentId === assignmentId
          ? (assignments.find(({ id }) => id === assignmentId)?.classId ?? null)
          : null,
      );
      setAttemptId(attempt.id);
      setHints(attempt.rasa.hints);
      setMaxHintLevel(attempt.rasa.maxHintLevel);
      setRasaEnabled(attempt.rasa.enabled);
      const quiz = player.specification.blocks.find((block) => block.kind === 'QUIZ');
      const answerState = attempt.answers.find(({ stepId }) => stepId === quiz?.id);
      setAnswerAttempts(answerState?.attempts ?? 0);
      setQuizCorrect(answerState?.correct ?? false);
      setCompleted(false);
      if (attempt.status === 'READY') {
        const event = session.started('start');
        const result = await api.ingestEvent(event);
        session.acknowledge(event.eventId, result.nextSequence);
      }
      setSpecification(player.specification);
      setStatus(
        answerState?.correct === true
          ? '정답을 확인했습니다. 탐험을 완료해 보세요.'
          : answerState === undefined
            ? '탐험 진행 중'
            : '다시 생각해 볼까요?',
      );
    })()
      .catch((error: unknown) =>
        setStatus(
          error instanceof LessonQuestApiError && error.status === 409
            ? '이전 요청을 처리 중이에요. 잠시 후 이어하기를 눌러 주세요.'
            : '탐험을 시작하지 못했어요.',
        ),
      )
      .finally(() => {
        writeInFlight.current = false;
        setStarting(false);
      });
  };

  const sendEvent = (event: ClientLearningEvent) => {
    const session = sessionRef.current;
    if (session === null || writeInFlight.current) return;
    writeInFlight.current = true;
    pendingEventRef.current = event;
    setPendingEvent(event);
    setSubmitting(true);
    void api
      .ingestEvent(event)
      .then((result) => {
        if (event.type !== 'EXPERIENCE_COMPLETED' && result.answer === null) {
          throw new TypeError('Answer outcome missing');
        }
        session.acknowledge(event.eventId, result.nextSequence);
        pendingEventRef.current = null;
        setPendingEvent(null);
        if (event.type === 'EXPERIENCE_COMPLETED') {
          setCompleted(true);
          setStatus('탐험을 완료했습니다!');
        } else if (result.answer !== null) {
          setAnswerAttempts(result.answer.attempt);
          setQuizCorrect(result.answer.correct);
          setStatus(
            result.answer.correct
              ? result.answer.attempt === 1
                ? '정답이에요!'
                : '재도전 성공'
              : '다시 생각해 볼까요?',
          );
        }
      })
      .catch(() =>
        setStatus(
          event.type === 'EXPERIENCE_COMPLETED'
            ? '완료를 기록하지 못했어요.'
            : '답을 기록하지 못했어요.',
        ),
      )
      .finally(() => {
        writeInFlight.current = false;
        setSubmitting(false);
      });
  };

  const submitChoice = (stepId: string, optionId: string) => {
    const session = sessionRef.current;
    if (
      session === null ||
      writeInFlight.current ||
      pendingEventRef.current !== null ||
      hintUncertain ||
      quizCorrect
    )
      return;
    const nextAttempt = answerAttempts + 1;
    sendEvent(
      nextAttempt === 1
        ? session.answered(stepId, optionId, nextAttempt, 1_000)
        : session.retried(stepId, optionId, nextAttempt, 700),
    );
  };

  const complete = () => {
    const session = sessionRef.current;
    if (
      session === null ||
      writeInFlight.current ||
      pendingEventRef.current !== null ||
      hintUncertain ||
      completed ||
      !quizCorrect
    )
      return;
    sendEvent(session.completed('complete', 8_000));
  };

  const quiz = specification?.blocks.find((block) => block.kind === 'QUIZ');
  const requestHint = () => {
    const session = sessionRef.current;
    if (
      session === null ||
      currentClassId === null ||
      attemptId === null ||
      quiz === undefined ||
      writeInFlight.current ||
      pendingEventRef.current !== null ||
      !rasaEnabled ||
      answerAttempts === 0 ||
      quizCorrect ||
      completed
    )
      return;
    hintRequestId.current ??= globalThis.crypto.randomUUID();
    writeInFlight.current = true;
    setHintPending(true);
    void api
      .requestRasaHint(organizationId, currentClassId, {
        requestId: hintRequestId.current,
        attemptId,
        stepId: quiz.id,
      })
      .then((result) => {
        session.synchronize(result.nextSequence);
        setHints((current) => [
          ...current.filter(({ level }) => level !== result.action.level),
          result.action,
        ]);
        hintRequestId.current = null;
        setHintUncertain(false);
        setNewHintAllowed(false);
        setStatus(`힌트 ${result.action.level}을 확인해 보세요.`);
      })
      .catch((error: unknown) => {
        const known = error instanceof LessonQuestApiError;
        const terminal =
          known &&
          [
            'RASA_OUTPUT_REJECTED',
            'RASA_PROVIDER_FAILED',
            'RASA_PROVIDER_TIMEOUT',
            'RASA_FINALIZATION_FAILED',
          ].includes(error.code);
        // A replay error can arrive while the disconnected original is still
        // running. Only a terminal Rasa outcome resolves that earlier uncertainty.
        const uncertain = !known || (hintUncertain && !terminal);
        setHintUncertain(uncertain);
        setNewHintAllowed(known && terminal && error.retryable);
        if (known && !error.retryable && !uncertain) hintRequestId.current = null;
        setStatus('힌트를 불러오지 못했어요. 다시 시도해 주세요.');
      })
      .finally(() => {
        writeInFlight.current = false;
        setHintPending(false);
      });
  };

  return (
    <main className="student-shell">
      <header className="mission-header">
        <p className="eyebrow">LESSONQUEST PLAY</p>
        <h1>내 과학 탐험</h1>
        <p>궁금한 것을 예상하고, 실험하고, 다시 도전해 보세요.</p>
      </header>

      {specification === null ? (
        <>
          <ClassBossCard progress={bossProgress} />
          <section className="assignment-grid" aria-label="배포된 탐험">
            {assignments.map((assignment) => (
              <article
                className="assignment-card"
                aria-label={assignment.title}
                key={assignment.id}
              >
                <span className="mission-tag">과학 미션</span>
                <h2>{assignment.title}</h2>
                <p>{assignment.attemptStatus === null ? '새 탐험' : '진행 중인 탐험'}</p>
                <button
                  className="primary"
                  type="button"
                  onClick={() => start(assignment.id)}
                  disabled={starting || assignment.attemptStatus === 'COMPLETED'}
                >
                  {assignment.attemptStatus === null
                    ? '탐험 시작'
                    : assignment.attemptStatus === 'COMPLETED'
                      ? '완료됨'
                      : '이어하기'}
                </button>
              </article>
            ))}
          </section>
        </>
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
                        onClick={() => submitChoice(block.id, option.id)}
                        disabled={
                          submitting ||
                          pendingEvent !== null ||
                          hintPending ||
                          hintUncertain ||
                          quizCorrect
                        }
                      >
                        {option.label} 선택
                      </button>
                    ))}
                  </div>
                  {answerAttempts > 0 && !quizCorrect ? (
                    <p className="retry">다른 답을 골라 다시 도전해 보세요.</p>
                  ) : null}
                  <RasaHintPanel
                    hints={hints.filter(({ stepId }) => stepId === block.id)}
                    available={
                      rasaEnabled &&
                      answerAttempts > 0 &&
                      !quizCorrect &&
                      !completed &&
                      pendingEvent === null
                    }
                    pending={hintPending}
                    exhausted={
                      hints.filter(({ stepId }) => stepId === block.id).length >= maxHintLevel
                    }
                    onRequest={requestHint}
                  />
                  {newHintAllowed && !quizCorrect && !completed ? (
                    <button
                      type="button"
                      disabled={hintPending || pendingEvent !== null}
                      onClick={() => {
                        hintRequestId.current = null;
                        setNewHintAllowed(false);
                        requestHint();
                      }}
                    >
                      새 힌트 요청
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
            disabled={
              completed ||
              submitting ||
              pendingEvent !== null ||
              hintPending ||
              hintUncertain ||
              (quiz !== undefined && !quizCorrect)
            }
          >
            탐험 완료
          </button>
        </section>
      )}
      {pendingEvent !== null ? (
        <button type="button" disabled={submitting} onClick={() => sendEvent(pendingEvent)}>
          기록 다시 전송
        </button>
      ) : null}
      <p className="status-banner" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
