import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('provisioning CLI containment', () => {
  it.each([
    { args: [], env: {} },
    {
      args: ['migrate'],
      env: { DATABASE_URL: 'postgresql://owner:synthetic-secret@real.example.invalid/database' },
    },
    {
      args: ['migrate'],
      env: {
        LESSONQUEST_MIGRATION_DATABASE_URL:
          'postgresql://owner:synthetic-secret@actual.example.invalid/database',
        LESSONQUEST_EXPECTED_DATABASE_HOST: 'different.example.invalid',
        LESSONQUEST_EXPECTED_DATABASE_NAME: 'database',
        LESSONQUEST_RUNTIME_ROLE: 'app',
      },
    },
    {
      args: ['migrate'],
      env: {
        LESSONQUEST_MIGRATION_DATABASE_URL:
          'postgresql://owner:synthetic-secret@actual.example.invalid/database',
        LESSONQUEST_EXPECTED_DATABASE_HOST: 'actual.example.invalid',
        LESSONQUEST_EXPECTED_DATABASE_NAME: 'different',
        LESSONQUEST_RUNTIME_ROLE: 'app',
      },
    },
    {
      args: ['bootstrap-teacher'],
      env: {
        LESSONQUEST_MIGRATION_DATABASE_URL:
          'postgresql://owner:synthetic-secret@actual.example.invalid/database',
        LESSONQUEST_EXPECTED_DATABASE_HOST: 'actual.example.invalid',
        LESSONQUEST_EXPECTED_DATABASE_NAME: 'database',
        LESSONQUEST_BOOTSTRAP_FIREBASE_UID: 'synthetic-uid',
      },
    },
  ])(
    'refuses missing or mismatched explicit setup without leaking secrets ($args)',
    ({ args, env }) => {
      const result = spawnSync(process.execPath, ['scripts/provision-lessonquest.js', ...args], {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH, ...env },
        encoding: 'utf8',
        timeout: 5000,
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('LessonQuest provisioning failed.\n');
    },
  );
});
