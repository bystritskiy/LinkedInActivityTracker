// Core data model for the LinkedIn Activity Tracker.
//
// Everything here is plain data that is safe to persist to chrome.storage.local.
// No DOM nodes, no raw HTML fragments, no LinkedIn-specific selectors — those
// live in the content layer and are deliberately kept out of the stored model.

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type TrackedEventType =
  | 'reaction'
  | 'comment'
  | 'reply'
  | 'connection_request'
  | 'message'
  | 'repost'
  | 'post'
  | 'follow'
  | 'profile_view'
  | 'company_view'
  | 'job_view'

/** Whether an event was recorded automatically by a detector or entered by hand. */
export type EventSource = 'automatic' | 'manual'

export type ReactionType =
  | 'like'
  | 'celebrate'
  | 'support'
  | 'love'
  | 'insightful'
  | 'funny'
  | 'unknown'

export type ReactionTargetType = 'post' | 'comment' | 'unknown'
export type CommentKind = 'comment' | 'reply'
export type ConnectionSource = 'profile' | 'search' | 'recommendations' | 'unknown'
export type RepostKind = 'instant' | 'with_thoughts'
export type PostKind =
  | 'text'
  | 'image'
  | 'video'
  | 'document'
  | 'poll'
  | 'article'
  | 'newsletter'
  | 'unknown'
export type MessageKind = 'new' | 'reply' | 'inmail' | 'unknown'

// Type-specific metadata shapes. Stored under TrackedEvent.metadata. All fields
// are optional and privacy-gated. They are stored only when the corresponding
// local privacy toggle is enabled (see PrivacySettings).
export interface ReactionMetadata {
  reactionType?: ReactionType
  targetType?: ReactionTargetType
}
export interface CommentMetadata {
  kind?: CommentKind
  characterCount?: number
  meaningful?: boolean
}
export interface ConnectionMetadata {
  source?: ConnectionSource
  profileUrl?: string
  displayName?: string
}
export interface RepostMetadata {
  kind?: RepostKind
}
export interface PostMetadata {
  kind?: PostKind
}
export interface MessageMetadata {
  kind?: MessageKind
}

export interface TrackedEvent {
  id: string
  type: TrackedEventType
  /** ISO 8601 timestamp. */
  timestamp: string
  /** Local-day bucket (YYYY-MM-DD) computed in the user's timezone at event time. */
  dayKey: string
  /** Sanitized URL: origin + pathname only. Never query string or hash. */
  url?: string
  metadata?: Record<string, unknown>
  source: EventSource
  /** Key used to suppress duplicate observer firings within a short window. */
  deduplicationKey?: string
}

// ---------------------------------------------------------------------------
// Pages & active time
// ---------------------------------------------------------------------------

export type LinkedInPageType =
  | 'feed'
  | 'profile'
  | 'company'
  | 'search'
  | 'network'
  | 'messaging'
  | 'jobs'
  | 'notifications'
  | 'post'
  | 'ssi'
  | 'analytics'
  | 'dashboard'
  | 'other'

export interface ActivitySession {
  id: string
  startedAt: string
  endedAt: string
  activeSeconds: number
  /** Seconds spent per LinkedInPageType during this session. */
  pageTypes: Record<string, number>
}

// ---------------------------------------------------------------------------
// SSI, goals, daily stats
// ---------------------------------------------------------------------------

export interface SSIEntry {
  timestamp: string
  total: number
  professionalBrand?: number
  findRightPeople?: number
  engageWithInsights?: number
  buildRelationships?: number
  /** How the entry was captured: read off the SSI page or typed in by hand. */
  source?: EventSource
}

/**
 * A reading of the "Who's viewed your profile" analytics page. Only the
 * aggregate count is stored — never who the viewers are.
 */
export interface ProfileViewsEntry {
  timestamp: string
  /** Total profile viewers LinkedIn reports for the period. */
  viewers: number
  /** The period the count covers, in days (e.g. 90), when detected. */
  rangeDays?: number
  /** How the entry was captured: read off the analytics page or typed in by hand. */
  source?: EventSource
}

/**
 * A reading of linkedin.com/dashboard/. These are aggregate counters only; the
 * extension never stores individual viewers, followers, searches, or posts.
 */
export interface LinkedInDashboardEntry {
  timestamp: string
  postImpressions?: number
  postImpressionsRangeDays?: number
  followers?: number
  followersChangePercent?: number
  profileViewers?: number
  profileViewersRangeDays?: number
  searchAppearances?: number
  searchAppearancesPeriod?: string
  searchAppearancesChangePercent?: number
  weeklyPosts?: number
  weeklyComments?: number
  weeklyPeriod?: string
  source?: EventSource
}

