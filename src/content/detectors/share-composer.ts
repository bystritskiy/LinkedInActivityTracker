/** Shared content-script state for a share composer opened from "repost with thoughts". */

const WITH_THOUGHTS_WINDOW_MS = 10 * 60 * 1000

let pendingWithThoughtsUntil = 0
let publishInFlight = false

export function markRepostWithThoughtsPending(): void {
  pendingWithThoughtsUntil = Date.now() + WITH_THOUGHTS_WINDOW_MS
  publishInFlight = false
}

export function beginRepostWithThoughtsPublish(): boolean {
  if (Date.now() > pendingWithThoughtsUntil || publishInFlight) return false
  publishInFlight = true
  return true
}

export function hasPendingRepostWithThoughts(): boolean {
  return Date.now() <= pendingWithThoughtsUntil
}

export function finishRepostWithThoughtsPublish(confirmed: boolean): void {
  if (confirmed) {
    clearRepostWithThoughtsPending()
    return
  }
  publishInFlight = false
}

export function clearRepostWithThoughtsPending(): void {
  pendingWithThoughtsUntil = 0
  publishInFlight = false
}
