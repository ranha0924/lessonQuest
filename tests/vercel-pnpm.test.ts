import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('uses the pinned project manager for nested pnpm even when the platform PATH has a stale binary', async () => {
  const root = process.cwd();
  const { packageManager } = JSON.parse(await readFile('package.json', 'utf8')) as {
    packageManager: string;
  };
  const fixture = await mkdtemp(path.join(tmpdir(), 'lessonquest-pnpm-boundary-'));
  try {
    const stale = path.join(fixture, 'stale-bin');
    await mkdir(stale);
    await writeFile(path.join(stale, 'pnpm'), '#!/bin/sh\necho STALE_PLATFORM_PNPM >&2\nexit 42\n');
    await chmod(path.join(stale, 'pnpm'), 0o700);
    await writeFile(
      path.join(fixture, 'package.json'),
      JSON.stringify({ private: true, packageManager, scripts: { nested: 'pnpm --version' } }),
    );
    const options = {
      cwd: fixture,
      encoding: 'utf8' as const,
      timeout: 15000,
      env: {
        ...process.env,
        PATH: stale + path.delimiter + process.env.PATH,
        COREPACK_ENABLE_NETWORK: '0',
      },
    };
    const baseline = spawnSync('corepack', ['pnpm', 'run', 'nested'], options);
    expect(baseline.status).not.toBe(0);
    expect(baseline.stdout + baseline.stderr).toContain('STALE_PLATFORM_PNPM');
    const wrapper = path.join(root, 'scripts/with-project-pnpm.sh');
    const corrected = spawnSync('sh', [wrapper, 'corepack', 'pnpm', 'run', 'nested'], options);
    expect(corrected.status, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.stdout.trim().split('\n').at(-1)).toBe(packageManager.split('@')[1]);
    expect(corrected.stdout + corrected.stderr).not.toContain('STALE_PLATFORM_PNPM');
    expect(spawnSync('sh', [wrapper, 'sh', '-c', 'exit 37'], options).status).toBe(37);
    const config = JSON.parse(await readFile('vercel.json', 'utf8')) as { buildCommand: string };
    expect(config.buildCommand).toMatch(/^sh scripts\/with-project-pnpm\.sh sh -c /);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
