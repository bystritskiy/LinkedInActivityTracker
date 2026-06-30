import type { LinkedInDetector } from '../detector'
import type { RepostMetadata } from '../../common/types'
import { classifyRepost, closestButton, controlText, isMenuItemClick, isRepostControl } from '../selectors'
import { debug, emitEvent, emitSelectorHealth } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'

/**
 * Counts instant reposts. Only a click on a repost MENU ITEM (not the trigger
 * that opens the menu) is considered, so merely opening the repost menu does
 * not count. "Repost with thoughts" opens the composer and is published there;
 * it is intentionally not counted here to avoid double counting (documented
 * limitation — adjust manually if needed).
 */
export class RepostDetector implements LinkedInDetector {
  readonly key = 'repost' as const

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn || !isRepostControl(btn) || !isMenuItemClick(btn)) return
    if (classifyRepost(controlText(btn)) !== 'instant') return

    pollConfirm(
      () => true,
      () => {
        const metadata: RepostMetadata = { kind: 'instant' }
        emitEvent(makeEvent('repost', metadata as Record<string, unknown>))
        emitSelectorHealth('repost', 'working')
        debug('repost instant')
      },
      [400],
    )
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
  }
}
