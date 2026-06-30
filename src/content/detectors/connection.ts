import type { LinkedInDetector } from '../detector'
import type { ConnectionMetadata } from '../../common/types'
import { closestButton, isSendInvitationButton } from '../selectors'
import { debug, emitEvent, emitSelectorHealth } from '../messaging'
import { getContext } from '../page-context'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm, sourceFromPage } from './common'

/**
 * Counts a connection request only after the final "Send" in the invitation
 * dialog AND the dialog actually closes (i.e. the invite went through). Opening
 * the modal, or a cancelled/errored send, is not counted.
 */
export class ConnectionDetector implements LinkedInDetector {
  readonly key = 'connection' as const

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn || !isSendInvitationButton(btn)) return
    const dialog = btn.closest('[role="dialog"], [aria-modal="true"]')
    const source = sourceFromPage(getContext().pageType)
    pollConfirm(
      () => !dialog || !document.contains(dialog),
      () => {
        const metadata: ConnectionMetadata = { source }
        emitEvent(makeEvent('connection_request', metadata as Record<string, unknown>))
        emitSelectorHealth('connection', 'working')
        debug('connection_request', source)
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
