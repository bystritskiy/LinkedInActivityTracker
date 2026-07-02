// Observe SPA navigations on LinkedIn. We monkey-patch history.pushState /
// replaceState purely to OBSERVE route changes (we always call through to the
// originals and never alter navigation behavior), plus listen for popstate.
// This performs no LinkedIn actions and changes nothing the user sees.

import { trace } from './messaging'

export function watchNavigation(onChange: () => void): () => void {
  let lastUrl = location.href
  const fire = () => {
    // Defer so the SPA has a tick to update the DOM/URL before we re-read it.
    setTimeout(() => {
      if (location.href === lastUrl) return
      lastUrl = location.href
      trace('navigation', 'url_changed', location.pathname)
      try {
        onChange()
      } catch {
        // ignore
      }
    }, 0)
  }

  const origPush = history.pushState
  const origReplace = history.replaceState

  history.pushState = function patchedPushState(this: History, ...args) {
    const result = origPush.apply(this, args as Parameters<History['pushState']>)
    fire()
    return result
  }
  history.replaceState = function patchedReplaceState(this: History, ...args) {
    const result = origReplace.apply(this, args as Parameters<History['replaceState']>)
    fire()
    return result
  }
  window.addEventListener('popstate', fire)

  return () => {
    history.pushState = origPush
    history.replaceState = origReplace
    window.removeEventListener('popstate', fire)
  }
}
