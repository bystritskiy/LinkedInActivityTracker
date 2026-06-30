// Helpers for building deduplication keys. The actual short-term suppression
// cache lives in the background worker (see background/dedup-cache.ts); these
// pure helpers are shared so detectors and tests build keys consistently.

/** Join key parts with a stable separator, skipping empty parts. */
export function makeKey(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p): p is string | number => p !== undefined && p !== null && p !== '')
    .join(':')
}

/**
 * Bucket a timestamp to a coarse window so that near-simultaneous firings of
 * the "same" logical action collapse to one key.
 */
export function timestampBucket(ms: number, bucketMs: number): number {
  return Math.floor(ms / bucketMs)
}

// Convenience builders matching the examples in the spec (§12).

export function reactionKey(targetId: string): string {
  // Intentionally excludes the reaction *type*: switching like→celebrate is a
  // single reaction, and net add/remove is tracked by the detector's state map.
  return makeKey('reaction', targetId)
}

export function connectionKey(profileOrButtonId: string): string {
  return makeKey('connection', profileOrButtonId)
}

export function commentKey(targetId: string, bucket: number): string {
  return makeKey('comment', targetId, bucket)
}

export function repostKey(targetId: string, bucket: number): string {
  return makeKey('repost', targetId, bucket)
}

export function messageKey(threadId: string, bucket: number): string {
  return makeKey('message', threadId, bucket)
}

export function postKey(bucket: number): string {
  return makeKey('post', bucket)
}
