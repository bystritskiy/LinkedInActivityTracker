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

function compactClassList(el: Element): string[] {
  const className = typeof el.className === 'string' ? el.className : ''
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => c.length <= 80)
    .slice(0, 8)
}

function dataAttributeNames(el: Element): string[] {
  return Array.from(el.attributes)
    .map((a) => a.name)
    .filter((name) => name.startsWith('data-'))
    .sort()
    .slice(0, 12)
}

/**
 * Privacy-safe structural snapshot for debugging selectors on the user's real
 * LinkedIn DOM. Deliberately excludes textContent, href, names, and attribute
 * values that may contain profile or post data.
 */
export function describeAncestryForDiagnostics(el: Element, maxDepth = 8): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && parts.length < maxDepth) {
    const attrs: string[] = []
    const role = current.getAttribute('role')
    const ariaPressed = current.getAttribute('aria-pressed')
    const ariaExpanded = current.getAttribute('aria-expanded')
    const ariaHasPopup = current.getAttribute('aria-haspopup')
    if (role) attrs.push(`role=${role}`)
    if (ariaPressed) attrs.push(`pressed=${ariaPressed}`)
    if (ariaExpanded) attrs.push(`expanded=${ariaExpanded}`)
    if (ariaHasPopup) attrs.push(`haspopup=${ariaHasPopup}`)
    const dataNames = dataAttributeNames(current)
    if (dataNames.length > 0) attrs.push(`data=${dataNames.join('|')}`)
    const classes = compactClassList(current)
    if (classes.length > 0) attrs.push(`class=${classes.join('|')}`)
    parts.push(`${current.tagName.toLowerCase()}[${attrs.join(';')}]`)
    current = current.parentElement
  }
  return parts.join(' <= ').slice(0, 1800)
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
export function elementStableId(el: Element): string {
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

const URN_CARRIER_SELECTOR = '[data-urn], [data-id], [data-activity-urn]'

function urnOf(el: Element | null): string | null {
  if (!el) return null
  return (
    el.getAttribute('data-urn') ??
    el.getAttribute('data-id') ??
    el.getAttribute('data-activity-urn')
  )
}

/** Post id from within a container that carries no urn attributes itself
 *  (2026 hashed-class feed markup): a descendant urn carrier or a permalink. */
function descendantPostId(container: Element): string | null {
  const carried = urnOf(container.querySelector(URN_CARRIER_SELECTOR))
  if (carried) return carried
  const link = container.querySelector<HTMLAnchorElement>(
    'a[href*="/feed/update/"], a[href*="urn%3Ali%3Aactivity"], a[href*="urn:li:activity"]',
  )
  const match = link?.href.match(/urn(?::|%3A)li(?::|%3A)activity(?::|%3A)(\d+)/i)
  return match ? `urn:li:activity:${match[1]}` : componentKeyPostId(container)
}

// 2026 feed rewrite, second layer: some items expose no urn attributes and no
// permalink at all, but a child component's React `componentkey` still leaks a
// stable post id, e.g.
//   componentkey="translatable-commentary-FeTranslationUrn(...
//     contentUrnShareUrn=ContentUrnShareUrn(..., shareUrn=ShareUrn(shareId=7478023198605893633)) ...)"
// Member/profile urns (follow buttons etc.) are deliberately not matched.
function componentKeyPostId(container: Element): string | null {
  for (const el of container.querySelectorAll('[componentkey]')) {
    const key = el.getAttribute('componentkey') ?? ''
    const urn = key.match(/urn(?::|%3A)li(?::|%3A)(activity|share|ugcPost|groupPost)(?::|%3A)(\d+)/i)
    if (urn) return `urn:li:${urn[1]}:${urn[2]}`
    const id = key.match(/\b(share|ugcPost|groupPost|activity)Id=(\d+)/)
    if (id) return `urn:li:${id[1]}:${id[2]}`
  }
  return null
}

const RICH_CONTAINER_SELECTOR = [
  '[data-urn]',
  '[data-id]',
  '[data-activity-urn]',
  '[data-view-name*="feed"]',
  '[data-view-name*="post"]',
  '[data-finite-scroll-hotkey-item]',
  'article',
  '.feed-shared-update-v2',
  '.occludable-update',
  '[class*="feed-shared-update"]',
  '[class*="update-components"]',
].join(', ')

// 2026 feed rewrite: hashed class names, no data-urn on the item — the feed
// entry is a bare listitem. Checked as a separate second pass (not appended to
// the list above) because `closest()` has no per-selector priority: a nearer
// listitem would otherwise shadow a richer urn-carrying ancestor.
const LISTITEM_CONTAINER_SELECTOR = 'div[role="listitem"], li[role="listitem"]'

/** Find the post/comment container around an element and derive a stable id. */
export function closestPostContainer(el: Element): PostContainer | null {
  const container = el.closest(RICH_CONTAINER_SELECTOR) ?? el.closest(LISTITEM_CONTAINER_SELECTOR)
  if (!container) return null
  const urn = urnOf(container) ?? descendantPostId(container)
  const isComment = !!el.closest('[class*="comments-comment"], [class*="comment-item"]')
  return { el: container, id: urn ?? elementStableId(container), isComment }
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

/** True if the reaction word came from the accessible text (not class names). */
export function matchesReactionWord(text: string): boolean {
  return containsAny(text, REACTION_WORDS)
}

/** True for controls that open a menu/flyout rather than acting directly. */
export function opensMenu(btn: HTMLElement): boolean {
  return btn.hasAttribute('aria-haspopup') || btn.hasAttribute('aria-expanded')
}

/**
 * The primary reaction toggle inside a post container — the button whose
 * aria-pressed reflects whether the user has reacted. Reading state from this
 * (rather than from a flyout option) is what makes add/remove/change reliable.
 */
export function findReactionTrigger(container: Element): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>('button, [role="button"]')
  // 2026 markup carries no aria-pressed anywhere; the primary toggle is instead
  // the button whose accessible name spells out the state ("Reaction button
  // state: no reaction" / "Unreact Like"). Social-proof counters ("411
  // reactions") and the flyout opener ("Open reactions menu") also contain
  // reaction words, so plain word-matching alone picks the wrong button.
  let stateBearing: HTMLElement | null = null
  let plain: HTMLElement | null = null
  let any: HTMLElement | null = null
  for (const c of candidates) {
    if (!isReactionTrigger(c)) continue
    if (c.hasAttribute('aria-pressed')) return c
    const text = controlText(c)
    if (!stateBearing && (text.includes('reaction button state') || containsAny(text, REACTION_UNDO_WORDS))) {
      stateBearing = c
    }
    if (!plain && !opensMenu(c) && !/^\d/.test(text.trim())) plain = c
    if (!any) any = c
  }
  return stateBearing ?? plain ?? any
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

// A reacted trigger's accessible name flips to an "undo" phrasing
// ("Unlike", "Unreact", "Remove reaction", «Отменить реакцию», "Cofnij").
const REACTION_UNDO_WORDS = [
  'unlike',
  'unreact',
  'remove',
  'undo',
  // ru
  'отмен',
  'убрать',
  'удалить',
  // pl
  'cofnij',
  'usuń',
] as const

/** Whether a reaction trigger is currently in the "reacted" (pressed) state. */
export function isReactionActive(btn: HTMLElement): boolean {
  const pressed = btn.getAttribute('aria-pressed') ?? btn.getAttribute('aria-checked')
  if (pressed === 'true') return true
  if (pressed === 'false') return false
  // 2026 markup: the button itself has no aria-pressed; sometimes an inner
  // element carries it instead.
  const inner = btn.querySelector('[aria-pressed], [aria-checked]')
  if (inner) {
    return (
      inner.getAttribute('aria-pressed') === 'true' || inner.getAttribute('aria-checked') === 'true'
    )
  }
  const text = controlText(btn)
  // 2026 markup: the toggle's accessible name spells out the state —
  // "Reaction button state: no reaction" (idle) vs "Unreact Like" (reacted).
  if (text.includes('reaction button state')) return !text.includes('no reaction')
  if (containsAny(text, REACTION_UNDO_WORDS)) return true
  const cls = norm(btn.className)
  return cls.includes('active') || cls.includes('reacted') || cls.includes('selected')
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
  const form = btn.closest(
    'form, [class*="comments-comment-box"], [class*="comment-box"], [class*="comments-comment-texteditor"], [data-test-id*="comment"]',
  )
  if (form) return containsAny(controlText(btn), COMMENT_SUBMIT_WORDS)
  // 2026 markup: the comment box is bare divs — no <form>, no stable classes.
  // The submit button only exists while the editor holds text, so: a
  // submit-worded button sharing a small ancestor scope with a non-empty
  // editor. Repost is excluded ("Repost" matches the 'post' submit word but
  // sits in the same post scope as an open editor). Misfires are further
  // gated by the detector's DOM confirmation (comment count must grow).
  const text = controlText(btn)
  if (!containsAny(text, COMMENT_SUBMIT_WORDS) || containsAny(text, REPOST_WORDS)) return false
  const scope = nearestEditorScope(btn)
  return !!scope && editorTextLength(scope) > 0
}

/**
 * Nearest ancestor of `el` that contains a comment/message editor. The scope
 * is kept shallow so an editor elsewhere in the same post (e.g. the main
 * comment box while clicking inside an existing comment) is not picked up.
 */
export function nearestEditorScope(el: Element, maxDepth = 8): Element | null {
  let scope: Element | null = el.parentElement
  for (let depth = 0; scope && depth < maxDepth; depth++) {
    if (scope.querySelector('[contenteditable="true"], textarea')) return scope
    scope = scope.parentElement
  }
  return null
}

export function isLikelyCommentInteraction(btn: HTMLElement): boolean {
  const text = controlText(btn)
  const control = norm(btn.getAttribute('data-control-name'))
  if (containsAny(text, COMMENT_SUBMIT_WORDS)) return true
  if (control.includes('comment') || control.includes('reply')) return true
  return !!btn.closest(
    'form, [class*="comments-comment-box"], [class*="comment-box"], [class*="comments-comment-texteditor"], [contenteditable="true"]',
  )
}

/** Is the comment box a reply (nested under an existing comment)? */
export function isReplyContext(btn: HTMLElement): boolean {
  if (btn.closest('[class*="comments-comment-item"] [class*="comment-box"], [class*="reply"]')) return true
  // 2026 markup: a reply editor lives inside an existing comment node.
  return !!btn.closest('[componentkey^="replaceableComment"]')
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

// 2026 markup: rendered comments carry
// componentkey="replaceableComment_urn:li:comment:(urn:li:activity:…,…)".
export const COMMENT_ITEM_SELECTOR =
  '[class*="comments-comment-item"], article[class*="comment"], [componentkey^="replaceableComment"]'
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
