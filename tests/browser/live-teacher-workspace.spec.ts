import { expect, test } from '@playwright/test';
test('teacher fixture saves, reloads, signs out and reopens a server lesson with AI blocked', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Google로 교사 로그인' }).click();
  await expect(page.getByLabel('학습 내용')).toBeVisible();
  const title = `브라우저 수업 ${test.info().project.name}`;
  await page.getByLabel('수업 제목', { exact: true }).fill(title);
  await page.getByLabel('대상 학년', { exact: true }).selectOption('middle1');
  await page.getByLabel('학습 내용', { exact: true }).fill('합성 힘과 운동 자료');
  await page.getByLabel('학습목표 (한 줄에 하나)', { exact: true }).fill('힘의 효과를 설명한다.');
  await page.getByRole('button', { name: '수업 자료 저장', exact: true }).click();
  await expect(page.getByText('수업 자료를 저장했습니다. 개정 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 초안 생성' })).toBeDisabled();
  await page.reload();
  await page
    .getByLabel('저장된 수업 자료', { exact: true })
    .selectOption({ label: title + ' · 개정 1' });
  await page.getByRole('button', { name: '수업 자료 다시 열기' }).click();
  await expect(page.getByLabel('학습 내용', { exact: true })).toHaveValue('합성 힘과 운동 자료');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByLabel('학습 내용')).toHaveCount(0);
  await page.getByRole('button', { name: 'Google로 교사 로그인' }).click();
  await expect(page.getByRole('option', { name: title + ' · 개정 1' })).toHaveCount(1);
  await page.getByRole('button', { name: '미등록 계정으로 전환 (테스트)' }).click();
  await expect(page.getByText('F02_UNREGISTERED_FIXTURE', { exact: true })).toBeVisible();
  await expect(page.getByLabel('학습 내용')).toHaveCount(0);
  const anonymous = await page.request.get('/api/session');
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()['cache-control']).toBe('no-store');
  expect(errors).toEqual([]);
});
test('ordinary live bundle ignores injected legacy sessions and shows safe missing Firebase configuration', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.assign(window, {
      lessonQuestSession: {
        authorization: 'Bearer injected-test-session',
        role: 'TEACHER',
        organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d111',
        classId: '018f72a4-cc52-7c5a-a6f9-8b21aa27d112',
      },
    });
  });
  await page.goto('/live-build/');
  await expect(page.getByRole('heading', { name: '로그인 연결을 준비 중입니다.' })).toBeVisible();
  await expect(page.getByLabel('학습 내용')).toHaveCount(0);
  await expect(page.getByText('개발용 서비스 미리보기', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
