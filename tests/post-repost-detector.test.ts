import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackedEvent } from '../src/common/types'

const emittedEvents = vi.hoisted(() => [] as TrackedEvent[])
const diagnostics = vi.hoisted(() => [] as Array<{ source: string; code: string; message: string }>)

vi.mock('../src/content/messaging', () => ({
  debug: vi.fn(),
  emitDiagnostic: vi.fn((_level: string, source: string, code: string, message: string) => {
    diagnostics.push({ source, code, message })
  }),
  emitEvent: vi.fn((event: TrackedEvent) => {
    emittedEvents.push(event)
  }),
  emitSelectorHealth: vi.fn(),
  trace: vi.fn((source: string, code: string, message: string) => {
    diagnostics.push({ source, code, message })
  }),
}))

import { PostDetector } from '../src/content/detectors/post'
import { RepostDetector } from '../src/content/detectors/repost'
import { clearRepostWithThoughtsPending } from '../src/content/detectors/share-composer'

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function build(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

describe('post/repost detector coordination', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'))
    document.body.innerHTML = ''
    emittedEvents.length = 0
    diagnostics.length = 0
    clearRepostWithThoughtsPending()
  })

  afterEach(() => {
    clearRepostWithThoughtsPending()
    vi.useRealTimers()
  })

  it('records repost with thoughts after the share composer is published', async () => {
    const repost = new RepostDetector()
    const post = new PostDetector()
    repost.attach()
    post.attach()
    const host = build(`
      <button id="trigger" aria-label="Repost" aria-expanded="false">Repost</button>
      <div role="menu-less-popover">
        <a tabindex="0" id="thoughts">
          <span>Repost with your thoughts</span>
          <span>Create a new post with George's post attached</span>
        </a>
      </div>
      <div aria-modal="true" class="artdeco-modal" id="composer">
        <button id="publish">Post</button>
      </div>
    `)

    click(host.querySelector('#trigger')!)
    click(host.querySelector('#thoughts span')!)
    repost.onNavigate()
    click(host.querySelector('#publish')!)
    host.querySelector('#composer')!.remove()
    await vi.advanceTimersByTimeAsync(400)

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      type: 'repost',
      source: 'automatic',
      metadata: { kind: 'with_thoughts' },
    })
    expect(diagnostics).toContainEqual({
      source: 'post',
      code: 'submit_candidate',
      message: 'kind=repost_with_thoughts',
    })

    repost.detach()
    post.detach()
  })

  it('keeps normal share composer publishes as posts', async () => {
    const post = new PostDetector()
    post.attach()
    const host = build(`
      <div role="dialog" id="composer">
        <button id="publish">Post</button>
      </div>
    `)

    click(host.querySelector('#publish')!)
    host.querySelector('#composer')!.remove()
    await vi.advanceTimersByTimeAsync(400)

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      type: 'post',
      source: 'automatic',
      metadata: { kind: 'unknown' },
    })

    post.detach()
  })
})
