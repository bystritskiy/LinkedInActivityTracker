import type { LinkedInDetector } from '../detector'
import type { MessageMetadata } from '../../common/types'
import {
  EDITABLE_SELECTOR,
  MESSAGE_ITEM_SELECTOR,
  closestButton,
  countMatching,
  describeAncestryForDiagnostics,
  editorValueLength,
  elementStableId,
  findMessageEditor,
  isMessageSendButton,
  isSendInvitationButton,
  messageEditorFrom,
  nearestEditorScope,
} from '../selectors'
import { debug, emitEvent, emitSelectorHealth, trace } from '../messaging'
import { getContext } from '../page-context'
import { getSettings } from '../settings'
import { makeEvent, pollConfirm } from './common'

/**
 * Counts a sent message via two triggers:
 *  - a click on the compose form's send button;
 *  - Enter (without Shift) inside the message-compose editor — the default
 *    send gesture, and the only one in the 2026 UI for most users.
 *
 * Either way the send is only counted after DOM confirmation: the compose
 * editor (non-empty at the moment of the gesture) goes empty, or a new item
 * appears in the thread. Enter-as-newline configurations therefore never
 * count: the text stays in the editor and the poll times out silently.
 */
export class MessageDetector implements LinkedInDetector {
  readonly key = 'message' as const
  private readonly pending = new Set<string>()

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const onMessagingPage = getContext().pageType === 'messaging'
    const btn = closestButton(e.target)
    if (!btn || !isMessageSendButton(btn, onMessagingPage)) return
    // The invite dialog's note field can look like a message editor; that
    // send belongs to the connection detector.
    if (isSendInvitationButton(btn)) return
    const scope = nearestEditorScope(btn)
    const editor =
      (scope && findMessageEditor(scope, onMessagingPage)) ??
      scope?.querySelector<HTMLElement>(EDITABLE_SELECTOR) ??
      null
    this.track(editor, btn, 'click')
  }

  private readonly onKeydown = (e: KeyboardEvent): void => {
    if (getSettings().paused) return
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
    const onMessagingPage = getContext().pageType === 'messaging'
    const editor = messageEditorFrom(e.target, onMessagingPage)
    if (!editor) {
      // Enter landed outside anything we recognise as a message composer.
      // Trace the target so the real 2026 editor markup shows up in
      // diagnostics instead of failing silently.
      if (onMessagingPage && e.target instanceof Element) {
        trace('message', 'enter_unmatched', describeAncestryForDiagnostics(e.target))
      }
      return
    }
    this.track(editor, editor, 'enter')
  }

  /** `anchor` is only used for dedup identity and diagnostics snapshots. */
  private track(editor: HTMLElement | null, anchor: HTMLElement, gesture: string): void {
    const before = editor ? editorValueLength(editor) : 0
    if (editor && before === 0) {
      trace('message', 'empty_editor', `gesture=${gesture}`)
      return // nothing to send — not a real send gesture
    }
    const key = elementStableId(anchor)
    if (this.pending.has(key)) return
    this.pending.add(key)

    const thread =
      anchor.closest('[class*="msg-s-message-list"], [class*="msg-convo"], [class*="messaging"]') ??
      document.body
    const initial = countMatching(thread, MESSAGE_ITEM_SELECTOR)
    trace('message', 'send_candidate', `gesture=${gesture};editor=${!!editor};len=${before};items=${initial}`)

    pollConfirm(
      () =>
        (editor !== null && document.contains(editor) && editorValueLength(editor) === 0) ||
        countMatching(thread, MESSAGE_ITEM_SELECTOR) > initial,
      () => {
        this.pending.delete(key)
        const metadata: MessageMetadata = { kind: initial > 0 ? 'reply' : 'new' }
        emitEvent(makeEvent('message', metadata as Record<string, unknown>))
        emitSelectorHealth('message', 'working')
        debug('message', metadata.kind)
      },
      undefined,
      () => {
        this.pending.delete(key)
        trace('message', 'confirm_timeout', describeAncestryForDiagnostics(anchor))
        emitSelectorHealth(
          'message',
          'needs_verification',
          'Send gesture seen, but the editor never emptied and no thread item appeared.',
        )
      },
    )
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
    document.addEventListener('keydown', this.onKeydown, true)
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
    document.removeEventListener('keydown', this.onKeydown, true)
    this.pending.clear()
  }

  onNavigate(): void {
    this.pending.clear()
  }
}
