import type { Settings, StorageRoot } from '../common/types'
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../common/constants'
import { mergeGoals } from '../common/goals'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Deep-merge stored settings over the current defaults so that settings fields
 * added in newer versions appear automatically after an upgrade, while the
 * user's existing choices are preserved.
 */
export function mergeSettings(defaults: Settings, stored: unknown): Settings {
  if (!isObject(stored)) return { ...defaults }
  return {
    ...defaults,
    ...stored,
    goals: mergeGoals(defaults.goals, stored.goals),
    tracking: { ...defaults.tracking, ...(isObject(stored.tracking) ? stored.tracking : {}) },
    privacy: { ...defaults.privacy, ...(isObject(stored.privacy) ? stored.privacy : {}) },
    notifications: {
      ...defaults.notifications,
      ...(isObject(stored.notifications) ? stored.notifications : {}),
    },
  } as Settings
}

/**
 * Bring a raw stored object up to the current schema version. Tolerant of
 * missing/garbage fields so a partially-corrupt store still loads with sane
 * defaults rather than throwing.
 */
export function runMigrations(raw: unknown, fallbackVersion = '0.0.0'): StorageRoot {
  const data: Record<string, unknown> = isObject(raw) ? { ...raw } : {}
  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0

  // v0 -> v1: establish the canonical top-level shape.
  if (version < 1) {
    data.days = isObject(data.days) ? data.days : {}
    data.selectorHealth = isObject(data.selectorHealth) ? data.selectorHealth : {}
    data.diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : []
    data.installedAt =
      typeof data.installedAt === 'string' ? data.installedAt : new Date().toISOString()
    data.lastSeenVersion =
      typeof data.lastSeenVersion === 'string' ? data.lastSeenVersion : fallbackVersion
  }

  // v1 -> v2: per-day SSI history (ssiEntries), seeded from the single
  // stats.ssi snapshot that v1 kept.
  if (version < 2 && isObject(data.days)) {
    for (const day of Object.values(data.days)) {
      if (!isObject(day)) continue
      if (!Array.isArray(day.ssiEntries)) {
        const stats = isObject(day.stats) ? day.stats : undefined
        const ssi = stats && isObject(stats.ssi) ? stats.ssi : undefined
        day.ssiEntries = ssi ? [ssi] : []
      }
    }
  }

  // v2 -> v3: per-day profile-views history (profileViewsEntries), mirroring
  // the SSI history shape.
  if (version < 3 && isObject(data.days)) {
    for (const day of Object.values(data.days)) {
      if (!isObject(day)) continue
      if (!Array.isArray(day.profileViewsEntries)) {
        const stats = isObject(day.stats) ? day.stats : undefined
        const pv = stats && isObject(stats.profileViews) ? stats.profileViews : undefined
        day.profileViewsEntries = pv ? [pv] : []
      }
    }
  }

  // v3 -> v4: per-day linkedin.com/dashboard/ history.
  if (version < 4 && isObject(data.days)) {
    for (const day of Object.values(data.days)) {
      if (!isObject(day)) continue
      if (!Array.isArray(day.linkedInDashboardEntries)) {
        const stats = isObject(day.stats) ? day.stats : undefined
        const dashboard =
          stats && isObject(stats.linkedInDashboard) ? stats.linkedInDashboard : undefined
        day.linkedInDashboardEntries = dashboard ? [dashboard] : []
      }
    }
  }

  // Future migrations go here:
  // if ((data.schemaVersion as number) < 5) { ... }

  data.settings = mergeSettings(DEFAULT_SETTINGS, data.settings)
  data.schemaVersion = SCHEMA_VERSION
  return data as unknown as StorageRoot
}
