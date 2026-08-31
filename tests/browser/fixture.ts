import { expect, test as base } from '@playwright/test';

// Install containment before handing a page to any test, including its first navigation.
// A blocked request remains evidence of a regression; blocking alone is not a pass.
export const test = base.extend({
  page: async ({ page, context, baseURL }, use) => {
    if (baseURL !== 'http://127.0.0.1:4178') throw new Error('Only the managed demo is allowed');
    const externalRequests: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const isLocal = (url: string) => new URL(url).origin === baseURL;

    context.on('request', (request) => {
      if (!isLocal(request.url())) externalRequests.push(request.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await context.route('**/*', async (route) => {
      if (isLocal(route.request().url())) await route.continue();
      else await route.abort('blockedbyclient');
    });
    await context.routeWebSocket(/.*/, async (socket) => {
      externalRequests.push(`Unexpected WebSocket: ${socket.url()}`);
      await socket.close();
    });

    await use(page);

    expect(externalRequests, 'The synthetic demo must never attempt external traffic').toEqual([]);
    expect(pageErrors, 'The rendered demo must not throw JavaScript errors').toEqual([]);
    expect(consoleErrors, 'The rendered demo must not log console errors').toEqual([]);
  },
});

export { expect } from '@playwright/test';
