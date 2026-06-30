// Background service worker entry point.
//
// Responsibilities: receive messages (from content script and UI pages),
// dispatch them through the serialized store, and observe machine idle state so
// active-time ticks are ignored while the computer is locked/idle.

import type { Message } from '../common/messages'
import { withRoot } from './storage'
import { dispatch, setMachineActive } from './store'

console.debug('[LAT] service worker loaded')

// Persist (and migrate) the store on install/update so the schema is current.
chrome.runtime.onInstalled.addListener(() => {
  void withRoot((root) => {
    root.lastSeenVersion = chrome.runtime.getManifest().version
  })
})

// Machine-level idle gating (the content script handles tab focus + per-tab
// idle; this catches lock/screensaver across the whole machine).
try {
  chrome.idle.setDetectionInterval(15)
  chrome.idle.onStateChanged.addListener((state) => {
    setMachineActive(state === 'active')
  })
} catch {
  // chrome.idle unavailable — fall back to always-active.
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  dispatch(message as Message).then(
    (response) => sendResponse(response),
    (err: unknown) => sendResponse({ ok: false, error: String((err as Error)?.message ?? err) }),
  )
  // Keep the message channel open for the async response.
  return true
})
