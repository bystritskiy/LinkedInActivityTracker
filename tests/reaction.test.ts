import { describe, expect, it } from 'vitest'
import { decideReaction } from '../src/content/detectors/reaction'

describe('reaction decision', () => {
  it('counts only net add/remove, not type changes', () => {
    expect(decideReaction(false, true)).toBe('add')
    expect(decideReaction(true, false)).toBe('remove')
    expect(decideReaction(true, true)).toBe('none')
    expect(decideReaction(false, false)).toBe('none')
  })
})
