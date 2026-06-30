import type { LinkedInDetector } from '../detector'
import type { ReactionMetadata, ReactionTargetType } from '../../common/types'
import {
  classifyReaction,
  closestButton,
  closestPostContainer,
  controlText,
  findReactionTrigger,
  isReactionActive,
  isReactionTrigger,
} from '../selectors'
import { debug, emitEvent, emitReactionRemoved, emitSelectorHealth } from '../messaging'
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

  private readonly onClick = (e: MouseEvent): void => {
    if (getSettings().paused) return
    const clicked = closestButton(e.target)
    if (!clicked || !isReactionTrigger(clicked)) return

    const container = closestPostContainer(clicked)
    const targetId = container?.id ?? 'unknown'
    const key = reactionKey(targetId)
    if (this.pending.has(key)) return

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

    this.pending.add(key)
    this.confirm(trigger, key, prevActive, labelText, targetType, 0)
  }

  private confirm(
    trigger: HTMLElement,
    key: string,
    prevActive: boolean,
    labelText: string,
    targetType: ReactionTargetType,
    attempt: number,
  ): void {
    setTimeout(() => {
      const decision = decideReaction(prevActive, isReactionActive(trigger))
      if (decision === 'none' && attempt < CONFIRM_DELAYS_MS.length - 1) {
        this.confirm(trigger, key, prevActive, labelText, targetType, attempt + 1)
        return
      }
      this.pending.delete(key)
      if (decision === 'add') this.recordAdd(key, labelText, targetType)
      else if (decision === 'remove') this.recordRemove(key)
    }, CONFIRM_DELAYS_MS[attempt])
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
  }

  onNavigate(): void {
    this.pending.clear()
  }
}
