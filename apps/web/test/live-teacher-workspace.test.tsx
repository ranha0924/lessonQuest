// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveTeacherWorkspace } from '../src/live-teacher-workspace.js';
import type { BrowserIdentity, BrowserAuth } from '../src/firebase-browser-auth.js';
const user = {
  uid: 'explicit-synthetic-uid',
  getIdToken: () => Promise.resolve('synthetic-token'),
};
const session = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d101',
  organizations: [{ id: '018f72a4-cc52-7c5a-a6f9-8b21aa27d111', name: '내 수업 공간' }],
  aiGeneration: 'AI_BILLING_NOT_CONFIGURED',
};
function authFixture() {
  let current: BrowserIdentity | null = null;
  let notify: (user: BrowserIdentity | null) => void = () => {};
  const auth: BrowserAuth = {
    subscribe(callback) {
      notify = callback;
      callback(current);
      return () => {
        notify = () => {};
      };
    },
    isCurrent(identity) {
      return current === identity;
    },
    signIn() {
      current = user;
      notify(current);
      return Promise.resolve();
    },
    signOut() {
      current = null;
      notify(null);
      return Promise.resolve();
    },
  };
  return {
    auth,
    switchUser(value: BrowserIdentity | null) {
      current = value;
      notify(value);
    },
  };
}
afterEach(cleanup);
it('shows setup without leaking configuration and unknown teacher registration without an editor', async () => {
  const first = render(<LiveTeacherWorkspace auth={null} />);
  expect(screen.getByText(/로그인 연결을 준비/)).toBeTruthy();
  first.unmount();
  const { auth } = authFixture();
  render(
    <LiveTeacherWorkspace
      auth={auth}
      transport={() =>
        Promise.resolve(
          Response.json(
            { error: { code: 'AUTHENTICATION_REQUIRED', message: 'denied' } },
            { status: 401 },
          ),
        )
      }
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Google로 교사 로그인' }));
  await screen.findByText(user.uid);
  expect(screen.queryByLabelText('학습 내용')).toBeNull();
});
it('opens only approved spaces, keeps AI disabled and clears editor immediately on logout', async () => {
  const fixture = authFixture();
  const transport = vi.fn<typeof fetch>((input) =>
    Promise.resolve(
      Response.json(
        new URL(input instanceof Request ? input.url : String(input)).pathname === '/api/session'
          ? session
          : [],
      ),
    ),
  );
  render(<LiveTeacherWorkspace auth={fixture.auth} transport={transport} />);
  fireEvent.click(screen.getByRole('button', { name: 'Google로 교사 로그인' }));
  await screen.findByLabelText('학습 내용');
  expect(screen.getByRole('button', { name: 'AI 초안 생성' })).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('학습 내용'), { target: { value: '지워져야 하는 내용' } });
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
  expect(screen.queryByDisplayValue('지워져야 하는 내용')).toBeNull();
  await screen.findByRole('button', { name: 'Google로 교사 로그인' });
});
it('discards old session result after account switch and unmount', async () => {
  const fixture = authFixture();
  let old!: (value: Response) => void;
  const transport: typeof fetch = (_input, init) =>
    new Headers(init?.headers).get('authorization') === 'Bearer synthetic-token'
      ? new Promise((r) => {
          old = r;
        })
      : Promise.resolve(
          Response.json(
            { error: { code: 'AUTHENTICATION_REQUIRED', message: 'denied' } },
            { status: 401 },
          ),
        );
  const view = render(<LiveTeacherWorkspace auth={fixture.auth} transport={transport} />);
  fireEvent.click(screen.getByRole('button', { name: 'Google로 교사 로그인' }));
  await vi.waitFor(() => expect(old).toBeTypeOf('function'));
  act(() =>
    fixture.switchUser({ uid: 'another-uid', getIdToken: () => Promise.resolve('another-token') }),
  );
  await screen.findByText('another-uid');
  await act(async () => {
    old(Response.json(session));
    await Promise.resolve();
  });
  expect(screen.queryByLabelText('학습 내용')).toBeNull();
  expect(screen.queryByText('내 수업 공간')).toBeNull();
  view.unmount();
});
