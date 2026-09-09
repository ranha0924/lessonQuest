import { createRoot } from 'react-dom/client';
import { LiveTeacherWorkspace } from '../../src/live-teacher-workspace.js';
import type { BrowserAuth, BrowserIdentity } from '../../src/firebase-browser-auth.js';
import '../../src/styles.css';
const marker = 'F02_TEST_AUTH_FIXTURE_ONLY';
const teacher: BrowserIdentity = {
  uid: marker,
  getIdToken: () => Promise.resolve(`dev_${'t'.repeat(32)}`),
};
let user: BrowserIdentity | null = sessionStorage.getItem(marker) ? teacher : null;
let notify: (identity: BrowserIdentity | null) => void = () => {};
const auth: BrowserAuth = {
  subscribe(callback) {
    notify = callback;
    callback(user);
    return () => {
      notify = () => {};
    };
  },
  isCurrent(identity) {
    return user === identity;
  },
  signIn() {
    sessionStorage.setItem(marker, 'teacher');
    user = teacher;
    notify(user);
    return Promise.resolve();
  },
  signOut() {
    sessionStorage.removeItem(marker);
    user = null;
    notify(null);
    return Promise.resolve();
  },
};
createRoot(document.getElementById('root')!).render(
  <>
    <button
      onClick={() => {
        user = {
          uid: 'F02_UNREGISTERED_FIXTURE',
          getIdToken: () => Promise.resolve(`dev_${'u'.repeat(32)}`),
        };
        notify(user);
      }}
    >
      미등록 계정으로 전환 (테스트)
    </button>
    <LiveTeacherWorkspace auth={auth} />
  </>,
);
