import type { LinkedInDetector } from '../detector'
import type { CommentMetadata } from '../../common/types'
import {
  COMMENT_ITEM_SELECTOR,
  closestButton,
  closestPostContainer,
  countMatching,
  editorTextLength,
  isCommentSubmitButton,
  isLikelyCommentInteraction,
  isReplyContext,
  nearestEditorScope,
} from '../selectors'
import { debug, emitEvent, emitSelectorHealth, trace } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'
import { commentKey, timestampBucket } from '../../common/dedup'

/**
 * Counts a comment/reply only after a new comment node appears in the thread
 * following a submit click. Focus, typing, drafts and bare Enter are ignored
 * (spec §6.2). Only the character count is read (never the text), and the
 * worker further gates that behind privacy settings.
 */
export class CommentDetector implements LinkedInDetector {
  readonly key = 'comment' as const

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn) return
    if (!isCommentSubmitButton(btn)) {
      if (isLikelyCommentInteraction(btn)) {
        trace('comment', 'click_not_submit', 'candidate=1;matched=0')
      }
      return
    }

    const editorScope =
      btn.closest('[class*="comments-comment-box"], form, [class*="comment-box"]') ??
      nearestEditorScope(btn) ??
      document.body
    const threadRoot =
      btn.closest('[class*="comments-comments-list"], [class*="comments"], article') ?? document.body
    const initialLocal = countMatching(threadRoot, COMMENT_ITEM_SELECTOR)
    const initialDocument = countMatching(document, COMMENT_ITEM_SELECTOR)
    const kind = isReplyContext(btn) ? 'reply' : 'comment'
    const characterCount = editorTextLength(editorScope)
    const container = closestPostContainer(btn)
    const key = commentKey(container?.id ?? 'unknown', timestampBucket(Date.now(), 8000))

    trace(
      'comment',
      'submit_candidate',
      `kind=${kind};chars=${characterCount};local=${initialLocal};document=${initialDocument};target=${container ? 'container' : 'unknown'}`,
    )

    pollConfirm(
      () =>
        countMatching(threadRoot, COMMENT_ITEM_SELECTOR) > initialLocal ||
        countMatching(document, COMMENT_ITEM_SELECTOR) > initialDocument,
      () => {
        const metadata: CommentMetadata = { kind, characterCount }
        emitEvent({ ...makeEvent(kind, metadata as Record<string, unknown>), deduplicationKey: key })
        emitSelectorHealth('comment', 'working')
        trace('comment', 'confirmed', `kind=${kind};key=${key}`)
        debug('comment', kind, characterCount)
      },
      // Rendered comments arrive after a network round trip — allow a longer
      // tail than the in-DOM toggles other detectors confirm against.
      [200, 500, 1000, 1600, 2600],
      () => {
        trace(
          'comment',
          'confirm_timeout',
          `kind=${kind};local=${countMatching(threadRoot, COMMENT_ITEM_SELECTOR)};document=${countMatching(document, COMMENT_ITEM_SELECTOR)}`,
        )
        emitSelectorHealth('comment', 'needs_verification', 'Comment click seen, but DOM confirmation did not appear.')
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
