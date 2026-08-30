import { useEffect, useState, type FormEvent } from 'react';
import type { TeacherBossDetail } from '@lessonquest/contracts';
import type { LessonQuestApi } from '../api-client.js';

export function BossCampaignPanel({
  api,
  organizationId,
  classId,
}: {
  readonly api: LessonQuestApi;
  readonly organizationId: string;
  readonly classId: string;
}) {
  const [detail, setDetail] = useState<TeacherBossDetail | null>(null);
  const [periodKind, setPeriodKind] = useState<'WEEKLY' | 'SPECIAL'>('WEEKLY');
  const [status, setStatus] = useState('공동 보스를 시작할 수 있습니다.');
  useEffect(() => {
    let active = true;
    void api
      .getTeacherBossDetail(organizationId, classId)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, organizationId, classId]);
  const create = (event: FormEvent) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : '';
    };
    void api
      .createBossCampaign(organizationId, classId, {
        title: text('title'),
        period:
          periodKind === 'WEEKLY'
            ? { kind: 'WEEKLY', weekStart: text('weekStart') }
            : { kind: 'SPECIAL', version: Number(form.get('version')) },
        targetHp: Number(form.get('targetHp')),
        policy: {
          amounts: {
            ANSWER_CORRECT: Number(form.get('correct')),
            ANSWER_RETRIED: Number(form.get('retried')),
            EXPERIENCE_COMPLETED: Number(form.get('completed')),
          },
        },
      })
      .then((value) => {
        setDetail(value);
        setStatus('공동 보스를 시작했습니다.');
      })
      .catch(() => setStatus('공동 보스를 시작하지 못했습니다.'));
  };
  const end = () => {
    if (detail === null) return;
    void api
      .endBossCampaign(organizationId, classId, detail.campaign.campaignId, {
        requestId: crypto.randomUUID(),
      })
      .then((value) => {
        setDetail(value);
        setStatus('공동 보스를 종료했습니다. 새 보스를 시작할 수 있습니다.');
      })
      .catch(() => setStatus('공동 보스를 종료하지 못했습니다.'));
  };
  const canCreate = detail === null || detail.campaign.status === 'ENDED';
  return (
    <section className="panel boss-admin" aria-labelledby="boss-admin-title">
      <h2 id="boss-admin-title">반 공동 보스</h2>
      {canCreate ? (
        <form onSubmit={create}>
          <label>
            보스 이름
            <input name="title" defaultValue="과학 공동 보스" maxLength={120} required />
          </label>
          <label>
            캠페인 유형
            <select
              aria-label="캠페인 유형"
              value={periodKind}
              onChange={(event) => setPeriodKind(event.target.value as 'WEEKLY' | 'SPECIAL')}
            >
              <option value="WEEKLY">주간</option>
              <option value="SPECIAL">특별</option>
            </select>
          </label>
          {periodKind === 'WEEKLY' ? (
            <label>
              주 시작일
              <input name="weekStart" type="date" defaultValue="2026-08-24" required />
            </label>
          ) : (
            <label>
              특별 캠페인 버전
              <input name="version" type="number" min={1} max={1000000} defaultValue={1} required />
            </label>
          )}
          <label>
            목표 HP
            <input name="targetHp" type="number" min={60} max={60000} defaultValue={600} required />
          </label>
          <label>
            첫 정답 기여
            <input name="correct" type="number" min={0} max={10000} defaultValue={2} />
          </label>
          <label>
            재도전 정답 기여
            <input name="retried" type="number" min={0} max={10000} defaultValue={3} />
          </label>
          <label>
            완료 기여
            <input name="completed" type="number" min={0} max={10000} defaultValue={5} />
          </label>
          <button type="submit">보스 시작</button>
        </form>
      ) : (
        <>
          <p>
            {detail.campaign.damage} / {detail.campaign.targetHp}
          </p>
          <p>
            대기 {detail.projectionHealth.pending} · 실패 {detail.projectionHealth.failed}
          </p>
          <button type="button" onClick={end}>
            보스 종료
          </button>
          {detail.contributions.map((row) => (
            <p key={row.studentId}>
              학생 ••{row.studentId.slice(-4)} · {row.damage}점 · {row.reasons.join(', ')}
            </p>
          ))}
        </>
      )}
      <p aria-live="polite">{status}</p>
    </section>
  );
}
