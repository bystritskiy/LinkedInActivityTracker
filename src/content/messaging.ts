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
  TrackedEventType,
} from '../common/types'
import { dayKeyFromDate, nowIso } from '../common/date'
import { eventLabelKey, t } from '../common/i18n'
import { getSettings } from './settings'
import { showToast } from './toast'
import type { ProfileViewsSnapshot, SSIScores } from './selectors'

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

/**
 * Light on-page feedback that a confirmed action was counted ("Reactions +1").
 * Mirrors the worker's gating (pause / per-type tracking toggle) so a toast is
 * never shown for an event the worker will drop; the short dedup window may
 * still absorb a rare duplicate emit, which collapses into the same toast.
 */
function eventToast(type: TrackedEventType, delta: '+1' | '−1'): void {
  const settings = getSettings()
  if (settings.paused) return
  const toggle = type === 'reply' ? 'comment' : type
  if (!settings.tracking[toggle]) return
  showToast(`✓ ${t(settings.locale, eventLabelKey(type))} ${delta}`, 2500)
}

export function emitEvent(event: TrackedEvent): void {
  send({ kind: 'event', event })
  eventToast(event.type, '+1')
}

export function emitReactionRemoved(args: {
  targetId: string
  deduplicationKey: string
  url?: string
  timestamp: string
  dayKey: string
}): void {
  send({ kind: 'reactionRemoved', ...args })
  eventToast('reaction', '−1')
}

export function emitActiveTick(seconds: number, pageType: LinkedInPageType): void {
  send({ kind: 'activeTick', seconds, pageType })
}

/** Scores read off the SSI page, recorded under today's dayKey. */
export function emitSSISnapshot(scores: SSIScores): void {
  send({
    kind: 'ssiSnapshot',
    dayKey: dayKeyFromDate(new Date()),
    ssi: { timestamp: nowIso(), ...scores },
  })
}

/** Viewer count read off the profile-views analytics page, recorded under today's dayKey. */
export function emitProfileViewsSnapshot(snapshot: ProfileViewsSnapshot): void {
  send({
    kind: 'profileViewsSnapshot',
    dayKey: dayKeyFromDate(new Date()),
    entry: { timestamp: nowIso(), ...snapshot },
  })
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
