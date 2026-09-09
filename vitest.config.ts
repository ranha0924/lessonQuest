import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'packages/db/test/postgres.test.ts',
      'packages/db/test/provisioning.postgres.test.ts',
    ],
    testTimeout: 15_000,
    include: [
      'packages/**/test/**/*.test.ts',
      'services/**/test/**/*.test.ts',
      'apps/**/test/**/*.test.ts',
      'apps/**/test/**/*.test.tsx',
      'tests/**/*.test.ts',
    ],
  },
});
