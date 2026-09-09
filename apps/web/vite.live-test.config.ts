import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
export default defineConfig({
  root: fileURLToPath(new URL('./test/browser-fixture', import.meta.url)),
  publicDir: false,
  plugins: [react()],
  build: { outDir: '../../dist-live-test', emptyOutDir: true, sourcemap: true },
});
