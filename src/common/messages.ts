// Message protocol between content script / UI pages and the background worker.
//
// Split of responsibilities:
//  - All WRITES go through the worker (so dedup, aggregation, migrations and
//    rollover stay centralized).
//  - UI READS come straight from chrome.storage.local + storage.onChanged, so
//    the popup opens fast and stays live without round-trips.

import type {
  DailyGoals,
  DiagnosticLevel,
  DetectorKey,
  DetectorStatus,
  IdleThresholdSeconds,
  LinkedInPageType,
  LocaleCode,
  NotificationSettings,
  PrivacySettings,
  SSIEntry,
  StorageRoot,
  ThemePreference,
  TrackedEvent,
  TrackedEventType,
  TrackingToggles,
} from './types'

export type ExportFormat = 'markdown' | 'json' | 'csv'

export interface SettingsPatch {
  locale?: LocaleCode
  theme?: ThemePreference
  idleThresholdSeconds?: IdleThresholdSeconds
  goals?: Partial<DailyGoals>
  tracking?: Partial<TrackingToggles>
  privacy?: Partial<PrivacySettings>
  notifications?: Partial<NotificationSettings>
  paused?: boolean
  debug?: boolean
}

// ---- Content script -> worker ----
export type ContentMessage =
  | { kind: 'event'; event: TrackedEvent }
  | {
      kind: 'reactionRemoved'
      targetId: string
      url?: string
      deduplicationKey: string
      timestamp: string
      dayKey: string
    }
  | { kind: 'activeTick'; seconds: number; pageType: LinkedInPageType }
  | {
      kind: 'diagnostic'
      level: DiagnosticLevel
      source: string
      code: string
      message: string
    }
  | {
      kind: 'selectorHealth'
      detector: DetectorKey
      status: DetectorStatus
      note?: string
    }

// ---- UI -> worker ----
export type UiMessage =
  | { kind: 'getState' }
  | { kind: 'updateSettings'; patch: SettingsPatch }
  | { kind: 'setGoals'; goals: DailyGoals }
  | { kind: 'setPaused'; paused: boolean }
  | { kind: 'manualAdjust'; dayKey: string; eventType: TrackedEventType; delta: number }
  | { kind: 'addManualEvent'; dayKey: string; eventType: TrackedEventType }
  | { kind: 'deleteEvent'; dayKey: string; eventId: string }
  | { kind: 'setActiveSeconds'; dayKey: string; seconds: number }
  | { kind: 'addSSI'; dayKey: string; ssi: SSIEntry }
  | { kind: 'export'; format: ExportFormat; dayKey?: string }
  | { kind: 'exportDiagnostics' }
  | { kind: 'clearDiagnostics' }
  | { kind: 'importJson'; payload: string }
  | { kind: 'clearAllData' }

export type Message = ContentMessage | UiMessage

export interface Ack {
  ok: boolean
  error?: string
}

export interface ExportResult {
  ok: boolean
  error?: string
  format?: ExportFormat
  filename?: string
  mime?: string
  content?: string
}

export interface ImportResult {
  ok: boolean
  error?: string
  importedDays?: number
}

/** Maps a UI request kind to its response payload type. */
export interface ResponseMap {
  getState: StorageRoot
  updateSettings: Ack
  setGoals: Ack
  setPaused: Ack
  manualAdjust: Ack
  addManualEvent: Ack
  deleteEvent: Ack
  setActiveSeconds: Ack
  addSSI: Ack
  export: ExportResult
  exportDiagnostics: ExportResult
  clearDiagnostics: Ack
  importJson: ImportResult
  clearAllData: Ack
}
