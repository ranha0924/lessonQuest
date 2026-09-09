import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const live = environment['VITE_LIVE_MODE'] === 'true';
  if (
    Object.keys(environment).some((key) =>
      /^VITE_.*(?:OPENAI|PRIVATE_KEY|SERVICE_ACCOUNT|DATABASE_URL|PGPASSWORD|POSTGRES|MIGRATION)/i.test(
        key,
      ),
    )
  )
    throw new Error('Server credentials cannot be exposed to the browser');
  if (
    live &&
    (environment['VITE_DEV_PREVIEW'] === 'true' || environment['VITE_DEMO_MODE'] === 'true')
  )
    throw new Error('Live mode cannot enable synthetic modes');
  const preview = environment['VITE_DEV_PREVIEW'] === 'true';
  if (preview && environment['VITE_DEMO_MODE'] === 'true')
    throw new Error('Demo and development preview modes cannot be enabled together');
  return {
    plugins: [
      react(),
      {
        name: 'exclude-development-runtime-from-normal-build',
        generateBundle(_options, bundle) {
          if (preview) return;
          for (const output of Object.values(bundle)) {
            if (
              output.type === 'chunk' &&
              Object.keys(output.modules).some((id) =>
                /\/dev-preview\/|@electric-sql\/pglite|\/packages\/auth\//.test(id),
              )
            ) {
              throw new Error('Normal build unexpectedly includes the development runtime');
            }
          }
        },
      },
    ],
    ...(preview
      ? {
          resolve: {
            alias: [
              {
                find: /^node:crypto$/,
                replacement: fileURLToPath(
                  new URL('./src/dev-preview/browser-crypto.ts', import.meta.url),
                ),
              },
            ],
          },
          optimizeDeps: { exclude: ['@electric-sql/pglite'] },
        }
      : {}),
    build: { sourcemap: true },
  };
});
