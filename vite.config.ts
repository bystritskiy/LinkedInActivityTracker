import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Builds the React UI pages (popup + dashboard) as ES modules.
// Static assets in `public/` (manifest.json, icons) are copied to `dist/`.
// Runs LAST in the build chain, so `emptyOutDir` is false to preserve the
// already-built content.js / service-worker.js bundles.
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
      },
    },
  },
})
