import type { Page, TestInfo } from '@playwright/test';

import { expect, test } from './fixture.js';
import { measureDemo } from './measurements.js';

async function assertKeyboardFocus(page: Page) {
  const controls = page.locator('.demo-shell button:enabled, .demo-shell a[href]');
  const count = await controls.count();
  const visited = new Set<number>();
  // Start wherever the preceding interaction left focus. The extra tabs allow
  // Chromium's browser-chrome slot when wrapping from the last control.
  for (let index = 0; index < count + 2; index += 1) {
    await page.keyboard.press('Tab');
    const focused = await controls.evaluateAll((elements) =>
      elements.findIndex((element) => element === document.activeElement),
    );
    if (focused < 0) continue;
    visited.add(focused);
    const focus = await controls.nth(focused).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        visible: element.matches(':focus-visible'),
        width: style.outlineWidth,
        style: style.outlineStyle,
        color: style.outlineColor,
      };
    });
    expect(focus).toEqual({
      visible: true,
      width: '4px',
      style: 'solid',
      color: 'rgb(255, 200, 90)',
    });
  }
  expect(visited.size, 'Every enabled control is reachable with Tab').toBe(count);
}

async function assertState(page: Page, testInfo: TestInfo, state: string) {
  const measurements = await measureDemo(page);
  await testInfo.attach(`${state}-measurements`, {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  });
  console.info(
    JSON.stringify({
      state,
      viewport: measurements.width,
      targets: measurements.targets.length,
      surfaces: measurements.surfaces.length,
      contrasts: measurements.contrasts.length,
      minimumTarget: Math.min(
        ...measurements.targets.map((target) => Math.min(target.width, target.height)),
      ),
      minimumContrast: Math.min(...measurements.contrasts.map((contrast) => contrast.ratio)),
      maximumSurfaceLuminance: Math.max(
        ...measurements.surfaces.map((surface) => surface.luminance),
      ),
      violations: measurements.violations,
    }),
  );
  expect(measurements.targets.length, `${state}: controls were measured`).toBeGreaterThanOrEqual(2);
  expect(measurements.surfaces.length, `${state}: surfaces were measured`).toBeGreaterThanOrEqual(
    5,
  );
  expect(
    measurements.contrasts.length,
    `${state}: critical text was measured`,
  ).toBeGreaterThanOrEqual(10);
  expect
    .soft(measurements.violations, `${state}: geometry, dark surfaces and critical contrast`)
    .toEqual([]);
  await assertKeyboardFocus(page);
}

test('student journey, teacher switch and reset keep usable geometry and contrast', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '힘과 운동 탐험' })).toBeVisible();
  await assertState(page, testInfo, 'initial');

  await page.getByRole('button', { name: '탐험 계속하기' }).click();
  await expect(page.getByRole('button', { name: '질량 2 kg 선택' })).toBeVisible();
  await assertState(page, testInfo, 'started');

  await page.getByRole('button', { name: '질량 6 kg 선택' }).click();
  await expect(page.getByText('좋은 시도예요. 단서를 살펴보고 다시 골라 보세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '힌트 받기' })).toBeEnabled();
  await assertState(page, testInfo, 'wrong');

  await page.getByRole('button', { name: '힌트 받기' }).click();
  await expect(
    page.getByText('문제에서 무엇이 계속 유지되는지 먼저 찾아보자.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '힌트를 모두 사용했어요' })).toBeDisabled();
  await assertState(page, testInfo, 'hinted');

  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await expect(page.getByText('재도전 성공 · 탐험 완료')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '반 전체 보스 진행도 40%' })).toHaveAttribute(
    'value',
    '40',
  );
  await assertState(page, testInfo, 'completed');

  await page.getByRole('button', { name: '교사 화면', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '교사 운영 화면' })).toBeVisible();
  await expect(page.getByText('개인 순위는 공개하지 않습니다.')).toBeVisible();
  await assertState(page, testInfo, 'teacher');

  await page.getByRole('button', { name: '학생 화면', exact: true }).click();
  await expect(page.getByRole('button', { name: '탐험 계속하기' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '반 전체 보스 진행도 32%' })).toHaveAttribute(
    'value',
    '32',
  );
  await expect(page.getByText('재도전 성공 · 탐험 완료')).toHaveCount(0);
  await assertState(page, testInfo, 'role-reset');

  await page.getByRole('button', { name: '탐험 계속하기' }).click();
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '탐험 계속하기' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '반 전체 보스 진행도 32%' })).toHaveAttribute(
    'value',
    '32',
  );
  await expect(page.getByText('재도전 성공 · 탐험 완료')).toHaveCount(0);
  await assertState(page, testInfo, 'reload-reset');
});

