import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import exitHook from 'async-exit-hook';
import EmbeddedPostgres from 'embedded-postgres';

// The harness owns its cluster and credentials; never use a service DATABASE_URL.
process.umask(0o077);
for (const key of Object.keys(process.env)) {
  if (key.startsWith('PG')) delete process.env[key];
}
let directory;
let postgres;
let child;
let interrupted = 0;
const signals = new Map([
  ['SIGHUP', 129],
  ['SIGINT', 130],
  ['SIGTERM', 143],
]);
const handlers = new Map();
for (const [signal, code] of signals) {
  // The upstream signal hook exits before our finally can clean up. This process
  // owns the signal lifecycle; retain the library's exit/beforeExit safety hooks.
  exitHook.unhookEvent(signal);
  const handler = () => {
    interrupted = code;
    child?.kill('SIGTERM');
  };
  handlers.set(signal, handler);
  process.on(signal, handler);
}
const requireRunning = () => {
  if (interrupted) throw new Error('Interrupted');
};
try {
  directory = await mkdtemp(join(tmpdir(), 'lessonquest-postgres-'));
  const socket = createServer();
  const port = await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close((error) => {
        if (error || !address || typeof address === 'string') reject(new Error('Port unavailable'));
        else resolve(address.port);
      });
    });
  });
  requireRunning();
  const password = randomBytes(24).toString('hex');
  const database = `lessonquest_test_${randomBytes(12).toString('hex')}`;
  postgres = new EmbeddedPostgres({
    databaseDir: join(directory, 'data'),
    user: 'lessonquest_test',
    password,
    port,
    persistent: true,
    authMethod: 'scram-sha-256',
    createPostgresUser: false,
    initdbFlags: ['--locale=C', '--encoding=UTF8'],
    postgresFlags: [
      '-c',
      'listen_addresses=127.0.0.1',
      '-c',
      `unix_socket_directories=${directory}`,
    ],
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  requireRunning();
  await postgres.start();
  requireRunning();
  const admin = postgres.getPgClient('postgres', '127.0.0.1');
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${database}`);
  } finally {
    await admin.end();
  }
  requireRunning();
  const env = {
    PATH: process.env.PATH,
    CI: 'true',
    LESSONQUEST_POSTGRES_TEST: 'owned-disposable',
    LESSONQUEST_POSTGRES_TEST_URL: `postgresql://lessonquest_test:${password}@127.0.0.1:${port}/${database}`,
  };
  process.exitCode = await new Promise((resolve, reject) => {
    child = spawn(
      process.execPath,
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        '--config',
        'vitest.postgres.config.ts',
        ...process.argv.slice(2),
      ],
      { env, stdio: 'inherit' },
    );
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch {
  // PostgreSQL diagnostics may contain SQL or connection details.
  process.stderr.write('Disposable PostgreSQL verification failed.\n');
  process.exitCode = 1;
} finally {
  await postgres?.stop();
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
  for (const [signal, handler] of handlers) process.off(signal, handler);
}
// Pass the test/interrupt result explicitly to the upstream exit hook.
process.exit(interrupted || process.exitCode || 0);
