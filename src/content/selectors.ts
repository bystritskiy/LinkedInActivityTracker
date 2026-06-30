// =============================================================================
// LinkedIn DOM heuristics — the ONLY place that knows about LinkedIn's markup.
//
// Design rules (spec §9.1, §27.4):
//  - Never rely on a single CSS class — LinkedIn churns them constantly.
//  - Prefer semantic + language-agnostic signals: aria-label, role, button
//    text, data-* attributes, dialog context, and DOM state before/after.
//  - Match localized text via small multilingual word lists (en / ru / pl).
//
// This is the maintenance surface. When LinkedIn changes its UI, update the
// word lists and predicates here; the detectors and business logic stay put.
// =============================================================================

export function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

export function containsAny(haystack: string, words: readonly string[]): boolean {
  return words.some((w) => haystack.includes(w))
}

/** Accessible-ish text for a control: aria-label, then title, then short text. */
export function controlText(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return norm(aria)
  const title = el.getAttribute('title')
  if (title) return norm(title)
  return norm(el.textContent).trim().slice(0, 120)
}

/** Nearest clickable ancestor (or self). */
export function closestButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest<HTMLElement>('button, [role="button"], a[href]')
}

/** True if the element is inside an open dialog/modal. */
export function withinDialog(el: Element): boolean {
  return !!el.closest('[role="dialog"], [aria-modal="true"]')
}

// Stable per-element id for elements without a LinkedIn URN (used only for
// short-lived dedup within a session).
const elementIds = new WeakMap<Element, string>()
function fallbackElementId(el: Element): string {
  let id = elementIds.get(el)
  if (!id) {
    id = `el-${crypto.randomUUID()}`
    elementIds.set(el, id)
  }
  return id
}

export interface PostContainer {
  el: Element
  id: string
  isComment: boolean
}

/** Find the post/comment container around an element and derive a stable id. */
export function closestPostContainer(el: Element): PostContainer | null {
  const container = el.closest(
    '[data-urn], [data-id], article, .feed-shared-update-v2, .occludable-update',
  )
  if (!container) return null
  const urn = container.getAttribute('data-urn') ?? container.getAttribute('data-id')
  const isComment = !!el.closest('[class*="comments-comment"], [class*="comment-item"]')
  return { el: container, id: urn ?? fallbackElementId(container), isComment }
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

const REACTION_WORDS = [
  'react',
  'like',
  'celebrate',
  'support',
  'love',
  'insightful',
  'funny',
  'recommend',
  // ru
  'нрав',
  'реаг',
  'поздрав',
  'поддерж',
  'любл',
  'интерес',
  'смешн',
  // pl
  'lubię',
  'reaguj',
  'gratuluj',
  'wspieram',
  'ciekawe',
  'zabawne',
] as const

const REACTION_TYPE_WORDS: Record<string, readonly string[]> = {
  like: ['like', 'нрав', 'lubię'],
  celebrate: ['celebrate', 'поздрав', 'gratuluj'],
  support: ['support', 'поддерж', 'wspieram'],
  love: ['love', 'любл'],
  insightful: ['insight', 'интерес', 'ciekawe'],
  funny: ['funny', 'смешн', 'zabawne'],
}

export function isReactionTrigger(btn: HTMLElement): boolean {
  const text = controlText(btn)
  if (containsAny(text, REACTION_WORDS)) return true
  const cls = norm(btn.className)
  const control = norm(btn.getAttribute('data-control-name'))
  return cls.includes('react') || control.includes('react') || control.includes('like')
}

/**
 * The primary reaction toggle inside a post container — the button whose
 * aria-pressed reflects whether the user has reacted. Reading state from this
 * (rather than from a flyout option) is what makes add/remove/change reliable.
 */
export function findReactionTrigger(container: Element): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>('button, [role="button"]')
  let fallback: HTMLElement | null = null
  for (const c of candidates) {
    if (!isReactionTrigger(c)) continue
    if (c.hasAttribute('aria-pressed')) return c
    if (!fallback) fallback = c
  }
  return fallback
}

export function classifyReaction(
  text: string,
): 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny' | 'unknown' {
  for (const [type, words] of Object.entries(REACTION_TYPE_WORDS)) {
    if (containsAny(text, words)) {
      return type as 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny'
    }
  }
  return 'unknown'
}

