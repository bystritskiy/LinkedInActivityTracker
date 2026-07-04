// Shared aggregation helpers used by the popup, dashboard, and exporters so the
// "comments includes replies", "invitations = connection requests" mapping is
// defined in exactly one place.

import type { DailyGoals, DailyStats } from './types'
import { secondsToMinutes } from './date'

export interface DaySummary {
  dayKey: string
  activeSeconds: number
  activeMinutes: number
  reactions: number
  comments: number
  connectionRequests: number
  messages: number
  reposts: number
  posts: number
  follows: number
  ssi?: number
  /** Latest "Who's viewed your profile" count observed this day. */
  profileViewers?: number
  /** Latest post impressions observed on linkedin.com/dashboard/. */
  postImpressions?: number
  /** Latest follower total observed on linkedin.com/dashboard/. */
  followers?: number
  /** Latest search appearances observed on linkedin.com/dashboard/. */
  searchAppearances?: number
}

export function summarizeStats(stats: DailyStats): DaySummary {
  const c = stats.counters
  return {
    dayKey: stats.dayKey,
    activeSeconds: stats.activeSeconds,
    activeMinutes: secondsToMinutes(stats.activeSeconds),
    reactions: c.reaction ?? 0,
    // A reply is a kind of comment for goal purposes.
    comments: (c.comment ?? 0) + (c.reply ?? 0),
    connectionRequests: c.connection_request ?? 0,
    messages: c.message ?? 0,
    reposts: c.repost ?? 0,
    posts: c.post ?? 0,
    follows: c.follow ?? 0,
    ssi: stats.ssi?.total,
    profileViewers: stats.profileViews?.viewers,
    postImpressions: stats.linkedInDashboard?.postImpressions,
    followers: stats.linkedInDashboard?.followers,
    searchAppearances: stats.linkedInDashboard?.searchAppearances,
  }
}

export type GoalKey =
  | 'reaction'
  | 'comment'
  | 'connection_request'
  | 'message'
  | 'repost'
  | 'post'

export interface GoalRow {
  key: GoalKey
  current: number
  target: number
  met: boolean
  /** 0..1 progress, capped at 1. */
  ratio: number
}

export function goalRows(summary: DaySummary, goals: DailyGoals): GoalRow[] {
  const base: Array<{ key: GoalKey; current: number; target: number }> = [
    { key: 'reaction', current: summary.reactions, target: goals.reactions },
    { key: 'comment', current: summary.comments, target: goals.comments },
    { key: 'connection_request', current: summary.connectionRequests, target: goals.connectionRequests },
    { key: 'message', current: summary.messages, target: goals.messages },
    { key: 'repost', current: summary.reposts, target: goals.reposts },
    { key: 'post', current: summary.posts, target: goals.posts },
  ]
  return base.map((r) => ({
    ...r,
    met: r.current >= r.target,
    ratio: r.target <= 0 ? (r.current > 0 ? 1 : 1) : Math.min(1, r.current / r.target),
  }))
}
