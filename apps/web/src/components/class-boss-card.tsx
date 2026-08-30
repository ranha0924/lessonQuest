import type { StudentBossProgress } from '@lessonquest/contracts';
export function ClassBossCard({ progress }: { readonly progress: StudentBossProgress }) {
  if (progress === null) return null;
  const percent = Math.max(0, Math.min(100, Math.round(progress.damage / progress.targetHp * 100)));
  return <section className="boss-card" aria-labelledby="boss-title"><p className="panel-kicker">CLASS BOSS</p><h2 id="boss-title">{progress.title}</h2><p><strong>{progress.damage} / {progress.targetHp}</strong></p><progress max={100} value={percent} aria-label={`반 전체 보스 진행도 ${percent}%`} /><p>{progress.completed ? '우리 반이 함께 보스를 물리쳤어요!' : `반 전체 진행도 ${percent}%`}</p></section>;
}