test('keyboard reaches controls with a visible focus ring and fragment links reach their sections', async ({
  page,
}) => {
  await page.goto('/');
  await assertKeyboardFocus(page);

  for (const [name, destination] of [
    ['성장 기록', 'growth-summary'],
    ['우리 반', 'class-boss'],
    ['내 미션', 'student-mission'],
    ['대시보드', 'student-mission'],
    ['LessonQuest', 'student-mission'],
  ] as const) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', `#${destination}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${destination}$`));
    await expect(page.locator(`#${destination}`)).toBeInViewport();
  }
});

async function assertReducedMotion(page: Page) {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  const motion = await page.locator('.demo-shell, .demo-shell *').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const result: string[] = [];
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo);
        if (
          style.animationName !== 'none' ||
          style.transitionDuration.split(',').some((value) => parseFloat(value) !== 0) ||
          style.scrollBehavior !== 'auto'
        ) {
          result.push(
            `${element.tagName}.${element.classList.value}${pseudo ?? ''}: ${style.animationName}/${style.transitionDuration}/${style.scrollBehavior}`,
          );
        }
      }
      return result;
    }),
  );
  expect(motion).toEqual([]);
  const controls = page.locator('.demo-shell button:enabled, .demo-shell a[href]');
  for (const control of await controls.all()) {
    await control.hover();
    expect
      .soft(await control.evaluate((element) => getComputedStyle(element).transform))
      .toBe('none');
  }
}

test('reduced motion removes animation, transitions and hover movement in every state', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.demo-trajectory svg')).toHaveCSS(
    'animation-name',
    'trajectory-enter',
  );
  await page.getByRole('button', { name: '탐험 계속하기' }).hover();
  await expect(page.getByRole('button', { name: '탐험 계속하기' })).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, -2, -2)',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '탐험 계속하기' }).click();
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '질량 6 kg 선택' }).click();
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '힌트 받기' }).click();
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '질량 2 kg 선택' }).click();
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '교사 화면', exact: true }).click();
  await assertReducedMotion(page);
  await page.getByRole('button', { name: '학생 화면', exact: true }).click();
  await assertReducedMotion(page);
  await page.reload();
  await assertReducedMotion(page);
});

test('the same measurements reject injected target-size and contrast regressions', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  const baseline = await measureDemo(page);
  expect.soft(baseline.violations).toEqual([]);
  const fault = await page.addStyleTag({
    content: `
    .demo-shell .demo-primary { min-height: 20px !important; height: 20px !important; padding: 0 !important; }
    .demo-shell .demo-student-header .eyebrow { color: rgb(5, 8, 23) !important; }
  `,
  });
  try {
    const measured = await measureDemo(page);
    console.info(JSON.stringify({ controlledFaults: measured.violations }));
    await testInfo.attach('controlled-fault-measurements', {
      body: JSON.stringify(measured, null, 2),
      contentType: 'application/json',
    });
    expect(measured.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'target', measured: 20 }),
        expect.objectContaining({ kind: 'contrast', element: expect.stringContaining('eyebrow') }),
      ]),
    );
  } finally {
    await fault.evaluate((element) => {
      element.parentNode?.removeChild(element);
    });
  }
  expect((await measureDemo(page)).violations).toEqual([]);
});
