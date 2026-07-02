# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A privacy-first Chrome extension (Manifest V3) that **passively logs the user's own LinkedIn activity** (reactions, comments, posts, connection requests, messages, active time) for a daily challenge. Core invariant: it only **observes** — it must never click, type, submit, scroll, or otherwise perform actions on LinkedIn on the user's behalf. All data stays local in `chrome.storage.local`.

## Commands

```sh
npm run build        # full build: clean → icons → content → worker → pages → dist/
npm run typecheck    # tsc --noEmit
npm test             # vitest run (all tests)
npx vitest run tests/reducer.test.ts   # run a single test file
npm run test:watch   # vitest watch mode
npm run dev:pages    # vite dev server for popup/dashboard UI only (no extension APIs)
```

To try the extension, run `npm run build` and load the `dist/` directory as an unpacked extension in Chrome. There is no lint setup.

The extension version lives in **both** `package.json` and `public/manifest.json` — keep them in sync.

## Architecture

Three separately built bundles that communicate via `chrome.runtime` messages and `chrome.storage.local`:

1. **Content script** (`src/content/`, built by `vite.content.config.ts` → `dist/content.js` as an IIFE — MV3 content scripts can't use ESM imports). Runs on linkedin.com, detects user actions, sends fire-and-forget messages to the worker.
2. **Background service worker** (`src/background/`, built by `vite.worker.config.ts` → `dist/service-worker.js`, also IIFE). The **only writer** of state.
3. **UI pages** (`src/popup/`, `src/dashboard/` — React 19, built by `vite.config.ts` → `popup.html`/`dashboard.html`). This build runs **last** with `emptyOutDir: false` so it doesn't wipe the other two bundles; `npm run build` order matters.

### Read/write split

All **writes** go through the worker (`chrome.runtime.sendMessage`) so dedup, pause/tracking-toggle/privacy gating, aggregation, and migrations stay centralized. UI **reads** come straight from `chrome.storage.local` plus `storage.onChanged` subscriptions (`src/ui/chrome.ts`), so the popup opens fast and stays live without round-trips. The content script keeps a read-only settings mirror (`src/content/settings.ts`) so detectors can go fully inert while paused, but the worker re-gates everything on write regardless.

### Message protocol

`src/common/messages.ts` defines the entire protocol: `ContentMessage` (fire-and-forget: events, active-time ticks, diagnostics, selector health) and `UiMessage` (request/response, typed via `ResponseMap`). `src/background/store.ts` is the single dispatcher; `src/background/reducer.ts` holds the pure state-mutation functions (unit-tested). All state mutations go through `withRoot()` in `src/background/storage.ts`, which serializes read-modify-write cycles.

### Content-script layering

- `src/content/selectors.ts` — **the only file that knows LinkedIn's DOM**. LinkedIn churns CSS classes constantly, so it uses semantic signals (aria-label, role, button text via multilingual en/ru/pl word lists, dialog context) instead of class names. When LinkedIn UI changes break detection, fix it here — detectors and business logic stay put.
- `src/content/detectors/*` — one detector per activity type, implementing the `LinkedInDetector` interface (`src/content/detector.ts`). Detectors attach once at boot; SPA navigations (observed by monkey-patching `history.pushState`/`replaceState` in `src/content/navigation.ts`) trigger `onNavigate` for per-page state reset rather than re-binding global listeners.
- Detection strategy is generally: passive capture-phase listeners + DOM state before/after the user's own click, confirmed via MutationObserver.

### Data model & persistence

`src/common/types.ts` is the persisted data model — plain data only, no DOM nodes or LinkedIn selectors. State is one `StorageRoot` object under a single storage key, versioned with `schemaVersion`; schema changes require a migration in `src/background/migrations.ts` and a `SCHEMA_VERSION` bump in `src/common/constants.ts`.

Privacy is enforced at write time in `store.ts` (`gateMetadata`): metadata like comment length or connection profile URLs is stripped unless the user opted in. URLs are sanitized to origin + pathname before storage.

### Diagnostics & selector health

Detectors report per-detector health (`selectorHealth`) and diagnostic events; the worker persists them and the dashboard surfaces them. This is the early-warning system for LinkedIn markup changes — keep it wired up when adding detectors.

### i18n

UI strings live in `src/common/i18n/` (en/ru); extension name/description in `public/_locales/`. Selector word lists in `selectors.ts` are separate and cover en/ru/pl.

## Tests

Vitest + jsdom, in `tests/`. Coverage focuses on the pure/injectable seams: reducer, dedup cache, page-context classification, and detector logic against synthetic DOM. `DetectorManager` takes its navigation/context dependencies via constructor injection specifically to keep this testable.
