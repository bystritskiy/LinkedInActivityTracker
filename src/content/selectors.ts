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
  return target.closest<HTMLElement>('button, [role="button"], [role="menuitem"], a[href]')
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
// "Send without a note" / «Отправить без заметки» / "Wyślij bez notatki" —
// the 2026 invite dialog's send button references the note, not the invite.
const INVITE_NOTE_WORDS = ['note', 'заметк', 'notatk'] as const

/** The final "Send" button inside an invitation dialog. */
export function isSendInvitationButton(btn: HTMLElement): boolean {
  const text = controlText(btn)
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('invite') && containsAny(control, ['send'])) return true
  if (!containsAny(text, SEND_WORDS)) return false
  if (containsAny(text, INVITE_NOTE_WORDS)) return true
  // Confirm it is an invitation flow: either the button itself references the
  // invite, or it lives inside the invitation dialog.
  return containsAny(text, INVITE_CONTEXT_WORDS) || withinDialog(btn)
}

// The primary "Connect" control. 2026 markup sends the invite immediately on
// this click on most surfaces (My Network cards, search results) — no dialog.
const CONNECT_EXACT_TEXTS = ['connect', 'установить контакт', 'nawiąż kontakt'] as const
// aria-label form: "Invite {Name} to connect" / «Пригласить {имя} установить
// контакт» / "Zaproś {imię}, aby nawiązać kontakt".
const CONNECT_PHRASES = ['to connect', 'установить контакт'] as const
// Post-send state: "Pending" / "Withdraw invitation" / «Отправлено» / «Отозвать».
const CONNECT_PENDING_WORDS = [
  'pending',
  'withdraw',
  'invitation sent',
  'отозв',
  'ожидан',
  'отправлено',
  'oczekuj',
  'wycofaj',
  'wysłano',
] as const

export function isConnectButton(btn: HTMLElement): boolean {
  const text = controlText(btn).replace(/\s+/g, ' ').trim()
  if (!text || containsAny(text, CONNECT_PENDING_WORDS)) return false
  if ((CONNECT_EXACT_TEXTS as readonly string[]).includes(text)) return true
  if (containsAny(text, CONNECT_PHRASES)) return true
  // pl aria: invite word + kontakt, e.g. "Zaproś X do nawiązania kontaktu"
  return containsAny(text, ['zapro', 'nawiąz']) && text.includes('kontakt')
}

/** Card / result-row scope around a Connect button, for post-click state checks. */
export function connectCardScope(btn: HTMLElement): Element | null {
  const card = btn.closest('[role="listitem"], li, [data-view-name]')
  if (card) return card
  // Fallback: a few ancestor levels, enough to catch an in-place button swap.
  let scope: Element | null = btn.parentElement
  for (let depth = 0; scope?.parentElement && depth < 3; depth++) scope = scope.parentElement
  return scope
}

/** Did the Connect control (or its card) switch to a pending/sent state? */
export function connectBecamePending(btn: HTMLElement, scope: Element | null): boolean {
  if (document.contains(btn)) {
    if (containsAny(controlText(btn), CONNECT_PENDING_WORDS)) return true
    if (containsAny(norm(btn.textContent), CONNECT_PENDING_WORDS)) return true
  }
  if (!scope || !document.contains(scope)) return false
  const controls = scope.querySelectorAll<HTMLElement>('button, [role="button"], span')
  for (const el of controls) {
    if (containsAny(controlText(el), CONNECT_PENDING_WORDS)) return true
  }
  return false
}

/**
 * Is an invitation dialog (or at least its send button) currently on screen?
 * Checked after a Connect click: if the click opened the add-a-note dialog,
 * the direct-connect flow must stand down and let the dialog flow count.
 * The send-button scan covers 2026 dialogs that may lack role="dialog".
 */
export function invitationUiOpen(): boolean {
  const dialogs = document.querySelectorAll('[role="dialog"], [aria-modal="true"]')
  for (const d of dialogs) {
    if (containsAny(norm(d.textContent), INVITE_CONTEXT_WORDS)) return true
  }
  const buttons = document.querySelectorAll<HTMLElement>('button, [role="button"]')
  for (const b of buttons) {
    if (isSendInvitationButton(b)) return true
  }
  return false
}

