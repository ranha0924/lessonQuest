import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
export interface BrowserIdentity {
  readonly uid: string;
  getIdToken(): Promise<string>;
}
export interface BrowserAuth {
  subscribe(callback: (user: BrowserIdentity | null) => void): () => void;
  isCurrent(user: BrowserIdentity): boolean;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
export function readFirebaseBrowserConfiguration(environment: Record<string, unknown>) {
  const projectId = environment['VITE_FIREBASE_PROJECT_ID'];
  const authDomain = environment['VITE_FIREBASE_AUTH_DOMAIN'];
  const appId = environment['VITE_FIREBASE_APP_ID'];
  const apiKey = environment['VITE_FIREBASE_API_KEY'];
  if (
    projectId !== 'lessonquest-df4b0' ||
    authDomain !== 'lessonquest-df4b0.firebaseapp.com' ||
    appId !== '1:817389279169:web:3e16da1ed799bb22544140' ||
    typeof apiKey !== 'string' ||
    !/^AIza[\w-]{35}$/.test(apiKey)
  )
    throw new Error('로그인 연결을 준비 중입니다.');
  return { projectId, authDomain, appId, apiKey };
}
export function createFirebaseBrowserAuth(environment: Record<string, unknown>): BrowserAuth {
  const app = initializeApp(readFirebaseBrowserConfiguration(environment), 'lessonquest-live');
  const auth = initializeAuth(app, {
    persistence: browserSessionPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  const bindings = new WeakMap<BrowserIdentity, NonNullable<typeof auth.currentUser>>();
  return {
    subscribe(callback) {
      return onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            callback(null);
            return;
          }
          const identity: BrowserIdentity = { uid: user.uid, getIdToken: () => user.getIdToken() };
          bindings.set(identity, user);
          callback(identity);
        },
        () => callback(null),
      );
    },
    isCurrent(identity) {
      return auth.currentUser !== null && bindings.get(identity) === auth.currentUser;
    },
    async signIn() {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch {
        throw new Error('Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.');
      }
    },
    async signOut() {
      try {
        await signOut(auth);
      } catch {
        throw new Error('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.');
      }
    },
  };
}
