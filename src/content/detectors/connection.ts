import type { LinkedInDetector } from '../detector'
import type { ConnectionMetadata, ConnectionSource } from '../../common/types'
import {
  closestButton,
  connectBecamePending,
  connectCardScope,
  describeAncestryForDiagnostics,
  elementStableId,
  invitationSentToastVisible,
  invitationUiOpen,
  isConnectButton,
  isSendInvitationButton,
} from '../selectors'
import { debug, emitEvent, emitSelectorHealth, trace } from '../messaging'
import { getContext } from '../page-context'
import { getSettings } from '../settings'
import { connectionKey } from '../../common/dedup'
import { makeEvent, pollConfirm, sourceFromPage } from './common'

const DIRECT_CONFIRM_DELAYS_MS = [300, 700, 1300, 2200]

/**
 * Two flows, both confirmed by DOM state so doubtful clicks are not counted:
 *
 * 1. Dialog flow — the final "Send" in the invitation dialog, counted once the
 *    dialog closes (the invite went through). Opening the modal or a
 *    cancelled/errored send is not counted.
 * 2. Direct flow (2026 markup) — clicking "Connect" on My Network cards and
 *    search results sends the invite immediately, no dialog. Counted once the
 *    control/card flips to a pending state or an "invitation sent" toast
 *    appears. If a dialog opens instead, this flow stands down and the dialog
 *    flow does the counting — never both.
 */
export class ConnectionDetector implements LinkedInDetector {
  readonly key = 'connection' as const
  private readonly pending = new Set<string>()

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const btn = closestButton(e.target)
    if (!btn) return
    if (isSendInvitationButton(btn)) {
      this.handleDialogSend(btn)
      return
    }
    if (isConnectButton(btn)) this.handleDirectConnect(btn)
  }

  private handleDialogSend(btn: HTMLElement): void {
    const dialog = btn.closest('[role="dialog"], [aria-modal="true"]')
    const source = sourceFromPage(getContext().pageType)
    const key = connectionKey(elementStableId(dialog ?? btn))
    trace('connection', 'send_candidate', `dialog=${!!dialog}`)
    pollConfirm(
      () => !dialog || !document.contains(dialog),
      () => this.record(source, key),
    )
  }

  private handleDirectConnect(btn: HTMLElement): void {
    const key = connectionKey(elementStableId(btn))
    if (this.pending.has(key)) {
      trace('connection', 'pending_duplicate', key)
      return
    }
    this.pending.add(key)
    const source = sourceFromPage(getContext().pageType)
    const scope = connectCardScope(btn)
    trace('connection', 'connect_candidate', `source=${source};scope=${!!scope}`)
    this.confirmDirect(btn, scope, key, source, 0)
  }

  private confirmDirect(
    btn: HTMLElement,
    scope: Element | null,
    key: string,
    source: ConnectionSource,
    attempt: number,
  ): void {
    setTimeout(() => {
      if (invitationUiOpen()) {
        this.pending.delete(key)
        trace('connection', 'deferred_to_dialog', `attempt=${attempt + 1}`)
        return
      }
      if (connectBecamePending(btn, scope) || invitationSentToastVisible()) {
        this.pending.delete(key)
        trace('connection', 'confirmed_direct', `attempt=${attempt + 1}`)
        this.record(source, key)
        return
      }
      if (attempt + 1 < DIRECT_CONFIRM_DELAYS_MS.length) {
        this.confirmDirect(btn, scope, key, source, attempt + 1)
        return
      }
      this.pending.delete(key)
      trace('connection', 'confirm_timeout', describeAncestryForDiagnostics(btn))
      emitSelectorHealth(
        'connection',
        'needs_verification',
        'Connect click seen, but no pending state, toast, or invite dialog followed.',
      )
    }, DIRECT_CONFIRM_DELAYS_MS[attempt])
  }

  private record(source: ConnectionSource, deduplicationKey: string): void {
    const metadata: ConnectionMetadata = { source }
    emitEvent({
      ...makeEvent('connection_request', metadata as Record<string, unknown>),
      deduplicationKey,
    })
    emitSelectorHealth('connection', 'working')
    debug('connection_request', source)
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
    this.pending.clear()
  }

  onNavigate(): void {
    this.pending.clear()
  }
}
