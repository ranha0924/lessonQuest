import { expect, it, vi } from 'vitest';
import { readFirebaseBrowserConfiguration } from '../src/firebase-browser-auth.js';
import config from '../vite.config.js';
it('accepts only the dedicated public Firebase app and rejects partial or different project configuration', () => {
  const valid = {
    VITE_FIREBASE_PROJECT_ID: 'lessonquest-df4b0',
    VITE_FIREBASE_AUTH_DOMAIN: 'lessonquest-df4b0.firebaseapp.com',
    VITE_FIREBASE_APP_ID: '1:817389279169:web:3e16da1ed799bb22544140',
    VITE_FIREBASE_API_KEY: 'AIza' + 'a'.repeat(35),
  };
  expect(readFirebaseBrowserConfiguration(valid).projectId).toBe('lessonquest-df4b0');
  for (const altered of [
    {},
    { ...valid, VITE_FIREBASE_AUTH_DOMAIN: 'attacker.invalid' },
    { ...valid, VITE_FIREBASE_PROJECT_ID: 'other-project' },
    { ...valid, VITE_FIREBASE_APP_ID: 'wrong' },
    { ...valid, VITE_FIREBASE_API_KEY: 'secret' },
  ])
    expect(() => readFirebaseBrowserConfiguration(altered)).toThrow('로그인 연결을 준비 중입니다.');
});
it('rejects public server credential variable names and conflicting live modes before emitting artifacts', () => {
  const build = config;
  try {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'synthetic-secret-not-for-output');
    expect(() => build({ command: 'build', mode: 'production' })).toThrow(
      'Server credentials cannot be exposed to the browser',
    );
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_LIVE_MODE', 'true');
    vi.stubEnv('VITE_DEV_PREVIEW', 'true');
    expect(() => build({ command: 'build', mode: 'production' })).toThrow(
      'Live mode cannot enable synthetic modes',
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
