let registrationPromise: Promise<ServiceWorkerRegistration | null> | undefined;

export function registerLessonQuestServiceWorker(
  enabled: boolean,
): Promise<ServiceWorkerRegistration | null> {
  if (!enabled || !('serviceWorker' in navigator)) return Promise.resolve(null);
  registrationPromise ??= navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  return registrationPromise;
}

export async function warmLessonQuestServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registered = await registrationPromise;
  if (registered === null || registered === undefined) return;
  const registration =
    registered.active === null ? await navigator.serviceWorker.ready : registered;
  const worker = registration.active;
  if (worker === null) return;
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType('resource')) urls.add(entry.name);
  for (const element of document.querySelectorAll('script[src],link[href],img[src]')) {
    const value =
      element instanceof HTMLScriptElement || element instanceof HTMLImageElement
        ? element.src
        : element instanceof HTMLLinkElement
          ? element.href
          : '';
    if (value !== '') urls.add(value);
  }
  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(resolve, 5_000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    worker.postMessage({ type: 'CACHE_STATIC_URLS', urls: [...urls] }, [channel.port2]);
  });
}
