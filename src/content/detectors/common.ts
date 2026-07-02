import type {
  ConnectionSource,
  LinkedInPageType,
  TrackedEvent,
  TrackedEventType,
} from '../../common/types'
import { newId } from '../../common/ids'
import { dayKeyFromDate, nowIso } from '../../common/date'
import { getContext } from '../page-context'

/**
 * Poll a confirmation predicate at increasing delays. Fires `onConfirmed` the
 * first time it returns true; gives up silently if it never does. This is how
 * "doubtful events are not recorded" (spec §27.7) is enforced: no confirmation,
 * no event.
 */
export function pollConfirm(
  check: () => boolean,
  onConfirmed: () => void,
  delays: number[] = [200, 500, 1000, 1600],
  onTimeout?: () => void,
): void {
  const attempt = (idx: number): void => {
    setTimeout(() => {
      if (check()) {
        onConfirmed()
        return
      }
      if (idx + 1 < delays.length) attempt(idx + 1)
      else onTimeout?.()
    }, delays[idx])
  }
  attempt(0)
}

/** Build an automatic event with a sanitized URL and current-day key. */
export function makeEvent(
  type: TrackedEventType,
  metadata?: Record<string, unknown>,
): TrackedEvent {
  return {
    id: newId(),
    type,
    timestamp: nowIso(),
    dayKey: dayKeyFromDate(new Date()),
    url: getContext().url,
    source: 'automatic',
    metadata,
  }
}

export function sourceFromPage(pageType: LinkedInPageType): ConnectionSource {
  switch (pageType) {
    case 'profile':
      return 'profile'
    case 'search':
      return 'search'
    case 'network':
      return 'recommendations'
    default:
      return 'unknown'
  }
}
