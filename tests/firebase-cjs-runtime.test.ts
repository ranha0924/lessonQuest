import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

for (const [mode, expected] of [
  ['runtime', 'runtime-safe'],
  ['jwks', 'jwks-rsa-ec-negative-passport-safe'],
]) {
  it(`loads Firebase's actual dependency graph with host require(esm) disabled: ${mode}`, () => {
    const result = spawnSync(
      process.execPath,
      ['--no-experimental-require-module', 'tests/fixtures/firebase-cjs-runtime.js', mode!],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 15000,
        env: { PATH: process.env.PATH },
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });
}
