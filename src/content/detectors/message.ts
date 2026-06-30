import type { LinkedInDetector } from '../detector'
import type { MessageMetadata } from '../../common/types'
import { MESSAGE_ITEM_SELECTOR, closestButton, countMatching, isMessageSendButton } from '../selectors'
import { debug, emitEvent, emitSelectorHealth } from '../messaging'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'

/**
 * Counts a sent message only after a new message item appears in the
 * conversation thread (spec §6.6). New-vs-reply is inferred from whether the
 * thread already had messages; InMail detection is left for live tuning.
 */
export class MessageDetector implements LinkedInDetector {
  readonly key = 'message' as const

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn || !isMessageSendButton(btn)) return

    const thread =
      btn.closest('[class*="msg-s-message-list"], [class*="msg-convo"], [class*="messaging"]') ??
      document.body
    const initial = countMatching(thread, MESSAGE_ITEM_SELECTOR)

    pollConfirm(
      () => countMatching(thread, MESSAGE_ITEM_SELECTOR) > initial,
      () => {
        const metadata: MessageMetadata = { kind: initial > 0 ? 'reply' : 'new' }
        emitEvent(makeEvent('message', metadata as Record<string, unknown>))
        emitSelectorHealth('message', 'working')
        debug('message', metadata.kind)
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
