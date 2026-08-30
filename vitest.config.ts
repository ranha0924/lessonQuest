import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
