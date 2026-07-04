import type { ImportResult } from '../common/messages'
import type {
  ActivitySession,
  DayRecord,
  ProfileViewsEntry,
  SSIEntry,
  StorageRoot,
  TrackedEvent,
  TrackedEventType,
} from '../common/types'
import { isValidDayKey } from '../common/date'
import { runMigrations } from './migrations'
import { recomputeCounters } from './reducer'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const EVENT_TYPES: TrackedEventType[] = [
  'reaction',
  'comment',
  'reply',
  'connection_request',
  'message',
  'repost',
  'post',
  'follow',
  'profile_view',
  'company_view',
  'job_view',
]

function sanitizeEvent(raw: unknown, dayKey: string): TrackedEvent | null {
  if (!isObject(raw)) return null
  if (typeof raw.id !== 'string') return null
  if (typeof raw.type !== 'string' || !EVENT_TYPES.includes(raw.type as TrackedEventType)) return null
  if (typeof raw.timestamp !== 'string') return null
  const source = raw.source === 'manual' ? 'manual' : 'automatic'
  return {
    id: raw.id,
    type: raw.type as TrackedEventType,
    timestamp: raw.timestamp,
    dayKey,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    metadata: isObject(raw.metadata) ? raw.metadata : undefined,
    source,
    deduplicationKey:
      typeof raw.deduplicationKey === 'string' ? raw.deduplicationKey : undefined,
  }
}

function sanitizeSession(raw: unknown): ActivitySession | null {
  if (!isObject(raw)) return null
  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : '',
    endedAt: typeof raw.endedAt === 'string' ? raw.endedAt : '',
    activeSeconds: typeof raw.activeSeconds === 'number' ? raw.activeSeconds : 0,
    pageTypes: isObject(raw.pageTypes) ? (raw.pageTypes as Record<string, number>) : {},
  }
}

function sanitizeSSI(raw: unknown): SSIEntry | undefined {
  if (!isObject(raw) || typeof raw.total !== 'number') return undefined
  return {
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
    total: raw.total,
    professionalBrand: typeof raw.professionalBrand === 'number' ? raw.professionalBrand : undefined,
    findRightPeople: typeof raw.findRightPeople === 'number' ? raw.findRightPeople : undefined,
    engageWithInsights: typeof raw.engageWithInsights === 'number' ? raw.engageWithInsights : undefined,
    buildRelationships: typeof raw.buildRelationships === 'number' ? raw.buildRelationships : undefined,
    source: raw.source === 'manual' ? 'manual' : raw.source === 'automatic' ? 'automatic' : undefined,
  }
}

function sanitizeProfileViews(raw: unknown): ProfileViewsEntry | undefined {
  if (!isObject(raw) || typeof raw.viewers !== 'number') return undefined
  return {
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
    viewers: raw.viewers,
    rangeDays: typeof raw.rangeDays === 'number' ? raw.rangeDays : undefined,
    source: raw.source === 'manual' ? 'manual' : raw.source === 'automatic' ? 'automatic' : undefined,
  }
}

function sanitizeDay(dayKey: string, raw: unknown): DayRecord | null {
  if (!isObject(raw)) return null
  const eventsRaw = Array.isArray(raw.events) ? raw.events : []
  const events = eventsRaw
    .map((e) => sanitizeEvent(e, dayKey))
    .filter((e): e is TrackedEvent => e !== null)
  const statsRaw = isObject(raw.stats) ? raw.stats : {}
  const sessionsRaw = Array.isArray(raw.sessions) ? raw.sessions : []
  const ssiEntriesRaw = Array.isArray(raw.ssiEntries) ? raw.ssiEntries : []
  const ssiEntries = ssiEntriesRaw
    .map(sanitizeSSI)
    .filter((s): s is SSIEntry => s !== undefined)
  const profileViewsRaw = Array.isArray(raw.profileViewsEntries) ? raw.profileViewsEntries : []
  const profileViewsEntries = profileViewsRaw
    .map(sanitizeProfileViews)
    .filter((s): s is ProfileViewsEntry => s !== undefined)
  const day: DayRecord = {
    dayKey,
    events,
    sessions: sessionsRaw
      .map(sanitizeSession)
      .filter((s): s is ActivitySession => s !== null),
    ssiEntries,
    profileViewsEntries,
    stats: {
      dayKey,
      activeSeconds: typeof statsRaw.activeSeconds === 'number' ? statsRaw.activeSeconds : 0,
      counters: {},
      ssi: sanitizeSSI(statsRaw.ssi) ?? ssiEntries[ssiEntries.length - 1],
      profileViews:
        sanitizeProfileViews(statsRaw.profileViews) ??
        profileViewsEntries[profileViewsEntries.length - 1],
    },
  }
  // Rebuild counters from the (validated) events so a tampered/corrupt counter
  // block can never desync from the actual log.
  recomputeCounters(day)
  return day
}

/**
 * Import a JSON backup, merging its days into the current store (imported days
 * replace local days with the same key — restore semantics). Settings from the
 * backup are also restored. Mutates `root`. Robust against malformed input.
 */
export function importBackup(root: StorageRoot, payload: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return { ok: false, error: 'invalid_json' }
  }
  if (!isObject(parsed)) return { ok: false, error: 'invalid_format' }

  const migrated = runMigrations(parsed)
  let imported = 0
  for (const [dayKey, rawDay] of Object.entries(migrated.days)) {
    if (!isValidDayKey(dayKey)) continue
    const day = sanitizeDay(dayKey, rawDay)
    if (day) {
      root.days[dayKey] = day
      imported++
    }
  }
  // Restore settings from the backup (already merged with defaults by migration).
  root.settings = migrated.settings
  return { ok: true, importedDays: imported }
}