/** "Invitation sent" toast/alert, a secondary confirmation for direct sends. */
export function invitationSentToastVisible(): boolean {
  const nodes = document.querySelectorAll(
    '[role="alert"], [role="status"], [class*="toast"], [data-test-artdeco-toast]',
  )
  for (const n of nodes) {
    const t = norm(n.textContent)
    if (
      containsAny(t, ['invit', 'приглашен', 'zaprosz']) &&
      containsAny(t, ['sent', 'отправлен', 'wysłan'])
    ) {
      return true
    }
  }
  return false
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
    if (scope.querySelector(EDITABLE_SELECTOR)) return scope
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

/**
 * Classify a click on an OPTION of an already-open repost menu. In the 2026
 * dropdown markup options are bare `<a>` elements — no href, no role, no menu
 * ancestor — so neither closestButton nor isMenuItemClick can see them. Walks
 * up from the click target looking for a small repost-worded element that is
 * not the menu trigger. The word match alone is not specific enough for an
 * always-on listener: the caller must gate this on the repost menu having
 * just been opened.
 */
export function repostMenuSelection(
  target: EventTarget | null,
  maxDepth = 6,
): 'instant' | 'with_thoughts' | null {
  let el = target instanceof Element ? target : null
  for (let depth = 0; el && depth < maxDepth; depth++, el = el.parentElement) {
    // Reached the trigger itself (or another menu opener) — not a selection.
    if (el instanceof HTMLElement && opensMenu(el)) return null
    const text = norm(el.textContent).trim()
    // Menu options are short ("Repost" + one-line description). A long text
    // means we walked out into the menu container or the post body, where
    // classification would mix both options' wording. A leading digit means
    // a social-proof counter ("2 reposts"), never a menu option.
    if (text.length === 0 || text.length > 200 || /^\d/.test(text)) continue
    const accessible = el.getAttribute('aria-label') ? controlText(el) : text
    // A single option mentions "repost" once; the container listing both
    // options mentions it per option — skip those, keep walking.
    let hits = 0
    for (const w of REPOST_WORDS) {
      for (let i = accessible.indexOf(w); i !== -1; i = accessible.indexOf(w, i + w.length)) hits++
    }
    if (hits === 0) continue
    if (hits > 1) continue
    return classifyRepost(accessible)
  }
  return null
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_WORDS = ['message', 'сообщени', 'wiadomo'] as const

// 2026 React editors sometimes use contenteditable="plaintext-only".
export const EDITABLE_SELECTOR =
  '[contenteditable="true"], [contenteditable="plaintext-only"], textarea'

/** aria-label / placeholder text that identifies what an editor is for. */
function editorSignalText(el: Element): string {
  return norm(
    [
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('aria-placeholder'),
      el.getAttribute('data-placeholder'),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

/**
 * The message-compose field for an event target (or null). 2026 markup has no
 * stable classes; the editor is recognised by its own accessible text, e.g.
 * "Write a message…" / «Напишите сообщение…» / "Napisz wiadomość…".
 * On the dedicated /messaging/ page (`onMessagingPage`) every editor is a
 * message composer — the 2026 compose field may carry no signal text at all.
 */
export function messageEditorFrom(
  target: EventTarget | null,
  onMessagingPage = false,
): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const ed = target.closest<HTMLElement>(EDITABLE_SELECTOR)
  if (!ed) return null
  if (onMessagingPage) return ed
  if (containsAny(editorSignalText(ed), MESSAGE_WORDS)) return ed
  // Legacy containers still gate positively when present.
  if (ed.closest('[class*="msg-form"], [class*="messaging"]')) return ed
  return null
}

/** A message-compose editor inside `scope`, identified by its own signal text. */
export function findMessageEditor(scope: Element, onMessagingPage = false): HTMLElement | null {
  for (const ed of scope.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
    if (onMessagingPage || containsAny(editorSignalText(ed), MESSAGE_WORDS)) return ed
  }
  return null
}

export function isMessageSendButton(btn: HTMLElement, onMessagingPage = false): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('send') && control.includes('message')) return true
  const text = controlText(btn)
  // aria "Send message" / «Отправить сообщение» — self-sufficient.
  if (containsAny(text, SEND_WORDS) && containsAny(text, MESSAGE_WORDS)) return true
  if (!containsAny(text, SEND_WORDS)) return false
  // Legacy markup: any send-worded button inside the messaging form.
  if (btn.closest('[class*="msg-form"], [class*="messaging"]')) return true
  // 2026 markup: a send-worded button sharing a small scope with a
  // message-compose editor (bare divs, no form, no stable classes).
  const scope = nearestEditorScope(btn)
  return !!scope && !!findMessageEditor(scope, onMessagingPage)
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

const POST_WORDS = ['post', 'опубликовать', 'опубл', 'publikuj', 'udostępnij'] as const
const SHARE_COMPOSER_SELECTOR = [
  '[class*="share-box"]',
  '[class*="share-creation"]',
  '[class*="share-creator"]',
  '[class*="share-dialog"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-test-modal]',
  '[class*="artdeco-modal"]',
].join(', ')

export function isPostPublishControl(btn: HTMLElement): boolean {
  const control = norm(btn.getAttribute('data-control-name'))
  if (control.includes('share') && containsAny(control, ['actor', 'post'])) return true
  return containsAny(controlText(btn), POST_WORDS)
}

export function closestShareComposer(el: Element): Element | null {
  return el.closest(SHARE_COMPOSER_SELECTOR)
}

export function isPostShareButton(btn: HTMLElement): boolean {
  if (!isPostPublishControl(btn)) return false
  const inComposer = closestShareComposer(btn)
  if (!inComposer) return false
  return true
}

// ---------------------------------------------------------------------------
// SSI (Social Selling Index) page — /sales/ssi
// ---------------------------------------------------------------------------

/** Scores read off the SSI page. Mirrors SSIEntry minus the timestamp. */
export interface SSIScores {
  total: number
  professionalBrand?: number
  findRightPeople?: number
  engageWithInsights?: number
  buildRelationships?: number
}

type SSIComponentKey = Exclude<keyof SSIScores, 'total'>

// Component rows render as "12.05 | Establish your professional brand".
// Stems must stay specific: "People in your network have an average SSI of N"
// appears elsewhere on the page, so plain "people" would misfire.
const SSI_COMPONENT_WORDS: Record<SSIComponentKey, readonly string[]> = {
  professionalBrand: ['brand', 'бренд', 'mark'],
  findRightPeople: ['right people', 'нужн', 'właściw', 'odpowiedni'],
  engageWithInsights: ['insight', 'информаци', 'взаимодейств', 'контент', 'spostrzeż', 'treści'],
  buildRelationships: ['relationship', 'отношен', 'relacj'],
}

const SSI_COMPONENT_KEYS = Object.keys(SSI_COMPONENT_WORDS) as SSIComponentKey[]

// "33 out of 100" / «33 из 100» / "33 na 100". The spans may abut without
// whitespace in textContent, hence \s* between the number and the words.
const SSI_TOTAL_RE = /(?:^|\s)(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:out of|из|na)\s*100(?:\s|$)/
const SSI_COMPONENT_ROW_RE = /^(\d{1,3}(?:[.,]\d{1,2})?)\s*\|\s*(.+)$/

function compactText(el: Element): string {
  return norm(el.textContent).replace(/\s+/g, ' ').trim()
}

function parseScore(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

type SSIComponentGroup = Partial<Record<SSIComponentKey, number>>

function classifySSILabel(label: string): SSIComponentKey | null {
  for (const key of SSI_COMPONENT_KEYS) {
    if (containsAny(label, SSI_COMPONENT_WORDS[key])) return key
  }
  return null
}

// Captured live 2026-07-03: each score donut is backed by a hidden a11y table —
//   <tr><th>Establish your professional brand</th><td>12.05</td></tr> …
//   <tr><th>Remaining points</th><td>67</td></tr>
// The page holds three such tables (current SSI, industry average, network
// average), so rows must be grouped per table and the right table picked by
// cross-checking against the current total.
function ssiGroupFromTable(table: Element): SSIComponentGroup {
  const group: SSIComponentGroup = {}
  for (const tr of table.querySelectorAll('tr')) {
    const key = classifySSILabel(norm(tr.querySelector('th')?.textContent))
    const valueText = compactText(tr.querySelector('td') ?? tr)
    if (!key || !valueText) continue
    const value = parseScore(valueText)
    if (value >= 0 && value <= 25) group[key] = value
  }
  return group
}

// Fallback for a table-less rendering: single elements reading
// "12.05 | Establish your professional brand".
function ssiGroupFromPipeRows(root: ParentNode): SSIComponentGroup {
  const group: SSIComponentGroup = {}
  for (const el of root.querySelectorAll('*')) {
    const t = compactText(el)
    if (!t || t.length > 90) continue
    const row = t.match(SSI_COMPONENT_ROW_RE)
    if (!row) continue
    const value = parseScore(row[1])
    const key = classifySSILabel(row[2])
    if (key && value >= 0 && value <= 25) group[key] = value
  }
  return group
}

function ssiGroupSum(group: SSIComponentGroup): number {
  return SSI_COMPONENT_KEYS.reduce((acc, k) => acc + (group[k] ?? 0), 0)
}

/**
 * Read the current SSI scores from the /sales/ssi page. Purely observational.
 * The total comes from the donut caption ("N out of 100" — the current-SSI
 * donut renders before the industry/network average ones); the components come
 * from the donut's backing table, matched to that total via the sum invariant
 * (each component is 0–25 and the four add up to the total).
 */
export function extractSSI(root: ParentNode = document): SSIScores | null {
  const totals: number[] = []
  for (const el of root.querySelectorAll('*')) {
    const t = compactText(el)
    if (!t || t.length > 40) continue
    const m = t.match(SSI_TOTAL_RE)
    if (!m) continue
    const v = parseScore(m[1])
    if (v >= 0 && v <= 100 && !totals.includes(v)) totals.push(v)
  }
  const groups = [...root.querySelectorAll('table')].map(ssiGroupFromTable)
  groups.push(ssiGroupFromPipeRows(root))
  const complete = groups.filter((g) => SSI_COMPONENT_KEYS.every((k) => g[k] !== undefined))
  const current = totals[0]
  // Prefer the component group whose sum agrees with the current total; the
  // average donuts have identically-shaped tables with different numbers.
  const components =
    (current !== undefined
      ? complete.find((g) => Math.abs(ssiGroupSum(g) - current) <= 2)
      : undefined) ?? complete[0]
  if (components) return { total: current ?? Math.round(ssiGroupSum(components)), ...components }
  return current !== undefined ? { total: current } : null
}

// ---------------------------------------------------------------------------
// Profile-views analytics page — /analytics/profile-views/
// ---------------------------------------------------------------------------

/** Reading off the analytics page. Mirrors ProfileViewsEntry minus the timestamp. */
export interface ProfileViewsSnapshot {
  viewers: number
  rangeDays?: number
}

// Captured live 2026-07-04: the count and its caption are bare sibling <p>s in
// a hashed-class div —
//   <div><p>54</p><p>Profile viewers in the past 90 days</p></div>
// so the match runs on the parent's combined text, where the number abuts the
// caption with no whitespace ("54profile viewers in the past 90 days"). The
// ancestor above that also prepends the range dropdown ("past 90 days54…"),
// which the leading-digit requirement rejects; the Premium upsell ("Unlock
// your profile views…") and the viewer breakdown rows ("6 recruiters") fail
// the word tests.
const PROFILE_VIEWERS_STEMS = ['viewer', 'просмотр', 'посетител', 'wyświetl'] as const
const PROFILE_STEMS = ['profile', 'профил', 'profil'] as const
const PROFILE_VIEWS_COUNT_RE = /^(\d{1,3}(?:[\s ,.]\d{3})*|\d+)/
const PROFILE_VIEWS_RANGE_RE = /(\d{1,3})\s*(?:day|дн|dni)/

/**
 * Read the current "Who's viewed your profile" count from the analytics page.
 * Purely observational. Prefers the shortest matching text, i.e. the tightest
 * element wrapping the count and its caption.
 */
export function extractProfileViews(root: ParentNode = document): ProfileViewsSnapshot | null {
  let best: { snapshot: ProfileViewsSnapshot; length: number } | null = null
  for (const el of root.querySelectorAll('*')) {
    const t = compactText(el)
    if (!t || t.length > 140) continue
    if (!containsAny(t, PROFILE_VIEWERS_STEMS) || !containsAny(t, PROFILE_STEMS)) continue
    const count = t.match(PROFILE_VIEWS_COUNT_RE)
    if (!count) continue
    const viewers = Number.parseInt(count[1].replace(/\D/g, ''), 10)
    if (!Number.isFinite(viewers)) continue
    if (best && t.length >= best.length) continue
    const range = t.match(PROFILE_VIEWS_RANGE_RE)
    best = {
      snapshot: { viewers, rangeDays: range ? Number(range[1]) : undefined },
      length: t.length,
    }
  }
  return best?.snapshot ?? null
}

// ---------------------------------------------------------------------------
// LinkedIn creator dashboard — /dashboard/
// ---------------------------------------------------------------------------

export interface LinkedInDashboardSnapshot {
  postImpressions?: number
  postImpressionsRangeDays?: number
  followers?: number
  followersChangePercent?: number
  profileViewers?: number
  profileViewersRangeDays?: number
  searchAppearances?: number
  searchAppearancesPeriod?: string
  searchAppearancesChangePercent?: number
  weeklyPosts?: number
  weeklyComments?: number
  weeklyPeriod?: string
}

type DashboardMetricMatch = { el: Element; text: string; value: number }

const LEADING_INTEGER_RE = /^(\d{1,3}(?:[\s ,.]\d{3})*|\d+)/
const PERCENT_RE = /([+-]?\d{1,3}(?:[.,]\d+)?)\s*%/
const DASHBOARD_RANGE_DAYS_RE = /(?:in|past|последн|ciągu)\s*(?:the\s*)?(?:past\s*)?(\d{1,3})\s*(?:day|дн|dni)/
const WEEKLY_PERIOD_RE =
  /weekly progress\s*([a-zа-я]{3,}\s+\d{1,2}\s*[–-]\s*(?:[a-zа-я]{3,}\s*)?\d{1,2})/

function parseLeadingInteger(raw: string): number | undefined {
  const match = raw.match(LEADING_INTEGER_RE)
  if (!match) return undefined
  const value = Number.parseInt(match[1].replace(/\D/g, ''), 10)
  return Number.isFinite(value) ? value : undefined
}

function parsePercent(raw: string): number | undefined {
  const match = raw.match(PERCENT_RE)
  if (!match) return undefined
  const value = Number.parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

function bestDashboardMetric(
  root: ParentNode,
  predicate: (text: string) => boolean,
): DashboardMetricMatch | null {
  let best: DashboardMetricMatch | null = null
  for (const el of root.querySelectorAll('*')) {
    const text = compactText(el)
    if (!text || text.length > 220 || !predicate(text)) continue
    const value = parseLeadingInteger(text)
    if (value === undefined) continue
    if (!best || text.length < best.text.length) best = { el, text, value }
  }
  return best
}

function compactDescendantTexts(el: Element): string[] {
  const lines: string[] = []
  for (const child of el.querySelectorAll('*')) {
    const text = compactText(child)
    if (!text || text.length > 90 || lines.includes(text)) continue
    lines.push(text)
  }
  return lines
}

function dashboardRangeDays(text: string): number | undefined {
  const match = text.match(DASHBOARD_RANGE_DAYS_RE)
  return match ? Number(match[1]) : undefined
}

function dashboardSearchPeriod(match: DashboardMetricMatch | null): string | undefined {
  if (!match) return undefined
  const line =
    compactDescendantTexts(match.el).find((text) => text.includes('search appearances')) ??
    match.text
  const period = line
    .replace(/^\d[\d\s ,.]*/, '')
    .replace('search appearances', '')
    .replace(PERCENT_RE, '')
    .replace(/\bvs\..*$/, '')
    .trim()
  return period || undefined
}

function dashboardChangePercent(match: DashboardMetricMatch | null): number | undefined {
  if (!match) return undefined
  const line = compactDescendantTexts(match.el).find((text) => text.includes('%'))
  return parsePercent(line ?? match.text)
}

function dashboardWeeklyPeriod(root: ParentNode): string | undefined {
  for (const el of root.querySelectorAll('*')) {
    const text = compactText(el)
    if (!text || text.length > 260 || !text.includes('weekly progress')) continue
    const match = text.match(WEEKLY_PERIOD_RE)
    if (match) return match[1]
  }
  return undefined
}

/**
 * Read aggregate metrics from linkedin.com/dashboard/. Purely observational.
 * Captures the top "Track performance" cards plus the weekly post/comment
 * progress cards when they are present.
 */
export function extractLinkedInDashboard(
  root: ParentNode = document,
): LinkedInDashboardSnapshot | null {
  const postImpressions = bestDashboardMetric(
    root,
    (text) => text.includes('post impression'),
  )
  const followers = bestDashboardMetric(root, (text) => text.includes('total followers'))
  const profileViewers = bestDashboardMetric(
    root,
    (text) => text.includes('profile') && text.includes('viewer'),
  )
  const searchAppearances = bestDashboardMetric(root, (text) =>
    text.includes('search appearances'),
  )
  const weeklyPosts = bestDashboardMetric(root, (text) => text.includes('members who post'))
  const weeklyComments = bestDashboardMetric(root, (text) =>
    text.includes('members who comment'),
  )

  const snapshot: LinkedInDashboardSnapshot = {
    postImpressions: postImpressions?.value,
    postImpressionsRangeDays: postImpressions
      ? dashboardRangeDays(postImpressions.text)
      : undefined,
    followers: followers?.value,
    followersChangePercent: dashboardChangePercent(followers),
    profileViewers: profileViewers?.value,
    profileViewersRangeDays: profileViewers ? dashboardRangeDays(profileViewers.text) : undefined,
    searchAppearances: searchAppearances?.value,
    searchAppearancesPeriod: dashboardSearchPeriod(searchAppearances),
    searchAppearancesChangePercent: dashboardChangePercent(searchAppearances),
    weeklyPosts: weeklyPosts?.value,
    weeklyComments: weeklyComments?.value,
    weeklyPeriod: dashboardWeeklyPeriod(root),
  }
  return Object.values(snapshot).some((v) => v !== undefined) ? snapshot : null
}

// ---------------------------------------------------------------------------
// Confirmation helpers (DOM state before/after a user action)
// ---------------------------------------------------------------------------

// 2026 markup: rendered comments carry
// componentkey="replaceableComment_urn:li:comment:(urn:li:activity:…,…)".
export const COMMENT_ITEM_SELECTOR =
  '[class*="comments-comment-item"], article[class*="comment"], [componentkey^="replaceableComment"]'
// 2026 markup exposes no stable message-item classes; React componentkeys
// containing message urns are the only structural hint.
export const MESSAGE_ITEM_SELECTOR =
  '[class*="msg-s-event-listitem"], [class*="message-list-item"], [componentkey*="essage"]'

export function countMatching(root: ParentNode, selector: string): number {
  return root.querySelectorAll(selector).length
}

/** Trimmed text length of one editable element (no text is stored). */
export function editorValueLength(ed: HTMLElement): number {
  const text =
    ed instanceof HTMLTextAreaElement || ed instanceof HTMLInputElement
      ? ed.value
      : ed.textContent ?? ''
  return text.trim().length
}

/** Trimmed length of the editable field within a scope (no text is stored). */
export function editorTextLength(scope: Element): number {
  const ed = scope.querySelector<HTMLElement>(`${EDITABLE_SELECTOR}, input[type="text"]`)
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
