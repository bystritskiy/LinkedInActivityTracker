// Pure-ish state transitions over StorageRoot.
//
// These functions MUTATE the root they are given and return useful values. The
// worker loads a fresh root from storage, applies one of these, and saves it —
// so in-place mutation is safe and avoids deep-cloning the whole store on every
// event. Unit tests construct a root and assert on the mutated result.
//
// Counters are always DERIVED from the per-day event list (single source of
// truth). Active time and SSI are tracked separately.

import {
  type ActivitySession,
  type Counters,
  type DailyStats,
  type DayRecord,
  type LinkedInPageType,
  type LinkedInDashboardEntry,
  type ProfileViewsEntry,
  type SSIEntry,
  type StorageRoot,
  type TrackedEvent,
  type TrackedEventType,
} from '../common/types'
import { newId } from '../common/ids'
import { dayKeyFromDate, nowIso } from '../common/date'

export function emptyStats(dayKey: string): DailyStats {
  return { dayKey, activeSeconds: 0, counters: {} }
}

export function emptyDayRecord(dayKey: string, goalsSnapshot: DailyStats['goalsSnapshot']): DayRecord {
  return {
    dayKey,
    stats: { ...emptyStats(dayKey), goalsSnapshot },
    events: [],
    sessions: [],
    ssiEntries: [],
    profileViewsEntries: [],
    linkedInDashboardEntries: [],
  }
}

/** Get a day record, creating it (with a snapshot of current goals) if absent. */
export function ensureDay(root: StorageRoot, dayKey: string): DayRecord {
  let day = root.days[dayKey]
  if (!day) {
    day = emptyDayRecord(dayKey, { ...root.settings.goals })
    root.days[dayKey] = day
  }
  return day
}

/** Recompute the day's counters from its event list. */
export function recomputeCounters(day: DayRecord): void {
  const counters: Counters = {}
  for (const ev of day.events) {
    counters[ev.type] = (counters[ev.type] ?? 0) + 1
  }
  day.stats.counters = counters
}

/** Record a confirmed automatic event. Returns false if it was a duplicate id. */
export function recordEvent(root: StorageRoot, event: TrackedEvent): boolean {
  const day = ensureDay(root, event.dayKey)
  if (day.events.some((e) => e.id === event.id)) return false
  day.events.push(event)
  recomputeCounters(day)
  return true
}

/** Add a manual (+1) event of a given type. Returns the created event. */
export function addManualEvent(
  root: StorageRoot,
  dayKey: string,
  type: TrackedEventType,
  timestamp: string = nowIso(),
): TrackedEvent {
  const day = ensureDay(root, dayKey)
  const event: TrackedEvent = {
    id: newId(),
    type,
    timestamp,
    dayKey,
    source: 'manual',
  }
  day.events.push(event)
  recomputeCounters(day)
  return event
}

/** Remove a single event by id. Returns true if something was removed. */
export function removeEventById(root: StorageRoot, dayKey: string, id: string): boolean {
  const day = root.days[dayKey]
  if (!day) return false
  const before = day.events.length
  day.events = day.events.filter((e) => e.id !== id)
  if (day.events.length === before) return false
  recomputeCounters(day)
  return true
}

/** Remove the most recent event of a type (preferring manual). Returns true if removed. */
function removeLatestOfType(day: DayRecord, type: TrackedEventType): boolean {
  for (let i = day.events.length - 1; i >= 0; i--) {
    if (day.events[i].type === type && day.events[i].source === 'manual') {
      day.events.splice(i, 1)
      return true
    }
  }
  for (let i = day.events.length - 1; i >= 0; i--) {
    if (day.events[i].type === type) {
      day.events.splice(i, 1)
      return true
    }
  }
  return false
}

/**
 * Apply a manual delta (+N / -N) to a counter. Positive deltas append manual
 * events; negative deltas remove the most recent matching events. Never goes
 * below zero.
 */
