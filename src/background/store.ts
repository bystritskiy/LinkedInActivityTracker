// Orchestration layer: turns incoming messages into serialized, persisted state
// changes. Applies pause, per-type tracking toggles, privacy gating, and
// short-term deduplication before anything is written.

import type {
  Ack,
  ContentMessage,
  ExportResult,
  ImportResult,
  Message,
  SettingsPatch,
  UiMessage,
} from '../common/messages'
import type {
  CommentMetadata,
  ConnectionMetadata,
  PrivacySettings,
  Settings,
  StorageRoot,
  TrackedEvent,
  TrackedEventType,
} from '../common/types'
import { DEDUP_WINDOW_MS } from '../common/constants'
import {
  clearRoot,
  createEmptyRoot,
  readRoot,
  saveRoot,
  withRoot,
} from './storage'
import {
  addActiveSeconds,
  addManualEvent,
  manualAdjust,
  recordEvent,
  removeEventById,
  removeReactionByDedupKey,
  setActiveSeconds,
  setSSI,
  todayKey,
} from './reducer'
import { accept } from './dedup-cache'
import { buildDiagnosticsExport, pushDiagnostic, setSelectorHealth } from './diagnostics'
import { buildExport } from './export'
import { importBackup } from './import'

// Whether the machine is active (set from chrome.idle in the worker entry).
let machineActive = true
export function setMachineActive(active: boolean): void {
  machineActive = active
}

const ACK_OK: Ack = { ok: true }

function trackingEnabled(settings: Settings, type: TrackedEventType): boolean {
  if (type === 'reply') return settings.tracking.comment
  return settings.tracking[type]
}

function gateCommentMetadata(meta: CommentMetadata, privacy: PrivacySettings): CommentMetadata {
  const out: CommentMetadata = { kind: meta.kind }
  const count = typeof meta.characterCount === 'number' ? meta.characterCount : undefined
  if (privacy.storeCommentLength && count !== undefined) out.characterCount = count
  if (privacy.storeCommentMeaningful && count !== undefined) {
    out.meaningful = count >= privacy.meaningfulCommentMinChars
  }
  return out
}

function gateConnectionMetadata(
  meta: ConnectionMetadata,
  privacy: PrivacySettings,
): ConnectionMetadata {
  const out: ConnectionMetadata = { source: meta.source }
  if (privacy.storeConnectionProfileUrl && meta.profileUrl) out.profileUrl = meta.profileUrl
  if (privacy.storeConnectionDisplayName && meta.displayName) out.displayName = meta.displayName
  return out
}

/** Strip any privacy-sensitive metadata the user hasn't opted into. */
function gateMetadata(event: TrackedEvent, settings: Settings): Record<string, unknown> | undefined {
  const meta = event.metadata
  if (!meta) return undefined
  if (event.type === 'comment' || event.type === 'reply') {
    return gateCommentMetadata(meta as CommentMetadata, settings.privacy) as Record<string, unknown>
  }
  if (event.type === 'connection_request') {
    return gateConnectionMetadata(meta as ConnectionMetadata, settings.privacy) as Record<
      string,
      unknown
    >
  }
  return meta
}

function applySettingsPatch(settings: Settings, patch: SettingsPatch): void {
  if (patch.locale !== undefined) settings.locale = patch.locale
  if (patch.theme !== undefined) settings.theme = patch.theme
  if (patch.idleThresholdSeconds !== undefined) {
    settings.idleThresholdSeconds = patch.idleThresholdSeconds
  }
  if (patch.paused !== undefined) settings.paused = patch.paused
  if (patch.debug !== undefined) settings.debug = patch.debug
  if (patch.goals) settings.goals = { ...settings.goals, ...patch.goals }
  if (patch.tracking) settings.tracking = { ...settings.tracking, ...patch.tracking }
  if (patch.privacy) settings.privacy = { ...settings.privacy, ...patch.privacy }
  if (patch.notifications) {
    settings.notifications = { ...settings.notifications, ...patch.notifications }
  }
}

// ---------------------------------------------------------------------------
// Content messages (fire-and-forget, no response needed)
// ---------------------------------------------------------------------------

