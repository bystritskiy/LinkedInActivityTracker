// Minimal self-removing status toast shown by the content script.
//
// This is the extension's own feedback UI layered over the page — it must
// never affect LinkedIn: pointer-events is disabled so it can't swallow
// clicks, it triggers no page logic, and it removes itself.

const TOAST_ID = 'lat-toast'
const FADE_MS = 250
const BRAND = 'LinkedIn Activity Tracker'

function iconUrl(): string | undefined {
  try {
    return chrome.runtime.getURL('icons/icon32.png')
  } catch {
    return undefined
  }
}

export function showToast(message: string, durationMs = 4000): void {
  try {
    document.getElementById(TOAST_ID)?.remove()
    const el = document.createElement('div')
    el.id = TOAST_ID
    el.setAttribute('role', 'status')
    el.setAttribute('aria-label', `${BRAND}: ${message}`)

    const icon = document.createElement('span')
    icon.setAttribute('aria-hidden', 'true')
    const src = iconUrl()
    if (src) {
      const img = document.createElement('img')
      img.src = src
      img.alt = ''
      Object.assign(img.style, {
        display: 'block',
        width: '18px',
        height: '18px',
      } satisfies Partial<CSSStyleDeclaration>)
      icon.appendChild(img)
    } else {
      icon.textContent = 'LAT'
    }
    Object.assign(icon.style, {
      display: 'grid',
      flex: '0 0 auto',
      placeItems: 'center',
      width: '24px',
      height: '24px',
      borderRadius: '6px',
      background: '#0a8f88',
      color: '#ffffff',
      font: '700 8px/1 -apple-system, system-ui, sans-serif',
      letterSpacing: '0',
    } satisfies Partial<CSSStyleDeclaration>)

    const body = document.createElement('span')
    body.textContent = message
    Object.assign(body.style, {
      minWidth: '0',
    } satisfies Partial<CSSStyleDeclaration>)

    el.append(icon, body)
    Object.assign(el.style, {
      position: 'fixed',
      right: '24px',
      top: '72px', // below LinkedIn's sticky top bar

      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: '2147483647',
      maxWidth: '340px',
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'rgba(29, 34, 38, 0.95)',
      color: '#ffffff',
      font: '13px/1.4 -apple-system, system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'none',
      opacity: '0',
      transform: 'translateY(-6px)',
      transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
    } satisfies Partial<CSSStyleDeclaration>)
    document.documentElement.appendChild(el)
    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
    setTimeout(() => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(-6px)'
      setTimeout(() => el.remove(), FADE_MS + 50)
    }, durationMs)
  } catch {
    // Feedback only — never let the toast break detection or the page.
  }
}
