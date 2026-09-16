import { useEffect, useRef, useState } from 'react';
import type { TeacherSession } from '@lessonquest/contracts';
import type { BrowserAuth, BrowserIdentity } from './firebase-browser-auth.js';
import { LessonQuestApiError } from './api-client.js';
import { createLiveSession } from './live-session.js';
import { LessonInputWorkspace } from './components/lesson-input-workspace.js';
import './live-teacher-workspace.css';
type LiveConnection = ReturnType<typeof createLiveSession>;
type State =
  | { kind: 'signed-out' }
  | { kind: 'connecting' }
  | { kind: 'error'; uid: string }
  | { kind: 'registration'; uid: string }
  | {
      kind: 'ready';
      identity: BrowserIdentity;
      session: TeacherSession;
      connection: LiveConnection;
      epoch: number;
    };
export function LiveTeacherWorkspace({
  auth,
  transport = fetch,
}: {
  readonly auth: BrowserAuth | null;
  readonly transport?: typeof fetch;
}) {
  const [state, setState] = useState<State>({ kind: 'connecting' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const epoch = useRef(0),
    connection = useRef<LiveConnection | null>(null),
    current = useRef<BrowserIdentity | null>(null);
  const loadRef = useRef<(user: BrowserIdentity | null) => void>(() => {});
  const suppress = useRef(false);
  const invalidate = () => {
    epoch.current++;
    connection.current?.dispose();
    connection.current = null;
  };
  useEffect(() => {
    if (!auth) return;
    const load = (identity: BrowserIdentity | null) => {
      invalidate();
      current.current = identity;
      setOrganizationId('');
      setMessage(null);
      if (!identity) {
        setState({ kind: 'signed-out' });
        return;
      }
      if (suppress.current) return;
      const generation = epoch.current;
      setState({ kind: 'connecting' });
      const active = createLiveSession(
        identity,
        () => epoch.current === generation && auth.isCurrent(identity),
        window.location.origin,
        transport,
      );
      connection.current = active;
      void active.api
        .getTeacherSession()
        .then((session) => {
          if (generation !== epoch.current) return;
          setOrganizationId(session.organizations[0]?.id ?? '');
          setState({ kind: 'ready', identity, session, connection: active, epoch: generation });
        })
        .catch((error: unknown) => {
          if (generation !== epoch.current) return;
          active.dispose();
          setState({
            kind:
              error instanceof LessonQuestApiError && [401, 403].includes(error.status)
                ? 'registration'
                : 'error',
            uid: identity.uid,
          });
        });
    };
    loadRef.current = load;
    const unsubscribe = auth.subscribe(load);
    return () => {
      unsubscribe();
      invalidate();
      loadRef.current = () => {};
    };
  }, [auth, transport]);
  const login = async () => {
    if (!auth) return;
    setBusy(true);
    setMessage(null);
    suppress.current = false;
    try {
      await auth.signIn();
    } catch {
      setMessage('Google 로그인을 완료하지 못했습니다. 팝업과 연결 상태를 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (!auth) return;
    suppress.current = true;
    invalidate();
    current.current = null;
    setOrganizationId('');
    setState({ kind: 'signed-out' });
    setBusy(true);
    setMessage(null);
    try {
      await auth.signOut();
      suppress.current = false;
    } catch {
      setMessage('로그아웃을 완료하지 못했습니다. 다시 로그아웃해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  const approved =
    state.kind === 'ready'
      ? state.session.organizations.find((org) => org.id === organizationId)
      : undefined;
  return (
    <main className="live-teacher-workspace">
      <header className="live-teacher-workspace__header">
        <div>
          <p>LESSONQUEST STUDIO</p>
          <h1>수업을 준비하는 나의 공간</h1>
        </div>
        {auth && state.kind !== 'signed-out' ? (
          <button type="button" disabled={busy} onClick={() => void logout()}>
            로그아웃
          </button>
        ) : null}
      </header>
      {!auth ? (
        <section className="live-teacher-workspace__card">
          <h2>로그인 연결을 준비 중입니다.</h2>
          <p>연결이 준비되면 Google 계정으로 수업 자료를 저장할 수 있습니다.</p>
        </section>
      ) : state.kind === 'signed-out' ? (
        <section className="live-teacher-workspace__card">
          <h2>선생님의 수업, 여기서 시작해요</h2>
          <p>등록된 교사 계정으로 로그인하면 저장한 수업 자료를 이어서 준비할 수 있습니다.</p>
          <button className="primary" disabled={busy} onClick={() => void login()}>
            Google로 교사 로그인
          </button>
          {suppress.current ? (
            <button disabled={busy} onClick={() => void logout()}>
              다시 로그아웃
            </button>
          ) : null}
        </section>
      ) : state.kind === 'connecting' ? (
        <p role="status">교사 계정과 수업 공간을 확인하고 있습니다.</p>
      ) : state.kind === 'registration' ? (
        <section className="live-teacher-workspace__card">
          <h2>계정 등록 상태를 확인해 주세요.</h2>
          <p>
            등록되지 않았거나 로그인 권한을 확인할 수 없습니다. 운영자에게 아래 등록 ID를 전달해
            주세요.
          </p>
          <p>
            등록 ID: <code>{state.uid}</code>
          </p>
          <button onClick={() => loadRef.current(current.current)}>등록 상태 다시 확인</button>
        </section>
      ) : state.kind === 'error' ? (
        <section className="live-teacher-workspace__card">
          <h2>서버에 연결하지 못했습니다.</h2>
          <p>잠시 후 다시 시도해 주세요.</p>
          <button onClick={() => loadRef.current(current.current)}>다시 연결</button>
        </section>
      ) : (
        <>
          {state.session.organizations.length === 0 ? (
            <p role="status">
              아직 승인된 수업 공간이 없습니다. 운영자에게 공간 등록을 요청해 주세요.
            </p>
          ) : (
            <label className="live-teacher-workspace__spaces">
              수업 공간
              <select
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {state.session.organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {approved ? (
            <LessonInputWorkspace
              key={`${state.epoch}:${approved.id}`}
              api={state.connection.api}
              organizationId={approved.id}
            />
          ) : null}
        </>
      )}
      {message ? <p role="alert">{message}</p> : null}
      <footer>AI 생성은 결제 연동이 준비된 뒤 이용할 수 있습니다.</footer>
    </main>
  );
}
