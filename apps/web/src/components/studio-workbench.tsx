import { useState, type FormEvent } from 'react';

import type { StudentProgress } from '@lessonquest/contracts';

import type { LessonQuestApi, ValidationReport } from '../api-client.js';
import { SandboxPreview } from './sandbox-preview.js';
import { TeacherProgress } from './teacher-progress.js';
import { BossCampaignPanel } from './boss-campaign-panel.js';

interface StudioWorkbenchProps {
  readonly api: LessonQuestApi;
  readonly organizationId: string;
  readonly classId: string;
}

export function StudioWorkbench({ api, organizationId, classId }: StudioWorkbenchProps) {
  const [title, setTitle] = useState('');
  const [generatedSpecText, setGeneratedSpecText] = useState('');
  const [versionId, setVersionId] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [previewDocument, setPreviewDocument] = useState<string | null>(null);
  const [status, setStatus] = useState('새 과학 체험을 준비해 보세요.');
  const [approved, setApproved] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<StudentProgress[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rasaEnabled, setRasaEnabled] = useState(true);
  const [maxHintLevel, setMaxHintLevel] = useState<1 | 2 | 3>(2);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const createDraft = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const created = await api.createScienceExperience(organizationId, {
        title,
        generatedSpecText,
      });
      setReport(null);
      setPreviewDocument(null);
      setApproved(false);
      setAssignmentId(null);
      setProgress(null);
      setVersionId(created.versionId);
      setStatus('초안이 생성됐습니다.');
    });
  };

  const validate = () => {
    if (versionId === null) return;
    void run(async () => {
      const validated = await api.validateExperienceVersion(organizationId, versionId);
      const preview = await api.getExperiencePreview(organizationId, versionId);
      setReport(validated.report);
      setPreviewDocument(preview.sandboxDocument);
      setStatus(validated.report.verdict === 'PASS' ? '검증 통과' : '검증 실패');
    });
  };

  const review = (decision: 'APPROVE' | 'REJECT') => {
    if (versionId === null) return;
    void run(async () => {
      const result = await api.reviewExperienceVersion(organizationId, versionId, { decision });
      setApproved(result.status === 'APPROVED');
      setStatus(result.status === 'APPROVED' ? '교사 승인 완료' : '교사 반려 완료');
    });
  };

  const assign = () => {
    if (versionId === null) return;
    void run(async () => {
      const assignment = await api.createAssignment(organizationId, classId, {
        experienceVersionId: versionId,
        rasaPolicy: { enabled: rasaEnabled, maxHintLevel },
      });
      setAssignmentId(assignment.id);
      setStatus('반 배포 완료');
    });
  };

  const loadProgress = () => {
    if (assignmentId === null) return;
    void run(async () => {
      setProgress(await api.listTeacherProgress(organizationId, classId, assignmentId));
      setStatus('교사 결과를 최신 상태로 불러왔습니다.');
    });
  };

  return (
    <main className="workbench" aria-labelledby="studio-title">
      <header className="mission-header">
        <p className="eyebrow">LESSONQUEST STUDIO · SCIENCE</p>
        <h1 id="studio-title">과학 탐험 제작소</h1>
        <p>생성물을 검증하고, 교사가 직접 승인한 버전만 반으로 보냅니다.</p>
      </header>

      <nav className="discovery-trail" aria-label="제작 단계">
        {['생성', '검증', '미리보기', '승인', '배포'].map((step, index) => (
          <span
            key={step}
            className={index === 0 || versionId !== null ? 'trail-step active' : 'trail-step'}
          >
            <b>{index + 1}</b>
            {step}
          </span>
        ))}
      </nav>

      <div className="workbench-grid">
        <form className="panel author-panel" onSubmit={createDraft}>
          <p className="panel-kicker">01 · 생성 입력</p>
          <label>
            체험 제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            생성된 과학 JSON
            <textarea
              value={generatedSpecText}
              onChange={(event) => setGeneratedSpecText(event.target.value)}
              rows={12}
              required
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            초안 저장
          </button>
          <button type="button" onClick={validate} disabled={busy || versionId === null}>
            독립 검증
          </button>
        </form>

        <section className="panel preview-panel" aria-labelledby="preview-title">
          <p className="panel-kicker">02 · 격리 확인</p>
          <h2 id="preview-title">실험 캔버스</h2>
          {previewDocument === null ? (
            <div className="empty-state">
              검증을 통과하면 네트워크가 차단된 미리보기가 열립니다.
            </div>
          ) : (
            <SandboxPreview document={previewDocument} />
          )}
        </section>

        <aside className="panel ledger" aria-labelledby="ledger-title">
          <p className="panel-kicker">03 · 검증 대장</p>
          <h2 id="ledger-title">발견 내역</h2>
          {report === null ? <p>아직 검증 결과가 없습니다.</p> : null}
          {report?.findings.map((finding) => (
            <p className="finding" key={`${finding.code}-${finding.blockId ?? 'global'}`}>
              {finding.code}
            </p>
          ))}
          {report?.verdict === 'PASS' ? <p className="pass-stamp">검증 통과</p> : null}
          <div className="review-actions">
            <button
              type="button"
              onClick={() => review('REJECT')}
              disabled={busy || report === null}
            >
              반려
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => review('APPROVE')}
              disabled={busy || report?.verdict !== 'PASS'}
            >
              승인
            </button>
          </div>
          <button className="deploy" type="button" onClick={assign} disabled={busy || !approved}>
            반에 배포
          </button>
          <label className="inline-control">Rasa 힌트 사용<input type="checkbox" checked={rasaEnabled} onChange={(event)=>setRasaEnabled(event.target.checked)} /></label>
          <label>최대 힌트 단계<select value={maxHintLevel} onChange={(event)=>setMaxHintLevel(Number(event.target.value) as 1|2|3)} disabled={!rasaEnabled}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
          {assignmentId !== null ? (
            <button type="button" onClick={loadProgress} disabled={busy}>
              교사 결과 보기
            </button>
          ) : null}
        </aside>
      </div>
      {progress !== null ? <TeacherProgress items={progress} /> : null}
      <BossCampaignPanel api={api} organizationId={organizationId} classId={classId} />
      <p className="status-banner" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
