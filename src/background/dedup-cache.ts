// In-memory, best-effort deduplication cache. Lives in the worker for the
// lifetime of the service worker. It absorbs rapid duplicate firings (React
// re-renders, repeated MutationObserver callbacks, optimistic UI) of the SAME
// logical action. Genuinely separate user actions get distinct keys (or fall
// outside the window) and are not suppressed.

const lastSeen = new Map<string, number>()

/**
 * Returns true if this key should be ACCEPTED (i.e. not a recent duplicate),
 * and records it. `now` is injectable for tests.
 */
export function accept(key: string, windowMs: number, now: number = Date.now()): boolean {
  const prev = lastSeen.get(key)
  if (prev !== undefined && now - prev < windowMs) {
    // Refresh the timestamp so a sustained burst stays suppressed.
    lastSeen.set(key, now)
    return false
  }
  lastSeen.set(key, now)
  pruneIfLarge(now)
  return true
}

function pruneIfLarge(now: number): void {
  if (lastSeen.size < 500) return
  for (const [k, ts] of lastSeen) {
    if (now - ts > 60_000) lastSeen.delete(k)
  }
}

/** Test/maintenance helper. */
export function resetDedupCache(): void {
  lastSeen.clear()
}
