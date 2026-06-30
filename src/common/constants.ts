import type {
  DailyGoals,
  NotificationSettings,
  PrivacySettings,
  ReactionType,
  Settings,
  TrackedEventType,
  TrackingToggles,
} from './types'

/** Bump this when the persisted schema changes and add a migration. */
export const SCHEMA_VERSION = 1

/** Single chrome.storage.local key holding the entire StorageRoot. */
export const STORAGE_KEY = 'lat:root'

export const DEFAULT_GOALS: DailyGoals = {
  activeMinutes: 25,
  reactions: 5,
  comments: 2,
  connectionRequests: 5,
  messages: 2,
  reposts: 1,
  posts: 0,
}

export const DEFAULT_TRACKING: TrackingToggles = {
  activeTime: true,
  reaction: true,
  comment: true,
  connection_request: true,
  message: true,
  repost: true,
  post: true,
  // MVP+ / noisy categories are off by default (spec §6.7, §6.8).
  follow: false,
  profile_view: false,
  company_view: false,
  job_view: false,
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  storeCommentLength: false,
  storeCommentMeaningful: true,
  storeConnectionProfileUrl: false,
  storeConnectionDisplayName: false,
  meaningfulCommentMinChars: 20,
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  dailyReminder: false,
  goalCompletion: false,
  reminderTime: '18:00',
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  theme: 'system',
  idleThresholdSeconds: 60,
  goals: DEFAULT_GOALS,
  tracking: DEFAULT_TRACKING,
  privacy: DEFAULT_PRIVACY,
  notifications: DEFAULT_NOTIFICATIONS,
  paused: false,
  debug: false,
}

export const IDLE_THRESHOLD_OPTIONS = [30, 60, 120, 300] as const

export const REACTION_TYPES: ReactionType[] = [
  'like',
  'celebrate',
  'support',
  'love',
  'insightful',
  'funny',
]

/**
 * How long (ms) a given deduplication key suppresses repeat events. Tuned to
 * absorb React re-renders / repeated MutationObserver firings without dropping
 * genuinely separate user actions.
 */
export const DEDUP_WINDOW_MS: Record<TrackedEventType, number> = {
  reaction: 4000,
  comment: 8000,
  reply: 8000,
  connection_request: 10000,
  message: 6000,
  repost: 8000,
  post: 15000,
  follow: 8000,
  profile_view: 3000,
  company_view: 3000,
  job_view: 3000,
}

/** Max diagnostic entries retained (ring buffer). */
export const MAX_DIAGNOSTICS = 200

/** Active-time tick cadence from the content script to the worker (ms). */
export const ACTIVE_TIME_TICK_MS = 5000

/** A single tick contributes at most this many active seconds. */
export const ACTIVE_TIME_TICK_SECONDS = ACTIVE_TIME_TICK_MS / 1000
