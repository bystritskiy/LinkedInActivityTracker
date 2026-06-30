import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Builds the background service worker as a single self-contained IIFE bundle
// (`dist/service-worker.js`). Kept as a classic (non-module) worker for maximum
// compatibility — the manifest references it without `"type": "module"`.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/index.ts'),
      formats: ['iife'],
      name: 'LATWorker',
      fileName: () => 'service-worker.js',
    },
  },
})
