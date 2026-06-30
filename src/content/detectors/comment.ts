import type { LinkedInDetector } from '../detector'
import type { CommentMetadata } from '../../common/types'
import {
  COMMENT_ITEM_SELECTOR,
  closestButton,
  countMatching,
  editorTextLength,
  isCommentSubmitButton,
  isReplyContext,
} from '../selectors'
import { debug, emitEvent, emitSelectorHealth } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'

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
    if (!btn || !isCommentSubmitButton(btn)) return

    const editorScope =
      btn.closest('[class*="comments-comment-box"], form, [class*="comment-box"]') ?? document.body
    const threadRoot =
      btn.closest('[class*="comments-comments-list"], [class*="comments"], article') ?? document.body
    const initial = countMatching(threadRoot, COMMENT_ITEM_SELECTOR)
    const kind = isReplyContext(btn) ? 'reply' : 'comment'
    const characterCount = editorTextLength(editorScope)

    pollConfirm(
      () => countMatching(threadRoot, COMMENT_ITEM_SELECTOR) > initial,
      () => {
        const metadata: CommentMetadata = { kind, characterCount }
        emitEvent(makeEvent(kind, metadata as Record<string, unknown>))
        emitSelectorHealth('comment', 'working')
        debug('comment', kind, characterCount)
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
