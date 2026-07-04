import type { DetectionContext, LinkedInDetector } from '../detector'
import type { LinkedInDashboardSnapshot } from '../selectors'
import { extractLinkedInDashboard } from '../selectors'
import { emitLinkedInDashboardSnapshot, emitSelectorHealth, trace } from '../messaging'
import { getSettings } from '../settings'
import { showToast } from '../toast'
import { t } from '../../common/i18n'

// The dashboard hydrates asynchronously; re-scan on a backoff until at least
// one aggregate appears (~26s total), then stop for this page visit.
const SCAN_DELAYS_MS = [800, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000]

function dashboardToastMessage(snapshot: LinkedInDashboardSnapshot): string {
  const parts = [
    snapshot.postImpressions !== undefined
      ? `impressions=${snapshot.postImpressions}`
      : undefined,
    snapshot.followers !== undefined ? `followers=${snapshot.followers}` : undefined,
    snapshot.searchAppearances !== undefined
      ? `search=${snapshot.searchAppearances}`
      : undefined,
  ].filter(Boolean)
  const base = t(getSettings().locale, 'toast.linkedInDashboardRecorded')
  return parts.length > 0 ? `${base} · ${parts.join(' / ')}` : base
}

/**
 * Records aggregate metrics from LinkedIn's creator dashboard
 * (/dashboard/). Purely observational — the page is only read, never touched.
 */
export class LinkedInDashboardDetector implements LinkedInDetector {
  readonly key = 'linkedInDashboard' as const
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
    if (ctx.pageType !== 'dashboard' || getSettings().paused) return
    let next = 0
    const attempt = (): void => {
      if (token !== this.scanToken || getSettings().paused) return
      const snapshot = extractLinkedInDashboard()
      if (snapshot) {
        emitLinkedInDashboardSnapshot(snapshot)
        emitSelectorHealth('linkedInDashboard', 'working')
        trace(
          'linkedInDashboard',
          'linkedin_dashboard_captured',
          `followers=${snapshot.followers ?? 'n/a'};impressions=${snapshot.postImpressions ?? 'n/a'}`,
        )
        showToast(dashboardToastMessage(snapshot))
        return
      }
      if (next < SCAN_DELAYS_MS.length) {
        setTimeout(attempt, SCAN_DELAYS_MS[next++])
      } else {
        emitSelectorHealth(
          'linkedInDashboard',
          'needs_verification',
          'LinkedIn dashboard opened, but no aggregate metrics were found in the DOM.',
        )
      }
    }
    setTimeout(attempt, SCAN_DELAYS_MS[next++])
  }
}
