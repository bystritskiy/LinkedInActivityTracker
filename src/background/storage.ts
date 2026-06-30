import type { StorageRoot } from '../common/types'
import { DEFAULT_SETTINGS, SCHEMA_VERSION, STORAGE_KEY } from '../common/constants'
import { nowIso } from '../common/date'
import { runMigrations } from './migrations'

function manifestVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return '0.0.0'
  }
}

export function createEmptyRoot(version: string = manifestVersion()): StorageRoot {
  const now = nowIso()
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    days: {},
    selectorHealth: {},
    diagnostics: [],
    installedAt: now,
    lastSeenVersion: version,
  }
}

/** Load + migrate the root from storage, creating a fresh one if none exists. */
export async function loadRoot(): Promise<StorageRoot> {
  const res = await chrome.storage.local.get(STORAGE_KEY)
  const raw = res[STORAGE_KEY]
  if (raw === undefined || raw === null) return createEmptyRoot()
  return runMigrations(raw, manifestVersion())
}

export async function saveRoot(root: StorageRoot): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: root })
}

export async function clearRoot(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

// Serialize all read-modify-write cycles through a single promise chain so two
// concurrent messages can't clobber each other's writes.
let writeQueue: Promise<unknown> = Promise.resolve()

/** Load the root, run `fn`, persist, and return fn's result — serialized. */
export function withRoot<T>(fn: (root: StorageRoot) => T | Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const root = await loadRoot()
    const result = await fn(root)
    await saveRoot(root)
    return result
  }
  const result = writeQueue.then(run, run)
  writeQueue = result.catch(() => undefined)
  return result
}

/** Read-only access to the root (no write), still serialized after pending writes. */
export function readRoot(): Promise<StorageRoot> {
  const run = () => loadRoot()
  const result = writeQueue.then(run, run)
  writeQueue = result.catch(() => undefined)
  return result
}
