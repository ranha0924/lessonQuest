/* global self, caches, URL, fetch, Response, Request */

const CACHE_PREFIX = 'lessonquest-shell-';
const CACHE_NAME = `${CACHE_PREFIX}2026-09-01-v2`;
const PRECACHE = ['/', '/manifest.webmanifest', '/pwa-icon.svg'];
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest', 'worker']);

function isApiPath(pathname) {
  return (
    pathname === '/health' || pathname.startsWith('/organizations/') || pathname.startsWith('/api/')
  );
}

function canCacheNavigationRequest(request) {
  if (request.method !== 'GET' || request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && !isApiPath(url.pathname);
}

function canCacheRequest(request) {
  if (request.method !== 'GET' || request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiPath(url.pathname)) return false;
  return (
    STATIC_DESTINATIONS.has(request.destination) ||
    /\.(?:js|css|svg|png|webp|woff2?|wasm|data|webmanifest)$/.test(url.pathname)
  );
}

function canCacheResponse(response) {
  if (!response.ok || response.type === 'opaque' || response.type === 'error') return false;
  try {
    const finalUrl = new URL(response.url);
    return finalUrl.origin === self.location.origin && !isApiPath(finalUrl.pathname);
  } catch {
    return false;
  }
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  for (const value of PRECACHE) {
    const request = new Request(value, { credentials: 'same-origin' });
    const response = await fetch(request);
    if (!canCacheResponse(response)) {
      throw new Error(`Unsafe shell response: ${new URL(request.url).pathname}`);
    }
    await cache.put(request, response);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode === 'navigate') {
    if (!canCacheNavigationRequest(request)) return;
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (canCacheResponse(response)) {
            await (await caches.open(CACHE_NAME)).put('/', response.clone());
          }
          return response;
        })
        .catch(async () => (await (await caches.open(CACHE_NAME)).match('/')) ?? Response.error()),
    );
    return;
  }
  if (!canCacheRequest(request)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached !== undefined) return cached;
      const response = await fetch(request);
      if (canCacheResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_STATIC_URLS' || !Array.isArray(event.data.urls)) return;
  const work = caches.open(CACHE_NAME).then(async (cache) => {
    for (const value of event.data.urls.slice(0, 100)) {
      if (typeof value !== 'string') continue;
      try {
        const request = new Request(value, { credentials: 'same-origin' });
        if (!canCacheRequest(request)) continue;
        const response = await fetch(request);
        if (canCacheResponse(response)) await cache.put(request, response);
      } catch {
        // A single unavailable optional asset must not block warming the rest of the shell.
      }
    }
  });
  event.waitUntil(
    work.finally(() => {
      event.ports[0]?.postMessage({ complete: true });
    }),
  );
});
