import type { LinkedInPageType } from '../common/types'
import type { DetectionContext } from './detector'

/** Classify the LinkedIn page from a pathname. Robust to locale (URL-based). */
export function detectPageType(pathname: string = location.pathname): LinkedInPageType {
  const p = pathname.toLowerCase()
  if (p.startsWith('/feed/update/') || p.startsWith('/posts/')) return 'post'
  // The 2026 UI serves the home feed at the bare root path.
  if (p === '/' || p === '/feed' || p.startsWith('/feed/')) return 'feed'
  if (p.startsWith('/in/')) return 'profile'
  if (p.startsWith('/company/') || p.startsWith('/school/')) return 'company'
  if (p.startsWith('/search/')) return 'search'
  if (p.startsWith('/mynetwork/')) return 'network'
  if (p.startsWith('/messaging/')) return 'messaging'
  if (p.startsWith('/jobs/')) return 'jobs'
  if (p.startsWith('/notifications/')) return 'notifications'
  if (p.startsWith('/sales/ssi') || p.includes('/ssi')) return 'ssi'
  return 'other'
}

/** Strip query string and hash — privacy-first URL retention. */
export function sanitizeUrl(href: string = location.href): string | undefined {
  try {
    const u = new URL(href)
    return u.origin + u.pathname
  } catch {
    return undefined
  }
}

let current: DetectionContext = {
  pageType: detectPageType(),
  url: sanitizeUrl(),
}

export function getContext(): DetectionContext {
  return current
}

export function refreshContext(): DetectionContext {
  current = { pageType: detectPageType(), url: sanitizeUrl() }
  return current
}
