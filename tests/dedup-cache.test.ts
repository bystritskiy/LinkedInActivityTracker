import { describe, expect, it } from 'vitest'
import { accept, resetDedupCache } from '../src/background/dedup-cache'

describe('dedup cache', () => {
  it('suppresses repeated keys inside the window and accepts after it', () => {
    resetDedupCache()
    expect(accept('reaction:post-1', 4000, 1000)).toBe(true)
    expect(accept('reaction:post-1', 4000, 2000)).toBe(false)
    expect(accept('reaction:post-1', 4000, 7000)).toBe(true)
  })
})
