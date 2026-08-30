// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DemoShell } from '../src/demo-shell.js';

afterEach(cleanup);

describe('DemoShell', () => {
  it('uses one dark theme contract across student and teacher views', () => {
    const { container } = render(<DemoShell />);
    const shell = container.querySelector('.demo-shell');
    expect(shell?.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
    expect(screen.getByRole('heading', { name: '교사 운영 화면' }).closest('.demo-shell')).toBe(
      shell,
    );
  });

  it('presents a synthetic student home without public comparison', () => {
    render(<DemoShell />);
    expect(screen.getByText(/합성 데이터 데모/)).toBeTruthy();
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '힘과 운동 탐험' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '탐험 계속하기' })).toBeTruthy();
    expect(screen.getByText('32 / 100')).toBeTruthy();
    expect(screen.queryByText(/상위|순위|마켓/)).toBeNull();
  });

  it('resumes the mission and turns a retry into aggregate boss progress', () => {
    render(<DemoShell />);
    fireEvent.click(screen.getByRole('button', { name: '탐험 계속하기' }));
    fireEvent.click(screen.getByRole('button', { name: '질량 6 kg 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '힌트 받기' }));
    expect(screen.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '질량 2 kg 선택' }));
    expect(screen.getByText(/재도전 성공/)).toBeTruthy();
    expect(screen.getByText('40 / 100')).toBeTruthy();
  });

  it('keeps the existing teacher evidence switch', () => {
    render(<DemoShell />);
    fireEvent.click(screen.getByRole('button', { name: '교사 화면' }));
    expect(screen.getByRole('heading', { name: '교사 운영 화면' })).toBeTruthy();
    expect(screen.getByText(/개인 순위는 공개하지 않습니다/)).toBeTruthy();
  });
});
