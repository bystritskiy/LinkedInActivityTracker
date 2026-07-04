import type { DetectionContext, LinkedInDetector } from '../detector'
import { extractProfileViews } from '../selectors'
import { emitProfileViewsSnapshot, emitSelectorHealth, trace } from '../messaging'
import { getSettings } from '../settings'
import { showToast } from '../toast'
import { t } from '../../common/i18n'

// The analytics page hydrates asynchronously; re-scan on a backoff until the
// count appears (~26s total), then stop for this page visit.
const SCAN_DELAYS_MS = [800, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000]

/**
 * Records the "Who's viewed your profile" count whenever the user opens the
 * profile-views analytics page (/analytics/profile-views/). Purely
 * observational — the page is only read, never touched: the aggregate count
 * LinkedIn renders is parsed from the DOM and stored for today. Individual
 * viewers are never stored.
 */
export class ProfileViewsDetector implements LinkedInDetector {
  readonly key = 'profileViews' as const
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
    const onProfileViewsPage = ctx.pageType === 'analytics' && !!ctx.url?.includes('profile-views')
    if (!onProfileViewsPage || getSettings().paused) return
    let next = 0
    const attempt = (): void => {
      if (token !== this.scanToken || getSettings().paused) return
      const snapshot = extractProfileViews()
      if (snapshot) {
        emitProfileViewsSnapshot(snapshot)
        emitSelectorHealth('profileViews', 'working')
        trace('profileViews', 'profile_views_captured', `viewers=${snapshot.viewers}`)
        showToast(t(getSettings().locale, 'toast.profileViewsRecorded', { viewers: snapshot.viewers }))
        return
      }
      if (next < SCAN_DELAYS_MS.length) {
        setTimeout(attempt, SCAN_DELAYS_MS[next++])
      } else {
        emitSelectorHealth(
          'profileViews',
          'needs_verification',
          'Profile-views page opened, but no viewer count was found in the DOM.',
        )
      }
    }
    setTimeout(attempt, SCAN_DELAYS_MS[next++])
  }
}