export function manualAdjust(
  root: StorageRoot,
  dayKey: string,
  type: TrackedEventType,
  delta: number,
): void {
  const day = ensureDay(root, dayKey)
  if (delta > 0) {
    for (let i = 0; i < delta; i++) addManualEvent(root, dayKey, type)
    return
  }
  for (let i = 0; i < -delta; i++) {
    if (!removeLatestOfType(day, type)) break
  }
  recomputeCounters(day)
}

/**
 * Compensate for a removed reaction by deleting the most recent reaction event
 * whose deduplicationKey matches the un-reacted target. Returns true if found.
 */
export function removeReactionByDedupKey(
  root: StorageRoot,
  dayKey: string,
  deduplicationKey: string,
): boolean {
  const day = root.days[dayKey]
  if (!day) return false
  for (let i = day.events.length - 1; i >= 0; i--) {
    const e = day.events[i]
    if (e.type === 'reaction' && e.deduplicationKey === deduplicationKey) {
      day.events.splice(i, 1)
      recomputeCounters(day)
      return true
    }
  }
  return false
}

/** Directly set the active seconds for a day (manual edit from the dashboard). */
export function setActiveSeconds(root: StorageRoot, dayKey: string, seconds: number): void {
  const day = ensureDay(root, dayKey)
  day.stats.activeSeconds = Math.max(0, Math.round(seconds))
}

/**
 * Accumulate active seconds from a content-script tick, attributing them to a
 * page type. Maintains one aggregated session per day (start/end + per-page
 * seconds), which is enough for the time-distribution view.
 */
export function addActiveSeconds(
  root: StorageRoot,
  dayKey: string,
  seconds: number,
  pageType: LinkedInPageType,
  timestamp: string = nowIso(),
): void {
  if (seconds <= 0) return
  const day = ensureDay(root, dayKey)
  day.stats.activeSeconds += seconds
  let session: ActivitySession | undefined = day.sessions[0]
  if (!session) {
    session = { id: newId(), startedAt: timestamp, endedAt: timestamp, activeSeconds: 0, pageTypes: {} }
    day.sessions.push(session)
  }
  session.endedAt = timestamp
  session.activeSeconds += seconds
  session.pageTypes[pageType] = (session.pageTypes[pageType] ?? 0) + seconds
}

/** Record an SSI observation: appended to the day's history, latest wins. */
export function setSSI(root: StorageRoot, dayKey: string, ssi: SSIEntry): void {
  const day = ensureDay(root, dayKey)
  day.ssiEntries ??= [] // pre-v2 records may predate the history array
  day.ssiEntries.push(ssi)
  day.stats.ssi = ssi
}

/** Record a profile-views observation: appended to the day's history, latest wins. */
export function setProfileViews(root: StorageRoot, dayKey: string, entry: ProfileViewsEntry): void {
  const day = ensureDay(root, dayKey)
  day.profileViewsEntries ??= [] // pre-v3 records may predate the history array
  day.profileViewsEntries.push(entry)
  day.stats.profileViews = entry
}

/** Record a LinkedIn dashboard observation: appended to the day's history, latest wins. */
export function setLinkedInDashboard(
  root: StorageRoot,
  dayKey: string,
  entry: LinkedInDashboardEntry,
): void {
  const day = ensureDay(root, dayKey)
  day.linkedInDashboardEntries ??= [] // pre-v4 records may predate the history array
  day.linkedInDashboardEntries.push(entry)
  day.stats.linkedInDashboard = entry
}

/** The most recent SSI observation of a day (falls back to the v1 snapshot). */
export function latestSSI(day: DayRecord | undefined): SSIEntry | undefined {
  if (!day) return undefined
  const entries = day.ssiEntries
  return entries && entries.length > 0 ? entries[entries.length - 1] : day.stats.ssi
}

/** Today's dayKey in local time. */
export function todayKey(): string {
  return dayKeyFromDate(new Date())
}
