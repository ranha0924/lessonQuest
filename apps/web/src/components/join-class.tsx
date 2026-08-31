import { useEffect, useRef, useState } from 'react';
import type { ClassroomApi } from '../api-client.js';
import '../classrooms.css';

export function JoinClass({
  api,
  organizationId,
  onJoined,
}: {
  readonly api: ClassroomApi;
  readonly organizationId: string;
  readonly onJoined: () => void;
}) {
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setCode('');
    setError('');
    setMessage('');
    setBusy(false);
    return () => {
      epoch.current++;
    };
  }, [api, organizationId]);
  return (
    <section className="classroom-join panel" aria-label="초대로 반 참여">
      <h2>우리 반에 합류하기</h2>
      <p>선생님에게 받은 초대 코드를 입력하세요.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          const current = epoch.current;
          setBusy(true);
          setError('');
          setMessage('');
          void api
            .redeemClassInvitation(organizationId, { code: code.trim() })
            .then((result) => {
              if (epoch.current !== current) return;
              setCode('');
              setMessage(`${result.className}에 참여했습니다.`);
              onJoined();
            })
            .catch(() => {
              if (epoch.current === current)
                setError(
                  '참여 결과를 확인하지 못했습니다. 코드를 확인하고 다시 시도해 주세요. 만료·취소된 코드는 선생님에게 새로 받아 주세요.',
                );
            })
            .finally(() => {
              if (epoch.current === current) setBusy(false);
            });
        }}
      >
        <label>
          초대 코드
          <input
            value={code}
            maxLength={68}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || code.trim() === ''}>
          {busy ? '참여 확인 중' : '반 참여하기'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
