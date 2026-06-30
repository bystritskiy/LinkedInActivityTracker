import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Builds the content script as a single self-contained IIFE bundle
// (`dist/content.js`). MV3 declared content scripts are classic scripts and
// must not contain ESM `import` statements, hence the IIFE format.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'LATContent',
      fileName: () => 'content.js',
    },
  },
})
