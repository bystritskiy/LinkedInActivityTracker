import type { LinkedInDetector } from '../detector'
import { ACTIVE_TIME_TICK_MS, ACTIVE_TIME_TICK_SECONDS } from '../../common/constants'
import { getSettings } from '../settings'
import { getContext } from '../page-context'
import { emitActiveTick } from '../messaging'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

/**
 * Counts active time only while: the tab is visible, the window is focused, and
 * the user has interacted within the idle threshold. Emits a tick every
 * ACTIVE_TIME_TICK_MS; the worker accumulates and attributes it to a page type.
 */
export class ActiveTimeDetector implements LinkedInDetector {
  readonly key = 'activeTime' as const
  private lastActivity = Date.now()
  private intervalId: ReturnType<typeof setInterval> | undefined

  private readonly onActivity = (): void => {
    this.lastActivity = Date.now()
  }

  private readonly tick = (): void => {
    const s = getSettings()
    if (s.paused || !s.tracking.activeTime) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (typeof document !== 'undefined' && !document.hasFocus()) return
    const idleMs = Date.now() - this.lastActivity
    if (idleMs > s.idleThresholdSeconds * 1000) return
    emitActiveTick(ACTIVE_TIME_TICK_SECONDS, getContext().pageType)
  }

  attach(): void {
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, this.onActivity, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', this.onActivity)
    window.addEventListener('focus', this.onActivity)
    this.intervalId = setInterval(this.tick, ACTIVE_TIME_TICK_MS)
  }

  detach(): void {
    for (const ev of ACTIVITY_EVENTS) {
      window.removeEventListener(ev, this.onActivity, { capture: true })
    }
    document.removeEventListener('visibilitychange', this.onActivity)
    window.removeEventListener('focus', this.onActivity)
    if (this.intervalId !== undefined) clearInterval(this.intervalId)
  }
}
