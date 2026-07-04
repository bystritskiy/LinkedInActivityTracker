// Minimal self-removing status toast shown by the content script.
//
// This is the extension's own feedback UI layered over the page — it must
// never affect LinkedIn: pointer-events is disabled so it can't swallow
// clicks, it triggers no page logic, and it removes itself.

const TOAST_ID = 'lat-toast'
const FADE_MS = 250

export function showToast(message: string, durationMs = 4000): void {
  try {
    document.getElementById(TOAST_ID)?.remove()
    const el = document.createElement('div')
    el.id = TOAST_ID
    el.setAttribute('role', 'status')
    el.textContent = message
    Object.assign(el.style, {
      position: 'fixed',
      right: '24px',
      top: '72px', // below LinkedIn's sticky top bar

      zIndex: '2147483647',
      maxWidth: '340px',
      padding: '10px 14px',
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