async function handleContent(msg: ContentMessage): Promise<void> {
  switch (msg.kind) {
    case 'event': {
      const event = msg.event
      // Dedup happens before the storage round-trip to cheaply drop bursts.
      if (event.deduplicationKey) {
        const window = DEDUP_WINDOW_MS[event.type] ?? 5000
        if (!accept(event.deduplicationKey, window)) return
      }
      await withRoot((root) => {
        if (root.settings.paused) return
        if (!trackingEnabled(root.settings, event.type)) {
          pushDiagnostic(root, 'info', 'background', 'event_skipped_tracking_disabled', event.type)
          return
        }
        const gated: TrackedEvent = { ...event, source: 'automatic', metadata: gateMetadata(event, root.settings) }
        recordEvent(root, gated)
        setSelectorHealth(root, detectorKeyForType(event.type), 'working')
        pushDiagnostic(root, 'info', detectorKeyForType(event.type), 'event_recorded', event.type)
      })
      return
    }
    case 'reactionRemoved': {
      await withRoot((root) => {
        if (root.settings.paused) return
        removeReactionByDedupKey(root, msg.dayKey, msg.deduplicationKey)
      })
      return
    }
    case 'activeTick': {
      if (!machineActive) return
      await withRoot((root) => {
        if (root.settings.paused || !root.settings.tracking.activeTime) return
        addActiveSeconds(root, todayKey(), msg.seconds, msg.pageType)
      })
      return
    }
    case 'ssiSnapshot': {
      await withRoot((root) => {
        if (root.settings.paused) return
        // Every page visit appends an observation — even with unchanged
        // scores — so the history reflects when the user actually checked.
        setSSI(root, msg.dayKey, { ...msg.ssi, source: 'automatic' })
        setSelectorHealth(root, 'ssi', 'working')
        pushDiagnostic(root, 'info', 'ssi', 'ssi_recorded', `total=${msg.ssi.total}`)
      })
      return
    }
    case 'diagnostic': {
      await withRoot((root) => {
        pushDiagnostic(root, msg.level, msg.source, msg.code, msg.message)
      })
      return
    }
    case 'selectorHealth': {
      await withRoot((root) => {
        setSelectorHealth(root, msg.detector, msg.status, msg.note)
      })
      return
    }
  }
}

function detectorKeyForType(type: TrackedEventType) {
  switch (type) {
    case 'reaction':
      return 'reaction' as const
    case 'comment':
    case 'reply':
      return 'comment' as const
    case 'connection_request':
      return 'connection' as const
    case 'message':
      return 'message' as const
    case 'repost':
      return 'repost' as const
    case 'post':
      return 'post' as const
    default:
      return 'reaction' as const
  }
}

// ---------------------------------------------------------------------------
// UI messages (request/response)
// ---------------------------------------------------------------------------

async function handleUi(
  msg: UiMessage,
): Promise<StorageRoot | Ack | ExportResult | ImportResult> {
  switch (msg.kind) {
    case 'getState':
      return readRoot()
    case 'updateSettings':
      return withRoot((root) => {
        applySettingsPatch(root.settings, msg.patch)
        return ACK_OK
      })
    case 'setGoals':
      return withRoot((root) => {
        root.settings.goals = { ...root.settings.goals, ...msg.goals }
        const today = root.days[todayKey()]
        if (today) today.stats.goalsSnapshot = { ...root.settings.goals }
        return ACK_OK
      })
    case 'setPaused':
      return withRoot((root) => {
        root.settings.paused = msg.paused
        return ACK_OK
      })
    case 'manualAdjust':
      return withRoot((root) => {
        manualAdjust(root, msg.dayKey, msg.eventType, msg.delta)
        return ACK_OK
      })
    case 'addManualEvent':
      return withRoot((root) => {
        addManualEvent(root, msg.dayKey, msg.eventType)
        return ACK_OK
      })
    case 'deleteEvent':
      return withRoot((root) => {
        const removed = removeEventById(root, msg.dayKey, msg.eventId)
        return removed ? ACK_OK : { ok: false, error: 'not_found' }
      })
    case 'setActiveSeconds':
      return withRoot((root) => {
        setActiveSeconds(root, msg.dayKey, msg.seconds)
        return ACK_OK
      })
    case 'addSSI':
      return withRoot((root) => {
        setSSI(root, msg.dayKey, { source: 'manual', ...msg.ssi })
        return ACK_OK
      })
    case 'export':
      return readRoot().then((root): ExportResult => ({ ok: true, ...buildExport(root, msg.format, msg.dayKey) }))
    case 'exportDiagnostics':
      return readRoot().then((root): ExportResult => ({
        ok: true,
        format: 'json',
        filename: `linkedin-activity-diagnostics-${todayKey()}.json`,
        mime: 'application/json',
        content: buildDiagnosticsExport(root),
      }))
    case 'clearDiagnostics':
      return withRoot((root) => {
        root.diagnostics = []
        return ACK_OK
      })
    case 'importJson':
      return withRoot((root) => importBackup(root, msg.payload))
    case 'clearAllData':
      return clearAllData()
  }
}

async function clearAllData(): Promise<Ack> {
  // Preserve the user's settings; wipe all tracked history and diagnostics.
  const current = await readRoot()
  const fresh = createEmptyRoot()
  fresh.settings = current.settings
  fresh.installedAt = current.installedAt
  await clearRoot()
  await saveRoot(fresh)
  return ACK_OK
}

const UI_KINDS = new Set<UiMessage['kind']>([
  'getState',
  'updateSettings',
  'setGoals',
  'setPaused',
  'manualAdjust',
  'addManualEvent',
  'deleteEvent',
  'setActiveSeconds',
  'addSSI',
  'export',
  'exportDiagnostics',
  'clearDiagnostics',
  'importJson',
  'clearAllData',
])

function isUiMessage(msg: Message): msg is UiMessage {
  return UI_KINDS.has(msg.kind as UiMessage['kind'])
}

/**
 * Single entry point for the worker's onMessage listener. UI messages resolve
 * to a response payload; content messages resolve to undefined.
 */
export async function dispatch(msg: Message): Promise<unknown> {
  if (isUiMessage(msg)) return handleUi(msg)
  await handleContent(msg as ContentMessage)
  return undefined
}
