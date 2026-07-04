import type { LinkedInDetector } from '../detector'
import type { RepostMetadata } from '../../common/types'
import {
  classifyRepost,
  closestButton,
  controlText,
  describeAncestryForDiagnostics,
  isMenuItemClick,
  isRepostControl,
  opensMenu,
  repostMenuSelection,
} from '../selectors'
import { debug, emitDiagnostic, emitEvent, emitSelectorHealth, trace } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'
import { clearRepostWithThoughtsPending, markRepostWithThoughtsPending } from './share-composer'

/** How long after the repost menu opens an option click is still attributed to it. */
const MENU_WINDOW_MS = 15_000

/**
 * Counts instant reposts. The 2026 dropdown renders options as bare `<a>`
 * elements (no href, no role, no [role="menu"] ancestor), invisible to the
 * classic button+menuitem detection. So the detector is a two-step state
 * machine: a click on the repost TRIGGER (the social-bar control with
 * aria-expanded) arms a short window, and the next click inside that window
 * is classified by its text. Merely opening the menu never counts — the
 * trigger click itself only arms. "Repost with thoughts" opens the composer;
 * the final publish click is confirmed by the post detector and recorded as a
 * repost with kind=with_thoughts.
 */
export class RepostDetector implements LinkedInDetector {
  readonly key = 'repost' as const

  private menuOpenedAt = 0
  private missLogged = false

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)

    if (btn && isRepostControl(btn) && opensMenu(btn)) {
      this.menuOpenedAt = Date.now()
      this.missLogged = false
      debug('repost menu opened')
      return
    }

    let kind: 'instant' | 'with_thoughts' | null = null
    if (btn && isRepostControl(btn) && isMenuItemClick(btn)) {
      kind = classifyRepost(controlText(btn))
    } else if (this.menuArmed()) {
      kind = repostMenuSelection(e.target)
      if (!kind && !this.missLogged && e.target instanceof Element) {
        // First unmatched click after opening the menu — either the user
        // dismissed it, or the option markup changed again. Keep the chain
        // so the next markup break is diagnosable from the dashboard.
        this.missLogged = true
        emitDiagnostic(
          'info',
          'repost',
          'armed_click_no_match',
          describeAncestryForDiagnostics(e.target),
        )
      }
    }
    if (!kind) return

    this.menuOpenedAt = 0
    if (kind !== 'instant') {
      markRepostWithThoughtsPending()
      trace('repost', 'with_thoughts_composer', 'waiting for composer publish')
      return
    }
    pollConfirm(
      () => true,
      () => {
        const metadata: RepostMetadata = { kind: 'instant' }
        emitEvent(makeEvent('repost', metadata as Record<string, unknown>))
        emitSelectorHealth('repost', 'working')
        trace('repost', 'instant_recorded', 'kind=instant')
      },
      [400],
    )
  }

  private menuArmed(): boolean {
    return Date.now() - this.menuOpenedAt < MENU_WINDOW_MS
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
  }

  onNavigate(): void {
    this.menuOpenedAt = 0
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
    this.menuOpenedAt = 0
    clearRepostWithThoughtsPending()
  }
}
