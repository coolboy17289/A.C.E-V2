import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The desktop shell is the entry-point bundle that Chromium launches in
// kiosk mode. Aliases cover only the apps we currently ship. Apps parked
// in `later/apps/` are not wired here — see `later/README.md` for the
// path to re-enable one.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4317,
    strictPort: true,
    // Proxy /api/* requests through to the local backend during `vite dev`.
    // The backend runs on 4318 so it doesn't collide with the dev shell
    // listening on 4317. In production the backend itself serves the
    // React shell (see backend/src/server.ts) and no proxy is needed.
    proxy: {
      '/api': {
        target: 'http://localhost:4318',
        changeOrigin: true,
        ws: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4319,
    strictPort: true,
  },
  resolve: {
    alias: {
      // -----------------------------------------------------------------
      // Workspace package aliases — surface internal code under @ace/*.
      // -----------------------------------------------------------------
      '@ace/shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
      '@ace/app-ai': fileURLToPath(new URL('../apps/ai/src', import.meta.url)),
      '@ace/app-focus': fileURLToPath(new URL('../apps/focus/src', import.meta.url)),
      '@ace/app-home': fileURLToPath(new URL('../apps/home/src', import.meta.url)),
      '@ace/app-settings': fileURLToPath(new URL('../apps/settings/src', import.meta.url)),
      // -----------------------------------------------------------------
      // Asset folder alias — public/backgrounds/ reachable as @backgrounds
      // so devs can reference dropped PNGs by their drop-zone path.
      // Resolves `@backgrounds/foo.png` to `./public/backgrounds/foo.png`.
      // -----------------------------------------------------------------
      '@backgrounds': fileURLToPath(new URL('./public/backgrounds', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
