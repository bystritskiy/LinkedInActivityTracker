import type { LinkedInDetector } from '../detector'
import type { PostMetadata, RepostMetadata } from '../../common/types'
import {
  closestButton,
  closestShareComposer,
  describeAncestryForDiagnostics,
  isPostPublishControl,
  isPostShareButton,
} from '../selectors'
import { debug, emitDiagnostic, emitEvent, emitSelectorHealth, trace } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'
import {
  beginRepostWithThoughtsPublish,
  finishRepostWithThoughtsPublish,
  hasPendingRepostWithThoughts,
} from './share-composer'

const PUBLISH_CONFIRM_DELAYS_MS = [400, 1000, 2000, 4000, 8000]

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
    if (!btn) return
    if (!isPostShareButton(btn)) {
      if (hasPendingRepostWithThoughts() && isPostPublishControl(btn)) {
        emitDiagnostic(
          'info',
          'post',
          'click_not_share_composer',
          describeAncestryForDiagnostics(btn),
        )
      }
      return
    }
    const composer = closestShareComposer(btn)
    const isRepostWithThoughts = beginRepostWithThoughtsPublish()
    trace('post', 'submit_candidate', isRepostWithThoughts ? 'kind=repost_with_thoughts' : 'kind=post')

    pollConfirm(
      () => !composer || !document.contains(composer),
      () => {
        if (isRepostWithThoughts) {
          finishRepostWithThoughtsPublish(true)
          const metadata: RepostMetadata = { kind: 'with_thoughts' }
          emitEvent(makeEvent('repost', metadata as Record<string, unknown>))
          emitSelectorHealth('repost', 'working')
          trace('repost', 'with_thoughts_recorded', 'confirmed composer publish')
          return
        }
        const metadata: PostMetadata = { kind: 'unknown' }
        emitEvent(makeEvent('post', metadata as Record<string, unknown>))
        emitSelectorHealth('post', 'working')
        debug('post')
      },
      PUBLISH_CONFIRM_DELAYS_MS,
      () => {
        if (isRepostWithThoughts) finishRepostWithThoughtsPublish(false)
        emitDiagnostic(
          'info',
          'post',
          'confirm_timeout',
          isRepostWithThoughts ? 'kind=repost_with_thoughts' : 'kind=post',
        )
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
