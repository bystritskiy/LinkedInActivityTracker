import type { LinkedInDetector } from '../detector'
import type { PostMetadata } from '../../common/types'
import { closestButton, isPostShareButton } from '../selectors'
import { debug, emitEvent, emitSelectorHealth } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'

/**
 * Counts a published post only after the share composer closes following a
 * "Post" click (spec §6.5). Post kind (text/image/…) detection is left for live
 * tuning and defaults to "unknown".
 */
export class PostDetector implements LinkedInDetector {
  readonly key = 'post' as const

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn || !isPostShareButton(btn)) return
    const composer = btn.closest(
      '[role="dialog"], [class*="share-box"], [class*="share-creation"]',
    )

    pollConfirm(
      () => !composer || !document.contains(composer),
      () => {
        const metadata: PostMetadata = { kind: 'unknown' }
        emitEvent(makeEvent('post', metadata as Record<string, unknown>))
        emitSelectorHealth('post', 'working')
        debug('post')
      },
    )
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
  }
}
