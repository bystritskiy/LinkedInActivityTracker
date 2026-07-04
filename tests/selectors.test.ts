import { describe, expect, it } from 'vitest'
import {
  COMMENT_ITEM_SELECTOR,
  classifyReaction,
  closestPostContainer,
  extractProfileViews,
  extractSSI,
  connectBecamePending,
  connectCardScope,
  findReactionTrigger,
  isCommentSubmitButton,
  isConnectButton,
  isMessageSendButton,
  isReactionActive,
  isReplyContext,
  isSendInvitationButton,
  matchesReactionWord,
  messageEditorFrom,
  opensMenu,
  repostMenuSelection,
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

describe('repostMenuSelection (2026 dropdown markup)', () => {
  // Mirrors the live chain captured in diagnostics: options are bare <a>
  // elements (no href, no role) inside listitem/display-contents wrappers.
  function repostMenu(): HTMLElement {
    return build(`
      <div class="_75228706" role="menu-less-popover">
        <div data-display-contents="true">
          <div role="listitem" class="_75228706">
            <div class="_58c79b9a">
              <a tabindex="0" id="instant" class="_6708dccf">
                <span>Repost</span>
                <span>Instantly bring George's post to others' feeds</span>
              </a>
            </div>
          </div>
          <div role="listitem" class="_75228706">
            <div class="_58c79b9a">
              <a tabindex="0" id="thoughts" class="_6708dccf">
                <span>Repost with your thoughts</span>
                <span>Create a new post with George's post attached</span>
              </a>
            </div>
          </div>
        </div>
      </div>`)
  }

  it('classifies a click deep inside the instant option', () => {
    const host = repostMenu()
    const target = host.querySelector('#instant span')!
    expect(repostMenuSelection(target)).toBe('instant')
  })

  it('classifies the with-thoughts option', () => {
    const host = repostMenu()
    const target = host.querySelector('#thoughts span')!
    expect(repostMenuSelection(target)).toBe('with_thoughts')
  })

  it('returns null for the trigger button itself', () => {
    const host = build(
      `<button aria-label="Repost" aria-expanded="false"><span id="t">2</span></button>`,
    )
    expect(repostMenuSelection(host.querySelector('#t')!)).toBe(null)
  })

  it('ignores social-proof counters and unrelated clicks', () => {
    const host = build(
      `<div><a id="proof" href="/reposts/">2 reposts</a><button id="like" aria-label="React Like">Like</button></div>`,
    )
    expect(repostMenuSelection(host.querySelector('#proof')!)).toBe(null)
    expect(repostMenuSelection(host.querySelector('#like')!)).toBe(null)
  })

  it('does not classify from a container mixing both options', () => {
    const host = repostMenu()
    // Clicking the wrapper (not an option) must not match via container text.
    const wrapper = host.querySelector('[data-display-contents]')!
    expect(repostMenuSelection(wrapper)).toBe(null)
  })
})

describe('connect request selectors', () => {
  it('isConnectButton matches the bare Connect button and the invite aria-label', () => {
    const host = build(
      `<button id="bare">Connect</button>
       <button id="aria" aria-label="Invite John Doe to connect">Connect</button>
       <button id="ru">Установить контакт</button>
       <button id="pl" aria-label="Zaproś Jana Kowalskiego do nawiązania kontaktu">Nawiąż kontakt</button>`,
    )
    expect(isConnectButton(host.querySelector<HTMLElement>('#bare')!)).toBe(true)
    expect(isConnectButton(host.querySelector<HTMLElement>('#aria')!)).toBe(true)
    expect(isConnectButton(host.querySelector<HTMLElement>('#ru')!)).toBe(true)
    expect(isConnectButton(host.querySelector<HTMLElement>('#pl')!)).toBe(true)
  })

  it('isConnectButton rejects pending state and lookalike controls', () => {
    const host = build(
      `<button id="pending" aria-label="Pending, click to withdraw invitation">Pending</button>
       <button id="subscribe">Invite your connections to subscribe</button>
       <button id="message">Message</button>`,
    )
    expect(isConnectButton(host.querySelector<HTMLElement>('#pending')!)).toBe(false)
    expect(isConnectButton(host.querySelector<HTMLElement>('#subscribe')!)).toBe(false)
    expect(isConnectButton(host.querySelector<HTMLElement>('#message')!)).toBe(false)
  })

  it('isSendInvitationButton matches "Send without a note" outside a detectable dialog (2026)', () => {
    const host = build(
      `<div><button id="nonote">Send without a note</button><button id="add">Add a note</button></div>`,
    )
    expect(isSendInvitationButton(host.querySelector<HTMLElement>('#nonote')!)).toBe(true)
    expect(isSendInvitationButton(host.querySelector<HTMLElement>('#add')!)).toBe(false)
  })

  it('connectBecamePending sees an in-place label swap and a card-level swap', () => {
    const host = build(
      `<div role="listitem"><button id="b">Connect</button></div>`,
    )
    const btn = host.querySelector<HTMLElement>('#b')!
    const scope = connectCardScope(btn)
    expect(connectBecamePending(btn, scope)).toBe(false)
    btn.setAttribute('aria-label', 'Pending, click to withdraw invitation')
    expect(connectBecamePending(btn, scope)).toBe(true)
    // card-level: original button replaced by a Pending control
    btn.remove()
    scope!.insertAdjacentHTML('beforeend', '<button>Pending</button>')
    expect(connectBecamePending(btn, scope)).toBe(true)
  })
})

describe('message selectors in the 2026 markup', () => {
  function compose(editorAttrs: string, buttonHtml: string): HTMLElement {
    return build(
      `<div>
         <div>
           <div role="textbox" contenteditable="true" ${editorAttrs}>draft</div>
           <div>
             <button aria-label="Attach a file"></button>
             ${buttonHtml}
           </div>
         </div>
       </div>`,
    )
  }

  it('detects a bare Send button next to a message-compose editor', () => {
    const host = compose(
      'aria-label="Write a message…"',
      '<button id="b" aria-label="Send">Send</button>',
    )
    expect(isMessageSendButton(host.querySelector<HTMLElement>('#b')!)).toBe(true)
  })

  it('detects "Send message" by its own label, and localized variants', () => {
    const host = build(
      `<button id="en" aria-label="Send message">Send</button>
       <button id="ru" aria-label="Отправить сообщение">Отправить</button>`,
    )
    expect(isMessageSendButton(host.querySelector<HTMLElement>('#en')!)).toBe(true)
    expect(isMessageSendButton(host.querySelector<HTMLElement>('#ru')!)).toBe(true)
  })

  it('does not treat a send-worded button near a comment editor as a message send', () => {
    const host = compose(
      'aria-label="Text editor for creating comment"',
      '<button id="b">Отправить</button>',
    )
    expect(isMessageSendButton(host.querySelector<HTMLElement>('#b')!)).toBe(false)
  })

  it('messageEditorFrom recognises the compose field by placeholder text', () => {
    const host = build(
      `<div role="textbox" contenteditable="true" aria-placeholder="Napisz wiadomość…"><span id="inner">hi</span></div>
       <div id="plain" role="textbox" contenteditable="true" aria-label="Text editor for creating comment">x</div>`,
    )
    expect(messageEditorFrom(host.querySelector('#inner'))).not.toBeNull()
    expect(messageEditorFrom(host.querySelector('#plain'))).toBeNull()
  })
})

// SSI page structure captured live 2026-07-03 from linkedin.com/sales/ssi:
// each donut ("N out of 100" figcaption) is backed by a hidden a11y table of
// th/td rows including a "Remaining points" row; three donut+table groups on
// the page (current SSI, industry average, network average).
function ssiTable(pb: string, frp: string, ewi: string, br: string, remaining: string): string {
  return `<table>
      <tr><th>Category</th><th>value</th></tr>
      <tr><th>Establish your professional brand</th><td>${pb}</td></tr>
      <tr><th>Find the right people</th><td>${frp}</td></tr>
      <tr><th>Engage with insights</th><td>${ewi}</td></tr>
      <tr><th>Build relationships</th><td>${br}</td></tr>
      <tr><th>Remaining points</th><td>${remaining}</td></tr>
    </table>`
}

describe('extractSSI', () => {
  it('parses the live 2026 page: donut captions plus backing a11y tables', () => {
    const host = build(
      `<main>
         <h1>Your Social Selling Index</h1>
         <div><span>Top</span><span>37%</span><p>Industry SSI rank</p></div>
         <section>
           <h2>Current Social Selling Index</h2>
           <figure><figcaption>33 out of 100</figcaption></figure>
           ${ssiTable('12.05', '4.76', '1', '15', '67')}
         </section>
         <section>
           <h2>People in your industry</h2>
           <figure><figcaption>29 out of 100</figcaption></figure>
           ${ssiTable('11.27', '4.54', '1.56', '11.88', '71')}
           <p>Sales professionals in your industry have an average SSI of 29.</p>
         </section>
         <section>
           <h2>People in your network</h2>
           <figure><figcaption>36 out of 100</figcaption></figure>
           ${ssiTable('13.1', '8.2', '2.4', '12.3', '64')}
           <p>People in your network have an average SSI of 36.</p>
         </section>
       </main>`,
    )
    expect(extractSSI(host)).toEqual({
      total: 33,
      professionalBrand: 12.05,
      findRightPeople: 4.76,
      engageWithInsights: 1,
      buildRelationships: 15,
    })
  })

  it('parses localized tables with comma decimals (ru)', () => {
    const host = build(
      `<section>
         <p>32 из 100</p>
         <table>
           <tr><th>Создавайте профессиональный бренд</th><td>12,05</td></tr>
           <tr><th>Находите нужных людей</th><td>4,76</td></tr>
           <tr><th>Взаимодействуйте с контентом</th><td>0,6</td></tr>
           <tr><th>Развивайте отношения</th><td>15</td></tr>
         </table>
       </section>`,
    )
    expect(extractSSI(host)).toEqual({
      total: 32,
      professionalBrand: 12.05,
      findRightPeople: 4.76,
      engageWithInsights: 0.6,
      buildRelationships: 15,
    })
  })

  it('matches the table to the current total when an average table renders first', () => {
    const host = build(
      `<main>
         <p>33 out of 100</p>
         ${ssiTable('11.27', '4.54', '1.56', '11.88', '71')}
         ${ssiTable('12.05', '4.76', '1', '15', '67')}
       </main>`,
    )
    expect(extractSSI(host)).toEqual({
      total: 33,
      professionalBrand: 12.05,
      findRightPeople: 4.76,
      engageWithInsights: 1,
      buildRelationships: 15,
    })
  })

  it('supports the "value | label" fallback rendering and a summed total', () => {
    const host = build(
      `<ul>
         <li>12.05 | Establish your professional brand</li>
         <li>4.76 | Find the right people</li>
         <li>1 | Engage with insights</li>
         <li>15 | Build relationships</li>
       </ul>`,
    )
    expect(extractSSI(host)?.total).toBe(33)
  })

  it('records the total alone when component tables are absent', () => {
    const host = build(`<figure><figcaption>33 out of 100</figcaption></figure>`)
    expect(extractSSI(host)).toEqual({ total: 33 })
  })

  it('returns null when the page has not rendered scores yet', () => {
    expect(extractSSI(build(`<div>Loading your Social Selling Index…</div>`))).toBeNull()
    expect(extractSSI(build(`<p>People in your network have an average SSI of 36.</p>`))).toBeNull()
  })
})

// Profile-views analytics page structure captured live 2026-07-04 from
// linkedin.com/analytics/profile-views/: the count and its caption are bare
// sibling <p>s in a hashed-class div, so their combined text reads
// "54Profile viewers in the past 90 days" with no whitespace between them.
describe('extractProfileViews', () => {
  it('parses the live 2026 analytics page: count and caption in sibling <p>s', () => {
    const host = build(
      `<main>
         <h1>Who's viewed your profile</h1>
         <button aria-haspopup="true">Past 90 days</button>
         <div><p>54</p><p>Profile viewers in the past 90 days</p></div>
         <div><p>6 recruiters</p><button>View</button></div>
         <div><p>12 found you through My Network</p><button>View</button></div>
         <p>Browse up to 3 viewers for free and unlock the full list with Premium</p>
         <p>Unlock your profile views and jobs where you’d be a top applicant</p>
       </main>`,
    )
    expect(extractProfileViews(host)).toEqual({ viewers: 54, rangeDays: 90 })
  })

  it('parses thousand separators and localized captions', () => {
    const en = build(`<div><p>1,024</p><p>Profile viewers in the past 90 days</p></div>`)
    expect(extractProfileViews(en)).toEqual({ viewers: 1024, rangeDays: 90 })
    const ru = build(`<div><p>51</p><p>Просмотревшие профиль за последние 90 дней</p></div>`)
    expect(extractProfileViews(ru)).toEqual({ viewers: 51, rangeDays: 90 })
    const pl = build(`<div><p>7</p><p>Wyświetlenia profilu w ciągu ostatnich 90 dni</p></div>`)
    expect(extractProfileViews(pl)).toEqual({ viewers: 7, rangeDays: 90 })
  })

  it('returns null when the count has not rendered yet', () => {
    expect(extractProfileViews(build(`<h1>Who's viewed your profile</h1>`))).toBeNull()
    expect(
      extractProfileViews(
        build(`<p>Unlock your profile views and jobs where you’d be a top applicant</p>`),
      ),
    ).toBeNull()
  })
})

describe('message editor on the /messaging/ page (2026)', () => {
  it('accepts any editable field when the page context is messaging', () => {
    const host = build(
      `<div role="textbox" contenteditable="true"><p id="inner">Thanks !</p></div>`,
    )
    const inner = host.querySelector('#inner')!
    expect(messageEditorFrom(inner, false)).toBeNull()
    expect(messageEditorFrom(inner, true)).not.toBeNull()
  })

  it('supports contenteditable="plaintext-only" editors', () => {
    const host = build(
      `<div id="ed" contenteditable="plaintext-only" aria-label="Write a message…">hi</div>`,
    )
    expect(messageEditorFrom(host.querySelector('#ed'), false)).not.toBeNull()
  })
})
