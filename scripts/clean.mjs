import { rmSync } from 'node:fs'

// Remove the build output directory so the multi-step Vite build can append
// content.js / service-worker.js / pages without clobbering each other
// (every individual build runs with emptyOutDir: false).
rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true })
console.log('[clean] removed dist/')