export interface DailyGoals {
  reactions: number
  comments: number
  connectionRequests: number
  messages: number
  reposts: number
  posts: number
}

export type Counters = Partial<Record<TrackedEventType, number>>

export interface DailyStats {
  dayKey: string
  activeSeconds: number
  counters: Counters
  ssi?: SSIEntry
  profileViews?: ProfileViewsEntry
  linkedInDashboard?: LinkedInDashboardEntry
  /** Snapshot of the goals that were active on this day (for accurate history). */
  goalsSnapshot?: DailyGoals
}

/** Everything stored for a single local day. */
export interface DayRecord {
  dayKey: string
  stats: DailyStats
  events: TrackedEvent[]
  sessions: ActivitySession[]
  /** Every SSI observation made this day (append-only); stats.ssi is the latest. */
  ssiEntries: SSIEntry[]
  /** Every profile-views observation made this day; stats.profileViews is the latest. */
  profileViewsEntries: ProfileViewsEntry[]
  /** Every /dashboard/ observation made this day; stats.linkedInDashboard is the latest. */
  linkedInDashboardEntries: LinkedInDashboardEntry[]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type LocaleCode = 'en' | 'ru'
export type ThemePreference = 'system' | 'light' | 'dark'
export type IdleThresholdSeconds = 30 | 60 | 120 | 300

/** Which event types are tracked. Privacy-sensitive / noisy ones default off. */
export interface TrackingToggles {
  activeTime: boolean
  reaction: boolean
  comment: boolean
  connection_request: boolean
  message: boolean
  repost: boolean
  post: boolean
  follow: boolean
  profile_view: boolean
  company_view: boolean
  job_view: boolean
}

export interface PrivacySettings {
  /** Store the character count of comments. Default: off. */
  storeCommentLength: boolean
  /** Store only a boolean "meaningful" flag (length >= threshold). Default: on. */
  storeCommentMeaningful: boolean
  /** Store the profile URL for connection requests. Default: off (privacy-first). */
  storeConnectionProfileUrl: boolean
  /** Store the display name for connection requests. Default: off. */
  storeConnectionDisplayName: boolean
  /** Minimum characters for a comment to be considered "meaningful". */
  meaningfulCommentMinChars: number
}

export interface NotificationSettings {
  /** The single opt-in reminder allowed by the spec. Default: off. */
  dailyReminder: boolean
  goalCompletion: boolean
  /** Local time HH:MM for the daily reminder. */
  reminderTime: string
}

export interface Settings {
  locale: LocaleCode
  theme: ThemePreference
  idleThresholdSeconds: IdleThresholdSeconds
  goals: DailyGoals
  tracking: TrackingToggles
  privacy: PrivacySettings
  notifications: NotificationSettings
  /** Global pause — when true, no automatic events or active time are recorded. */
  paused: boolean
  /** Verbose console logging in content/background. */
  debug: boolean
}

// ---------------------------------------------------------------------------
// Reliability: selector health & diagnostics
// ---------------------------------------------------------------------------

export type DetectorKey =
  | 'reaction'
  | 'comment'
  | 'connection'
  | 'message'
  | 'repost'
  | 'post'
  | 'activeTime'
  | 'navigation'
  | 'ssi'
  | 'profileViews'
  | 'linkedInDashboard'

export type DetectorStatus = 'working' | 'needs_verification' | 'unknown'

export interface DetectorHealth {
  status: DetectorStatus
  lastConfirmedAt?: string
  lastCheckedAt?: string
  note?: string
}

export type SelectorHealth = Partial<Record<DetectorKey, DetectorHealth>>

export type DiagnosticLevel = 'info' | 'warn' | 'error'

export interface DiagnosticEntry {
  id: string
  timestamp: string
  level: DiagnosticLevel
  /** Subsystem or detector key. */
  source: string
  /** Machine-readable code, e.g. "unknown_event", "selector_miss". */
  code: string
  /** Human-readable message. Must never contain personal data. */
  message: string
}

// ---------------------------------------------------------------------------
// Storage root
// ---------------------------------------------------------------------------

export interface StorageRoot {
  schemaVersion: number
  settings: Settings
  /** Per-day records keyed by dayKey (YYYY-MM-DD). */
  days: Record<string, DayRecord>
  selectorHealth: SelectorHealth
  /** Bounded ring buffer of diagnostic entries. */
  diagnostics: DiagnosticEntry[]
  installedAt: string
  lastSeenVersion: string
}
