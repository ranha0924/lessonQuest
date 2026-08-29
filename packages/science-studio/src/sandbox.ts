import type { ScienceArtifact } from './artifact.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBlock(block: ScienceArtifact['specification']['blocks'][number]): string {
  switch (block.kind) {
    case 'CONCEPT_CARD':
      return `<section><p class="eyebrow">개념 카드</p><h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.body)}</p></section>`;
    case 'PREDICTION':
      return `<section><p class="eyebrow">예상</p><h2>${escapeHtml(block.prompt)}</h2><ul>${block.choices.map(({ label }) => `<li>${escapeHtml(label)}</li>`).join('')}</ul></section>`;
    case 'SIMULATION': {
      const acceleration = block.parameters.forceN / block.parameters.massKg;
      const distance = 0.5 * acceleration * block.parameters.durationSec ** 2;
      return `<section><p class="eyebrow">실험</p><h2>${escapeHtml(block.prompt)}</h2><div class="meter"><strong>${distance.toFixed(1)} m</strong><span>예상 이동 거리</span></div></section>`;
    }
    case 'QUIZ':
      return `<section><p class="eyebrow">퀘즈</p><h2>${escapeHtml(block.question)}</h2><ol>${block.options.map(({ label }) => `<li>${escapeHtml(label)}</li>`).join('')}</ol></section>`;
    case 'REFLECTION':
      return `<section><p class="eyebrow">성찰</p><h2>${escapeHtml(block.prompt)}</h2><div class="reflection" aria-hidden="true"></div></section>`;
  }
}

export function buildScienceSandboxDocument(artifact: ScienceArtifact): string {
  const title = escapeHtml(artifact.specification.title);
  const blocks = artifact.specification.blocks.map((block) => renderBlock(block)).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:;"><title>${title}</title><style>html{color:#10233f;background:#dff3ff;font-family:system-ui,sans-serif}body{max-width:760px;margin:auto;padding:24px}header,section{background:#fff;border:2px solid #10233f;border-radius:20px;padding:20px;margin:16px 0;box-shadow:6px 6px 0 #2457d6}.eyebrow{color:#2457d6;font-weight:800;letter-spacing:.08em}.meter{display:flex;gap:12px;align-items:baseline}.meter strong{font-size:2rem;color:#f0645a}.reflection{height:72px;border-bottom:2px dashed #2457d6}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><header><p class="eyebrow">LESSONQUEST SCIENCE</p><h1>${title}</h1></header><main>${blocks}</main></body></html>`;
}
