import type { LinkedInDetector } from '../detector'
import type { ReactionMetadata, ReactionTargetType } from '../../common/types'
import {
  classifyReaction,
  closestButton,
  closestPostContainer,
  controlText,
  describeAncestryForDiagnostics,
  elementStableId,
  findReactionTrigger,
  isReactionActive,
  isReactionTrigger,
  matchesReactionWord,
  opensMenu,
} from '../selectors'
import { debug, emitEvent, emitReactionRemoved, emitSelectorHealth, trace } from '../messaging'
import { getContext } from '../page-context'
import { getSettings } from '../settings'
import { reactionKey } from '../../common/dedup'
import { newId } from '../../common/ids'
import { dayKeyFromDate, nowIso } from '../../common/date'

/**
 * Pure decision from the reaction trigger's pressed state before vs after the
 * click. (Unit-tested.)
 *   none -> reacted  = a new reaction (+1)
 *   reacted -> none  = reaction removed (-1, compensating)
 *   reacted -> reacted (type change) or none -> none = no count change
 */
export function decideReaction(prevActive: boolean, newActive: boolean): 'add' | 'remove' | 'none' {
  if (!prevActive && newActive) return 'add'
  if (prevActive && !newActive) return 'remove'
  return 'none'
}

const CONFIRM_DELAYS_MS = [180, 420, 900]

export class ReactionDetector implements LinkedInDetector {
  readonly key = 'reaction' as const
  private readonly pending = new Set<string>()
  private readonly fallbackReacted = new Set<string>()
  private readonly snapshotsLogged = new Set<string>()

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const clicked = closestButton(e.target)
    if (!clicked || !isReactionTrigger(clicked)) return

    const container = closestPostContainer(clicked)
    const targetId = container?.id ?? elementStableId(clicked)
    const key = reactionKey(targetId)
    if (this.pending.has(key)) {
      trace('reaction', 'pending_duplicate', `target=${container ? 'container' : 'unknown'}`)
      return
    }

    // Read pressed state from the post's primary toggle, not the (possibly
    // stateless) flyout option the user clicked.
    const trigger = (container && findReactionTrigger(container.el)) || clicked
    const prevActive = isReactionActive(trigger)
    const clickedEl = e.target instanceof Element ? e.target : clicked
    const labelText = `${controlText(clicked)} ${controlText(clickedEl)}`
    const targetType: ReactionTargetType = container
      ? container.isComment
        ? 'comment'
        : 'post'
      : 'unknown'
    const menuTrigger = opensMenu(clicked)

    trace(
      'reaction',
      'reaction_candidate',
      `prev=${prevActive};targetType=${targetType};target=${container ? 'container' : 'unknown'};label=${classifyReaction(labelText)};word=${matchesReactionWord(labelText)};menu=${menuTrigger}`,
    )
    if (!container) this.traceDomSnapshot(key, clicked)
    this.pending.add(key)
    this.confirm(container?.el, clicked, key, prevActive, labelText, targetType, menuTrigger, 0)
  }

  private confirm(
    container: Element | undefined,
    fallbackTrigger: HTMLElement,
    key: string,
    prevActive: boolean,
    labelText: string,
    targetType: ReactionTargetType,
    menuTrigger: boolean,
    attempt: number,
  ): void {
    setTimeout(() => {
      const trigger = (container && findReactionTrigger(container)) || fallbackTrigger
      const currentActive = isReactionActive(trigger)
      const decision = decideReaction(prevActive, currentActive)
      debug('reaction confirm', attempt + 1, prevActive, currentActive, decision)
      if (decision === 'none' && attempt < CONFIRM_DELAYS_MS.length - 1) {
        this.confirm(container, fallbackTrigger, key, prevActive, labelText, targetType, menuTrigger, attempt + 1)
        return
      }
      this.pending.delete(key)
      if (decision === 'add') {
        trace('reaction', 'confirmed_add', `targetType=${targetType}`)
        // The pre-click label often carries no type ("Reaction button state:
        // no reaction"); the confirmed trigger's label does ("Unreact Like").
        this.recordAdd(key, `${controlText(trigger)} ${labelText}`, targetType)
      } else if (decision === 'remove') {
        trace('reaction', 'confirmed_remove', `targetType=${targetType}`)
        this.recordRemove(key)
      } else {
        const fallback = this.fallbackDecision(key, prevActive, labelText, menuTrigger)
        if (fallback === 'add') {
          this.fallbackReacted.add(key)
          trace('reaction', 'fallback_add', `targetType=${targetType}`)
          this.recordAdd(key, labelText, targetType)
        } else if (fallback === 'remove') {
          this.fallbackReacted.delete(key)
          trace('reaction', 'fallback_remove', `targetType=${targetType}`)
          this.recordRemove(key)
        } else {
          trace('reaction', 'confirm_timeout', `prev=${prevActive};targetType=${targetType}`)
          this.traceDomSnapshot(key, fallbackTrigger)
          emitSelectorHealth('reaction', 'needs_verification', 'Reaction click seen, but pressed state did not change.')
        }
      }
    }, CONFIRM_DELAYS_MS[attempt])
  }

  private traceDomSnapshot(key: string, el: Element): void {
    if (this.snapshotsLogged.has(key)) return
    this.snapshotsLogged.add(key)
    trace('reaction', 'dom_snapshot', describeAncestryForDiagnostics(el))
  }

  // When the DOM never confirms (2026 hashed markup exposes no pressed state
  // at all on some surfaces), fall back to counting the click itself — but
  // only for a control whose accessible text names a reaction and that acts
  // directly (menu/flyout openers don't react by themselves).
  private fallbackDecision(
    key: string,
    prevActive: boolean,
    labelText: string,
    menuTrigger: boolean,
  ): 'add' | 'remove' | 'none' {
    if (prevActive || menuTrigger) return 'none'
    if (!matchesReactionWord(labelText)) return 'none'
    return this.fallbackReacted.has(key) ? 'remove' : 'add'
  }

  private recordAdd(key: string, labelText: string, targetType: ReactionTargetType): void {
    const metadata: ReactionMetadata = {
      reactionType: classifyReaction(labelText),
      targetType,
    }
    emitEvent({
      id: newId(),
      type: 'reaction',
      timestamp: nowIso(),
      dayKey: dayKeyFromDate(new Date()),
      url: getContext().url,
      source: 'automatic',
      deduplicationKey: key,
      metadata: metadata as Record<string, unknown>,
    })
    emitSelectorHealth('reaction', 'working')
    debug('reaction +1', targetType, metadata.reactionType)
  }

  private recordRemove(key: string): void {
    emitReactionRemoved({
      targetId: key,
      deduplicationKey: key,
      url: getContext().url,
      timestamp: nowIso(),
      dayKey: dayKeyFromDate(new Date()),
    })
    debug('reaction -1', key)
  }

  attach(): void {
    document.addEventListener('click', this.onClick, true)
  }

  detach(): void {
    document.removeEventListener('click', this.onClick, true)
    this.pending.clear()
    this.fallbackReacted.clear()
    this.snapshotsLogged.clear()
  }

  onNavigate(): void {
    this.pending.clear()
    this.fallbackReacted.clear()
    this.snapshotsLogged.clear()
  }
}
