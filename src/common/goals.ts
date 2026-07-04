import type { DailyGoals } from './types'

export const DAILY_GOAL_KEYS = [
  'reactions',
  'comments',
  'connectionRequests',
  'messages',
  'reposts',
  'posts',
] as const satisfies readonly (keyof DailyGoals)[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeGoals(base: DailyGoals, patch: unknown): DailyGoals {
  const next: DailyGoals = { ...base }
  if (!isRecord(patch)) return next
  for (const key of DAILY_GOAL_KEYS) {
    const value = patch[key]
    if (typeof value === 'number') next[key] = value
  }
  return next
}
