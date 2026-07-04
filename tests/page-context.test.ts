import { describe, expect, it } from 'vitest'
import { detectPageType, sanitizeUrl } from '../src/content/page-context'

describe('page context', () => {
  it('classifies LinkedIn routes from pathnames', () => {
    expect(detectPageType('/feed/')).toBe('feed')
    expect(detectPageType('/in/someone/')).toBe('profile')
    expect(detectPageType('/company/openai/')).toBe('company')
    expect(detectPageType('/search/results/people/')).toBe('search')
    expect(detectPageType('/sales/ssi')).toBe('ssi')
    expect(detectPageType('/analytics/profile-views/')).toBe('analytics')
    expect(detectPageType('/me/profile-views')).toBe('analytics')
    expect(detectPageType('/unknown')).toBe('other')
  })

  it('removes query and hash from stored URLs', () => {
    expect(sanitizeUrl('https://www.linkedin.com/feed/?trk=abc#x')).toBe(
      'https://www.linkedin.com/feed/',
    )
  })
})
