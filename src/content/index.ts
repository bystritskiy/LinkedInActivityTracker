// Content script entry point.
//
// IMPORTANT: This script only OBSERVES. It attaches passive listeners, watches
// DOM state before/after the user's own clicks, and reports confirmed actions.
// It never clicks, types, submits, scrolls, or mutates LinkedIn to perform an
// action on the user's behalf.

import { DetectorManager } from './detector'
import { refreshContext } from './page-context'
import { watchNavigation } from './navigation'
import { initSettings } from './settings'
import { ActiveTimeDetector } from './detectors/active-time'
import { ReactionDetector } from './detectors/reaction'
import { ConnectionDetector } from './detectors/connection'
import { CommentDetector } from './detectors/comment'
import { RepostDetector } from './detectors/repost'
import { MessageDetector } from './detectors/message'
import { PostDetector } from './detectors/post'
import { trace } from './messaging'

async function boot(): Promise<void> {
  await initSettings()
  trace('content', 'boot', `page=${refreshContext().pageType}`)

  const manager = new DetectorManager(refreshContext, watchNavigation)
  manager
    .register(new ActiveTimeDetector())
    .register(new ReactionDetector())
    .register(new ConnectionDetector())
    .register(new CommentDetector())
    .register(new RepostDetector())
    .register(new MessageDetector())
    .register(new PostDetector())
    .start()

  console.debug('[LAT] content tracking started')
}

void boot()
