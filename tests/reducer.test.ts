import { describe, expect, it } from 'vitest'
import type { StorageRoot, TrackedEvent } from '../src/common/types'
import { createEmptyRoot } from '../src/background/storage'
import {
  addActiveSeconds,
  manualAdjust,
  recordEvent,
  removeReactionByDedupKey,
  setProfileViews,
  setSSI,
} from '../src/background/reducer'

function root(): StorageRoot {
  return createEmptyRoot('0.1.0')
}

function event(overrides: Partial<TrackedEvent>): TrackedEvent {
  return {
    id: 'event-1',
    type: 'reaction',
    timestamp: '2026-06-30T12:00:00.000Z',
    dayKey: '2026-06-30',
    source: 'automatic',
    ...overrides,
  }
}

describe('reducer', () => {
  it('records events and recomputes counters from the event list', () => {
    const state = root()
    expect(recordEvent(state, event({ id: 'reaction-1' }))).toBe(true)
    expect(recordEvent(state, event({ id: 'comment-1', type: 'comment' }))).toBe(true)
    expect(recordEvent(state, event({ id: 'comment-1', type: 'comment' }))).toBe(false)

    expect(state.days['2026-06-30'].stats.counters).toEqual({
      reaction: 1,
      comment: 1,
    })
  })

  it('manual negative adjustments never go below zero', () => {
    const state = root()
    manualAdjust(state, '2026-06-30', 'message', 2)
    manualAdjust(state, '2026-06-30', 'message', -5)

    expect(state.days['2026-06-30'].events).toHaveLength(0)
    expect(state.days['2026-06-30'].stats.counters).toEqual({})
  })

  it('removes a reaction by deduplication key as compensation', () => {
    const state = root()
    recordEvent(
      state,
      event({
        id: 'reaction-1',
        deduplicationKey: 'reaction:urn-1',
      }),
    )

    expect(removeReactionByDedupKey(state, '2026-06-30', 'reaction:urn-1')).toBe(true)
    expect(state.days['2026-06-30'].stats.counters).toEqual({})
  })

  it('tracks active seconds by page type and stores SSI per day', () => {
    const state = root()
    addActiveSeconds(state, '2026-06-30', 5, 'feed', '2026-06-30T12:00:00.000Z')
    addActiveSeconds(state, '2026-06-30', 10, 'messaging', '2026-06-30T12:01:00.000Z')
    setSSI(state, '2026-06-30', { timestamp: '2026-06-30T12:02:00.000Z', total: 42 })

    const day = state.days['2026-06-30']
    expect(day.stats.activeSeconds).toBe(15)
    expect(day.sessions[0].pageTypes).toEqual({ feed: 5, messaging: 10 })
    expect(day.stats.ssi?.total).toBe(42)
  })

  it('keeps a per-day history of SSI observations with the latest as the summary', () => {
    const state = root()
    setSSI(state, '2026-06-30', {
      timestamp: '2026-06-30T09:00:00.000Z',
      total: 32,
      professionalBrand: 11.9,
      source: 'automatic',
    })
    setSSI(state, '2026-06-30', {
      timestamp: '2026-06-30T18:00:00.000Z',
      total: 33,
      professionalBrand: 12.05,
      findRightPeople: 4.76,
      engageWithInsights: 1,
      buildRelationships: 15,
      source: 'automatic',
    })

    const day = state.days['2026-06-30']
    expect(day.ssiEntries).toHaveLength(2)
    expect(day.ssiEntries[0].total).toBe(32)
    expect(day.stats.ssi?.total).toBe(33)
    expect(day.stats.ssi?.buildRelationships).toBe(15)
  })

  it('keeps a per-day history of profile-views observations with the latest as the summary', () => {
    const state = root()
    setProfileViews(state, '2026-06-30', {
      timestamp: '2026-06-30T09:00:00.000Z',
      viewers: 51,
      rangeDays: 90,
      source: 'automatic',
    })
    setProfileViews(state, '2026-06-30', {
      timestamp: '2026-06-30T18:00:00.000Z',
      viewers: 54,
      rangeDays: 90,
      source: 'automatic',
    })

    const day = state.days['2026-06-30']
    expect(day.profileViewsEntries).toHaveLength(2)
    expect(day.profileViewsEntries[0].viewers).toBe(51)
    expect(day.stats.profileViews?.viewers).toBe(54)
    expect(day.stats.profileViews?.rangeDays).toBe(90)
  })
})
