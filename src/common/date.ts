// Date helpers. The "day" for the challenge is a calendar day in the user's
// local timezone — all rollover logic keys off local midnight, never UTC.

/** Current time as an ISO 8601 string. */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString()
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Local-day bucket key (YYYY-MM-DD) for a given instant, computed from the
 * date's local components (i.e. the browser/user timezone).
 */
export function dayKeyFromDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Parse a dayKey back into a Date at local midnight. */
export function dateFromDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map((p) => Number.parseInt(p, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

/** Validate a dayKey shape (YYYY-MM-DD). */
export function isValidDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Milliseconds from `now` until the next local midnight (always > 0). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  )
  return next.getTime() - now.getTime()
}

/** Timestamp (ms since epoch) of the next local midnight. */
export function nextLocalMidnightMs(now: Date = new Date()): number {
  return now.getTime() + msUntilNextLocalMidnight(now)
}

/** Format seconds as whole minutes (rounded down). */
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60)
}

/** The IANA timezone the browser is currently using, e.g. "Europe/Warsaw". */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Return the list of dayKeys for the last `count` days ending at `endDayKey`
 * (inclusive), oldest first. Used to build contiguous history/charts.
 */
export function recentDayKeys(count: number, endDayKey: string): string[] {
  const end = dateFromDayKey(endDayKey)
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i)
    keys.push(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    )
  }
  return keys
}
