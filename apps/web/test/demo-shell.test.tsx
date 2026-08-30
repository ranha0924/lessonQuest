// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DemoShell } from '../src/demo-shell.js';

afterEach(cleanup);

describe('DemoShell', () => {
  it('shows the synthetic student flow and switches to teacher evidence', () => {
    render(<DemoShell />);
    expect(screen.getByText(/합성 데이터 데모/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    expect(screen.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    expect(screen.getByText(/재도전 성공/)).toBeTruthy();
    expect(screen.getByText('40 / 100')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
    expect(screen.getByRole('heading', { name: '교사 운영 화면' })).toBeTruthy();
    expect(screen.getByText(/개인 순위는 공개하지 않습니다/)).toBeTruthy();
  });
});
