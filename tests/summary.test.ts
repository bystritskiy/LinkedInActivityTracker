import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from '../src/common/constants'
import { mergeGoals } from '../src/common/goals'
import { goalRows, summarizeStats } from '../src/common/summary'

describe('summary goals', () => {
  it('keeps active time as a stat but not a daily goal', () => {
    const summary = summarizeStats({
      dayKey: '2026-07-04',
      activeSeconds: 25 * 60,
      counters: { reaction: 1 },
    })

    expect(summary.activeMinutes).toBe(25)
    expect(goalRows(summary, DEFAULT_GOALS).map((row) => row.key)).toEqual([
      'reaction',
      'comment',
      'connection_request',
      'message',
      'repost',
      'post',
    ])
  })

  it('drops legacy active-minute targets when goals are merged', () => {
    const goals = mergeGoals(DEFAULT_GOALS, { activeMinutes: 25, reactions: 9 })

    expect(goals.reactions).toBe(9)
    expect(goals).not.toHaveProperty('activeMinutes')
  })
})
