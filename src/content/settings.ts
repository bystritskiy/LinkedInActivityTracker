// Lightweight read-only settings mirror for the content script. Lets detectors
// stop work entirely while paused (truly passive) and enables debug logging.
// The worker remains the source of truth and re-gates everything on write.

import { DEFAULT_SETTINGS, STORAGE_KEY } from '../common/constants'
import type { Settings, StorageRoot } from '../common/types'

let current: Settings = DEFAULT_SETTINGS
let currentSignature = settingsSignature(DEFAULT_SETTINGS)

function settingsSignature(settings: Settings): string {
  return JSON.stringify({
    paused: settings.paused,
    debug: settings.debug,
    idleThresholdSeconds: settings.idleThresholdSeconds,
    tracking: settings.tracking,
    privacy: settings.privacy,
  })
}

export function getSettings(): Settings {
  return current
}

export async function initSettings(): Promise<void> {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY)
    const root = res[STORAGE_KEY] as StorageRoot | undefined
    if (root?.settings) {
      current = root.settings
      currentSignature = settingsSignature(root.settings)
    }
  } catch {
    // storage unavailable — keep defaults
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) return
      const root = changes[STORAGE_KEY].newValue as StorageRoot | undefined
      if (root?.settings) {
        const nextSignature = settingsSignature(root.settings)
        if (nextSignature === currentSignature) return
        current = root.settings
        currentSignature = nextSignature
      }
    })
  } catch {
    // ignore
  }
}
