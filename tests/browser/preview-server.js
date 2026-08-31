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
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1:4179').pathname);
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
    response.writeHead(200, {
      ...headers,
      'content-type': mime[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500).end();
  }
}).listen(4179, '127.0.0.1');
