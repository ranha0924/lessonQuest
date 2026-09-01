// Disposable test server: serve the built preview with the checked-in Vercel headers.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { URL } from 'node:url';

const directory = resolve('apps/web/dist-preview');
const normalDirectory = resolve('apps/web/dist-normal-check');
const configuration = JSON.parse(await readFile('vercel.json', 'utf8'));
const headers = Object.fromEntries(
  configuration.headers[0].headers.map(({ key, value }) => [key, value]),
);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};
createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, 'http://127.0.0.1:4179');
    const pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/health') {
      response.writeHead(200, {
        ...headers,
        'content-type': 'text/plain',
        'cache-control': 'no-store',
      });
      response.end('SENSITIVE HEALTH SENTINEL');
      return;
    }
    if (pathname === '/organizations/private/report') {
      const authorized = request.headers.cookie?.includes('lessonquest_private=1') === true;
      response.writeHead(authorized ? 200 : 401, {
        ...headers,
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(authorized ? { student: 'private' } : { error: 'unauthorized' }));
      return;
    }
    if (pathname === '/redirect-static.js') {
      response.writeHead(302, { location: 'http://127.0.0.1:4180/cross-origin-static.js' });
      response.end();
      return;
    }
    const selectedDirectory = pathname.startsWith('/normal-build/') ? normalDirectory : directory;
    const selectedPath = pathname.startsWith('/normal-build/')
      ? pathname.slice('/normal-build'.length)
      : pathname;
    let file = resolve(selectedDirectory, `.${selectedPath}`);
    if (file !== selectedDirectory && !file.startsWith(`${selectedDirectory}/`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) file = resolve(selectedDirectory, 'index.html');
    } catch {
      file = resolve(selectedDirectory, 'index.html');
    }
    // The production CSP already blocks cross-origin connections. Relax only the
    // disposable test harness and worker so the response-origin cache guard is
    // exercised independently as defense in depth.
    const responseHeaders =
      requestUrl.searchParams.has('cross-origin-cache-test') || pathname === '/service-worker.js'
        ? {
            ...headers,
            'Content-Security-Policy': headers['Content-Security-Policy'].replace(
              "connect-src 'self'",
              "connect-src 'self' http://127.0.0.1:4180",
            ),
          }
        : headers;
    response.writeHead(200, {
      ...responseHeaders,
      'content-type': mime[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500).end();
  }
}).listen(4179, '127.0.0.1');

createServer((request, response) => {
  if (request.url !== '/cross-origin-static.js') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'access-control-allow-origin': '*',
    'content-type': 'text/javascript',
    'cache-control': 'no-store',
  });
  response.end('CROSS_ORIGIN_STATIC');
}).listen(4180, '127.0.0.1');