/** Whether a reaction trigger is currently in the "reacted" (pressed) state. */
export function isReactionActive(btn: HTMLElement): boolean {
  const pressed = btn.getAttribute('aria-pressed')
  if (pressed === 'true') return true
  if (pressed === 'false') return false
  return norm(btn.className).includes('active')
}

// ---------------------------------------------------------------------------
// Connection requests
// ---------------------------------------------------------------------------

const SEND_WORDS = ['send', 'отправ', 'wyślij'] as const
const INVITE_CONTEXT_WORDS = [
  'invit',
  'connect',
  'пригла',
  'связ',
  'zapro',
  'nawiąż',
] as const

/** The final "Send" button inside an invitation dialog. */
export function isSendInvitationButton(btn: HTMLElement): boolean {
  const text = controlText(btn)
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('invite') && containsAny(control, ['send'])) return true
  if (!containsAny(text, SEND_WORDS)) return false
  // Confirm it is an invitation flow: either the button itself references the
  // invite, or it lives inside the invitation dialog.
  return containsAny(text, INVITE_CONTEXT_WORDS) || withinDialog(btn)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

const COMMENT_SUBMIT_WORDS = [
  'comment',
  'post',
  'reply',
  'коммент',
  'ответ',
  'отправ',
  'opublikuj',
  'skomentuj',
  'odpowiedz',
] as const

export function isCommentSubmitButton(btn: HTMLElement): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('comment') && containsAny(control, ['post', 'submit', 'reply'])) return true
  const form = btn.closest('form, [class*="comments-comment-box"], [class*="comment-box"]')
  if (!form) return false
  return containsAny(controlText(btn), COMMENT_SUBMIT_WORDS)
}

/** Is the comment box a reply (nested under an existing comment)? */
export function isReplyContext(btn: HTMLElement): boolean {
  return !!btn.closest('[class*="comments-comment-item"] [class*="comment-box"], [class*="reply"]')
}

// ---------------------------------------------------------------------------
// Reposts
// ---------------------------------------------------------------------------

const REPOST_WORDS = ['repost', 'reshare', 'репост', 'udostępnij', 'podaj dalej'] as const
const WITH_THOUGHTS_WORDS = ['thought', 'мысл', 'komentarz', 'with'] as const

export function isRepostControl(btn: HTMLElement): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('repost') || control.includes('reshare')) return true
  return containsAny(controlText(btn), REPOST_WORDS)
}

export function classifyRepost(text: string): 'instant' | 'with_thoughts' {
  return containsAny(text, WITH_THOUGHTS_WORDS) ? 'with_thoughts' : 'instant'
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function isMessageSendButton(btn: HTMLElement): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('send') && control.includes('message')) return true
  const inThread = btn.closest('[class*="msg-form"], [class*="messaging"]')
  if (!inThread) return false
  return containsAny(controlText(btn), SEND_WORDS)
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const POST_WORDS = ['post', 'опубликовать', 'опубл', 'publikuj', 'udostępnij'] as const

export function isPostShareButton(btn: HTMLElement): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('share') && containsAny(control, ['actor', 'post'])) return true
  const inComposer = btn.closest('[class*="share-box"], [class*="share-creation"], [role="dialog"]')
  if (!inComposer) return false
  return containsAny(controlText(btn), POST_WORDS)
}

// ---------------------------------------------------------------------------
// Confirmation helpers (DOM state before/after a user action)
// ---------------------------------------------------------------------------

export const COMMENT_ITEM_SELECTOR =
  '[class*="comments-comment-item"], article[class*="comment"]'
export const MESSAGE_ITEM_SELECTOR =
  '[class*="msg-s-event-listitem"], [class*="message-list-item"]'

export function countMatching(root: ParentNode, selector: string): number {
  return root.querySelectorAll(selector).length
}

/** Trimmed length of the editable field within a scope (no text is stored). */
export function editorTextLength(scope: Element): number {
  const ed = scope.querySelector<HTMLElement>('[contenteditable="true"], textarea, input[type="text"]')
  if (!ed) return 0
  const text = ed instanceof HTMLTextAreaElement || ed instanceof HTMLInputElement ? ed.value : ed.textContent ?? ''
  return text.trim().length
}

/** True if a menu item (not the trigger that opens a menu) was clicked. */
export function isMenuItemClick(btn: HTMLElement): boolean {
  const isTrigger = btn.hasAttribute('aria-haspopup') || btn.hasAttribute('aria-expanded')
  if (isTrigger) return false
  return btn.getAttribute('role') === 'menuitem' || !!btn.closest('[role="menu"]')
}
