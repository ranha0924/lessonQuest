import { StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { DevelopmentPreview } from './development-preview.js';
import { createPreviewRuntime, type PreviewRuntime } from './runtime.js';
import { warmLessonQuestServiceWorker } from '../pwa.js';

// Resource ownership stays outside React effects: StrictMode cannot double-initialize it.
export function mountDevelopmentPreview(root: Root) {
  let runtime: PreviewRuntime | undefined;
  let starting = false;
  const start = async () => {
    if (starting) return;
    starting = true;
    root.render(
      <main className="configuration-notice">
        <h1>개발용 서비스 미리보기</h1>
        <p role="status">
          이 탭의 가상 데이터베이스를 준비하고 있습니다. 첫 실행에는 약 16 MB의 개발 자산을
          불러옵니다.
        </p>
      </main>,
    );
    try {
      const previous = runtime;
      runtime = undefined;
      await previous?.close();
      runtime = await createPreviewRuntime();
      await warmLessonQuestServiceWorker().catch(() => undefined);
      root.render(
        <StrictMode>
          <DevelopmentPreview
            key={runtime.organizationId}
            runtime={runtime}
            reset={() => {
              void start();
            }}
          />
        </StrictMode>,
      );
    } catch {
      root.render(
        <main className="configuration-notice">
          <h1>개발 미리보기를 준비하지 못했습니다.</h1>
          <p>
            실제 계정이나 데이터에는 연결하지 않았습니다. 네트워크와 WebAssembly 지원을 확인하고
            다시 준비해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              void start();
            }}
          >
            다시 준비
          </button>
        </main>,
      );
    } finally {
      starting = false;
    }
  };
  void start();
}
