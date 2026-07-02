// Outbound message bus to the background worker. All sends are best-effort and
// swallow errors (the worker may be asleep, or the extension context may have
// been invalidated on update).

import type { ContentMessage } from '../common/messages'
import type {
  DetectorKey,
  DetectorStatus,
  DiagnosticLevel,
  LinkedInPageType,
  TrackedEvent,
} from '../common/types'
import { getSettings } from './settings'

function send(msg: ContentMessage): void {
  try {
    const p = chrome.runtime?.sendMessage(msg)
    // Swallow promise rejections ("receiving end does not exist", etc.).
    if (p && typeof (p as Promise<unknown>).catch === 'function') {
      ;(p as Promise<unknown>).catch(() => undefined)
    }
  } catch {
    // Extension context invalidated — ignore.
  }
}

export function emitEvent(event: TrackedEvent): void {
  send({ kind: 'event', event })
}

export function emitReactionRemoved(args: {
  targetId: string
  deduplicationKey: string
  url?: string
  timestamp: string
  dayKey: string
}): void {
  send({ kind: 'reactionRemoved', ...args })
}

export function emitActiveTick(seconds: number, pageType: LinkedInPageType): void {
  send({ kind: 'activeTick', seconds, pageType })
}

export function emitDiagnostic(
  level: DiagnosticLevel,
  source: string,
  code: string,
  message: string,
): void {
  send({ kind: 'diagnostic', level, source, code, message })
}

export function trace(source: string, code: string, message: string): void {
  emitDiagnostic('info', source, code, message)
  debug(source, code, message)
}

export function emitSelectorHealth(
  detector: DetectorKey,
  status: DetectorStatus,
  note?: string,
): void {
  send({ kind: 'selectorHealth', detector, status, note })
}

export function debug(...args: unknown[]): void {
  if (getSettings().debug) console.debug('[LAT]', ...args)
}
