import type { DetectionContext, LinkedInDetector } from '../detector'
import type { SSIScores } from '../selectors'
import { extractSSI } from '../selectors'
import { emitSelectorHealth, emitSSISnapshot, trace } from '../messaging'
import { getSettings } from '../settings'
import { showToast } from '../toast'
import { t } from '../../common/i18n'

// The SSI page hydrates asynchronously; re-scan on a backoff until the scores
// appear (~26s total), then stop for this page visit.
const SCAN_DELAYS_MS = [800, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000]

/** "SSI recorded: 33 · 12.05 / 4.76 / 1 / 15" (components when all present). */
function ssiToastMessage(scores: SSIScores): string {
  const base = t(getSettings().locale, 'toast.ssiRecorded', { total: scores.total })
  const parts = [
    scores.professionalBrand,
    scores.findRightPeople,
    scores.engageWithInsights,
    scores.buildRelationships,
  ]
  if (parts.some((v) => v === undefined)) return base
  return `${base} · ${parts.join(' / ')}`
}

/**
 * Records the user's Social Selling Index whenever they open the SSI page
 * (/sales/ssi). Purely observational — the page is only read, never touched:
 * the scores LinkedIn renders are parsed from the DOM and stored for today.
 */
export class SSIDetector implements LinkedInDetector {
  readonly key = 'ssi' as const
  // Invalidates any in-flight scan chain on navigation/detach.
  private scanToken = 0

  attach(ctx: DetectionContext): void {
    this.restart(ctx)
  }

  onNavigate(ctx: DetectionContext): void {
    this.restart(ctx)
  }

  detach(): void {
    this.scanToken++
  }

  private restart(ctx: DetectionContext): void {
    const token = ++this.scanToken
    if (ctx.pageType !== 'ssi' || getSettings().paused) return
    let next = 0
    const attempt = (): void => {
      if (token !== this.scanToken || getSettings().paused) return
      const scores = extractSSI()
      if (scores) {
        emitSSISnapshot(scores)
        emitSelectorHealth('ssi', 'working')
        trace('ssi', 'ssi_captured', `total=${scores.total}`)
        showToast(ssiToastMessage(scores))
        return
      }
      if (next < SCAN_DELAYS_MS.length) {
        setTimeout(attempt, SCAN_DELAYS_MS[next++])
      } else {
        emitSelectorHealth(
          'ssi',
          'needs_verification',
          'SSI page opened, but no scores were found in the DOM.',
        )
      }
    }
    setTimeout(attempt, SCAN_DELAYS_MS[next++])
  }
}
