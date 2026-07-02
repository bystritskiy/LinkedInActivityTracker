import { describe, expect, it } from 'vitest'
import {
  COMMENT_ITEM_SELECTOR,
  classifyReaction,
  closestPostContainer,
  findReactionTrigger,
  isCommentSubmitButton,
  isReactionActive,
  isReplyContext,
  matchesReactionWord,
  opensMenu,
} from '../src/content/selectors'

function build(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

describe('closestPostContainer', () => {
  it('prefers urn-carrying ancestors', () => {
    const host = build(
      `<div data-urn="urn:li:activity:1"><div role="listitem"><button id="b">Like</button></div></div>`,
    )
    const found = closestPostContainer(host.querySelector('#b')!)
    expect(found?.id).toBe('urn:li:activity:1')
  })

  it('falls back to a bare listitem (2026 hashed markup) and mines a descendant permalink', () => {
    const host = build(
      `<div role="listitem" class="_8b966dfb _44ff6cbb">
         <a href="https://www.linkedin.com/feed/update/urn:li:activity:7204837291/">post</a>
         <div class="c58beb5c"><button id="b" aria-label="Like">Like</button></div>
       </div>`,
    )
    const found = closestPostContainer(host.querySelector('#b')!)
    expect(found).not.toBeNull()
    expect(found?.id).toBe('urn:li:activity:7204837291')
    expect(found?.isComment).toBe(false)
  })

  // Structure captured live 2026-07-03: no urn attributes, no permalink links
  // anywhere in the item; a child componentkey leaks the share id.
  it('mines the post id from a FeTranslationUrn componentkey (2026 feed)', () => {
    const host = build(
      `<div role="listitem" class="_8b966dfb _44ff6cbb">
         <button componentkey="FollowButtonurn:li:fsd_followingState:urn:li:member:786143320_follow">Follow</button>
         <div componentkey="translatable-commentary-FeTranslationUrn(contentUrnCommentUrn=null, contentUrnGroupPostUrn=null, contentUrnShareUrn=ContentUrnShareUrn(__typename=proto_com_linkedin_common_ShareUrn, shareUrn=ShareUrn(shareId=7478023198605893633)), contentUrnUgcPostUrn=null, detectedLocale=, targetLocale=en)">text</div>
         <button id="b" aria-label="Reaction button state: no reaction">32</button>
       </div>`,
    )
    const found = closestPostContainer(host.querySelector('#b')!)
    expect(found?.id).toBe('urn:li:share:7478023198605893633')
  })

  it('never mines member/profile urns from componentkeys', () => {
    const host = build(
      `<div role="listitem">
         <button componentkey="FollowButtonurn:li:fsd_followingState:urn:li:member:786143320_follow">Follow</button>
         <button id="b" aria-label="Reaction button state: no reaction">5</button>
       </div>`,
    )
    const found = closestPostContainer(host.querySelector('#b')!)
    expect(found?.id).toMatch(/^el-/)
  })

  it('derives a stable synthetic id when no urn exists anywhere', () => {
    const host = build(
      `<div role="listitem"><button id="b" aria-label="Like">Like</button></div>`,
    )
    const btn = host.querySelector('#b')!
    const first = closestPostContainer(btn)
    const second = closestPostContainer(btn)
    expect(first?.id).toBeTruthy()
    expect(first?.id).toBe(second?.id)
  })
})

describe('isReactionActive', () => {
  function btn(attrs: string, inner = ''): HTMLElement {
    const host = build(`<button ${attrs}>${inner}Like</button>`)
    return host.querySelector('button')!
  }

  it('reads aria-pressed when present', () => {
    expect(isReactionActive(btn('aria-pressed="true"'))).toBe(true)
    expect(isReactionActive(btn('aria-pressed="false" class="artdeco-button--active"'))).toBe(false)
  })

  it('reads aria-pressed from an inner element (2026 markup)', () => {
    expect(isReactionActive(btn('', '<span aria-pressed="true"></span>'))).toBe(true)
  })

  it('recognises undo-phrased labels as the reacted state', () => {
    expect(isReactionActive(btn('aria-label="Unreact Like"'))).toBe(true)
    expect(isReactionActive(btn('aria-label="Отменить реакцию «Нравится»"'))).toBe(true)
    expect(isReactionActive(btn('aria-label="Like"'))).toBe(false)
  })

  // Labels captured live 2026-07-03 from the hashed-class feed.
  it('reads the spelled-out state label (2026 markup)', () => {
    expect(isReactionActive(btn('aria-label="Reaction button state: no reaction"'))).toBe(false)
    expect(isReactionActive(btn('aria-label="Reaction button state: Like"'))).toBe(true)
  })
})

describe('findReactionTrigger (2026 feed action bar)', () => {
  it('prefers the state-bearing toggle over counters and the flyout opener', () => {
    const host = build(
      `<div role="listitem">
         <button id="count" aria-label="411 reactions">411</button>
         <button id="toggle" aria-label="Reaction button state: no reaction">32</button>
         <button id="menu" aria-label="Open reactions menu" aria-expanded="false"></button>
       </div>`,
    )
    expect(findReactionTrigger(host.querySelector('[role="listitem"]')!)?.id).toBe('toggle')
  })

  it('still prefers an aria-pressed toggle when present (legacy markup)', () => {
    const host = build(
      `<div role="listitem">
         <button id="plain" aria-label="Like">Like</button>
         <button id="pressed" aria-label="Like" aria-pressed="false">Like</button>
       </div>`,
    )
    expect(findReactionTrigger(host.querySelector('[role="listitem"]')!)?.id).toBe('pressed')
  })
})

// Comment box structure captured live 2026-07-03: bare divs, no <form>, no
// stable classes; the editor is div[role="textbox"][contenteditable="true"].
describe('comments in the 2026 markup', () => {
  function commentBox(editorText: string, buttonHtml: string): HTMLElement {
    return build(
      `<div role="listitem">
         <div>
           <div>
             <div role="textbox" contenteditable="true" aria-label="Text editor for creating comment">${editorText}</div>
             <div>
               <button aria-label="Show Emoji Picker"></button>
               ${buttonHtml}
             </div>
           </div>
         </div>
       </div>`,
    )
  }

  it('detects the submit button next to a non-empty editor', () => {
    const host = commentBox('draft text', '<button id="b">Comment</button>')
    expect(isCommentSubmitButton(host.querySelector('#b')!)).toBe(true)
  })

  it('ignores submit-worded buttons while the editor is empty', () => {
    const host = commentBox('', '<button id="b">Comment</button>')
    expect(isCommentSubmitButton(host.querySelector('#b')!)).toBe(false)
  })

  it('never treats Repost as a comment submit', () => {
    const host = commentBox('draft text', '<button id="b">Repost</button>')
    expect(isCommentSubmitButton(host.querySelector('#b')!)).toBe(false)
  })

  it('counts rendered comments via their replaceableComment componentkey', () => {
    const host = build(
      `<div componentkey="replaceableComment_urn:li:comment:(urn:li:activity:1,2)">a</div>
       <div componentkey="replaceableComment_urn:li:comment:(urn:li:activity:1,3)">b</div>
       <div componentkey="pagedCommentsContainerX">c</div>`,
    )
    expect(host.querySelectorAll(COMMENT_ITEM_SELECTOR).length).toBe(2)
  })

  it('classifies a submit inside an existing comment as a reply', () => {
    const host = build(
      `<div componentkey="replaceableComment_urn:li:comment:(urn:li:activity:1,2)">
         <div role="textbox" contenteditable="true">draft</div>
         <button id="b">Reply</button>
       </div>`,
    )
    expect(isReplyContext(host.querySelector('#b')!)).toBe(true)
  })
})

describe('classifyReaction after confirmation', () => {
  it('derives the type from the post-click undo label', () => {
    expect(classifyReaction('unreact like reaction button state: no reaction')).toBe('like')
    expect(classifyReaction('unreact celebrate reaction button state: no reaction')).toBe('celebrate')
  })
})

describe('reaction fallback predicates', () => {
  it('matchesReactionWord matches localized accessible text', () => {
    expect(matchesReactionWord('like')).toBe(true)
    expect(matchesReactionWord('нравится')).toBe(true)
    expect(matchesReactionWord('reaguj')).toBe(true)
    expect(matchesReactionWord('share')).toBe(false)
  })

  it('opensMenu flags flyout openers only', () => {
    const host = build(
      `<button id="menu" aria-haspopup="menu">React</button><button id="plain">Like</button>`,
    )
    expect(opensMenu(host.querySelector<HTMLElement>('#menu')!)).toBe(true)
    expect(opensMenu(host.querySelector<HTMLElement>('#plain')!)).toBe(false)
  })
})
