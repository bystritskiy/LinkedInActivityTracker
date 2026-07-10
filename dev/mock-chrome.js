// Dev-only harness: fakes the chrome.* APIs the UI reads, seeded with realistic
// data so the popup/dashboard can be rendered for Chrome Web Store screenshots
// without loading the extension or touching LinkedIn. Not part of the build.
(function () {
  function pad2(n) { return n < 10 ? '0' + n : '' + n }
  function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }
  function isoAt(d, h, m, s) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s || 0).toISOString()
  }
  function dayOffset(n) {
    var now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12, 0, 0)
  }

  // Per-day figures, offset 0 = today ... 7 = a week ago.
  var series = [
    { r: 7, c: 2, rep: 1, conn: 4, msg: 2, rp: 1, post: 1, sec: 2520, ssi: 72.0, viewers: 143, imp: 5231, foll: 2847, follPct: 3.2, search: 88, wPosts: 3, wComments: 14 },
    { r: 6, c: 2, rep: 0, conn: 5, msg: 1, rp: 1, post: 0, sec: 1980, ssi: 71.5, viewers: 138, imp: 4870, foll: 2841, follPct: 2.9, search: 81, wPosts: 3, wComments: 12 },
    { r: 9, c: 3, rep: 1, conn: 3, msg: 3, rp: 0, post: 1, sec: 3120, ssi: 71.1, viewers: 150, imp: 6120, foll: 2833, follPct: 3.4, search: 95, wPosts: 4, wComments: 16 },
    { r: 4, c: 1, rep: 0, conn: 2, msg: 1, rp: 0, post: 0, sec: 1440, ssi: 70.8, viewers: 121, imp: 3980, foll: 2825, follPct: 2.1, search: 70, wPosts: 2, wComments: 9 },
    { r: 8, c: 2, rep: 2, conn: 6, msg: 2, rp: 1, post: 0, sec: 2760, ssi: 70.4, viewers: 147, imp: 5510, foll: 2817, follPct: 3.0, search: 90, wPosts: 3, wComments: 13 },
    { r: 5, c: 2, rep: 0, conn: 4, msg: 0, rp: 1, post: 1, sec: 1680, ssi: 69.9, viewers: 129, imp: 4200, foll: 2808, follPct: 2.6, search: 77, wPosts: 2, wComments: 11 },
    { r: 7, c: 3, rep: 1, conn: 5, msg: 2, rp: 0, post: 0, sec: 2340, ssi: 69.3, viewers: 134, imp: 4760, foll: 2800, follPct: 2.8, search: 83, wPosts: 3, wComments: 12 },
    { r: 3, c: 1, rep: 0, conn: 1, msg: 1, rp: 0, post: 0, sec: 900, ssi: 68.6, viewers: 112, imp: 3410, foll: 2790, follPct: 1.9, search: 64, wPosts: 1, wComments: 7 },
  ]

  function ssiEntry(d, total) {
    return {
      timestamp: isoAt(d, 9, 12, 0),
      total: total,
      professionalBrand: Math.round(total * 0.26 * 10) / 10,
      findRightPeople: Math.round(total * 0.24 * 10) / 10,
      engageWithInsights: Math.round(total * 0.27 * 10) / 10,
      buildRelationships: Math.round(total * 0.23 * 10) / 10,
      source: 'automatic',
    }
  }
  function viewsEntry(d, viewers) {
    return { timestamp: isoAt(d, 9, 13, 0), viewers: viewers, rangeDays: 90, source: 'automatic' }
  }
  function dashEntry(d, s) {
    return {
      timestamp: isoAt(d, 9, 14, 0),
      postImpressions: s.imp, postImpressionsRangeDays: 7,
      followers: s.foll, followersChangePercent: s.follPct,
      profileViewers: s.viewers, profileViewersRangeDays: 90,
      searchAppearances: s.search, searchAppearancesPeriod: 'this week', searchAppearancesChangePercent: 12,
      weeklyPosts: s.wPosts, weeklyComments: s.wComments, weeklyPeriod: 'past 7 days',
      source: 'automatic',
    }
  }

  var days = {}
  for (var i = 0; i < series.length; i++) {
    var d = dayOffset(i)
    var key = dayKey(d)
    var s = series[i]
    var ssi = ssiEntry(d, s.ssi)
    var views = viewsEntry(d, s.viewers)
    var dash = dashEntry(d, s)
    days[key] = {
      dayKey: key,
      stats: {
        dayKey: key,
        activeSeconds: s.sec,
        counters: {
          reaction: s.r, comment: s.c, reply: s.rep,
          connection_request: s.conn, message: s.msg, repost: s.rp, post: s.post,
        },
        ssi: ssi, profileViews: views, linkedInDashboard: dash,
      },
      events: [],
      sessions: [],
      ssiEntries: [ssi],
      profileViewsEntries: [views],
      linkedInDashboardEntries: [dash],
    }
  }

  // Populate today's events table with plausible per-action rows.
  var today = dayOffset(0)
  var todayKey = dayKey(today)
  var plan = [
    ['reaction', 6], ['reaction', 6], ['reaction', 6], ['reaction', 6],
    ['reaction', 6], ['reaction', 6], ['reaction', 6],
    ['comment', 6], ['comment', 6], ['reply', 6],
    ['connection_request', 6], ['connection_request', 6],
    ['connection_request', 6], ['connection_request', 6],
    ['message', 6], ['message', 6], ['repost', 6], ['post', 6],
  ]
  var events = []
  var hh = 9, mm = 24
  for (var e = 0; e < plan.length; e++) {
    mm += 11
    hh += Math.floor(mm / 60)
    mm = mm % 60
    events.push({
      id: 'ev-' + e,
      type: plan[e][0],
      timestamp: isoAt(today, hh % 24, mm, (e * 7) % 60),
      dayKey: todayKey,
      source: e % 6 === 5 ? 'manual' : 'automatic',
    })
  }
  days[todayKey].events = events

  var installed = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 34, 10, 0, 0).toISOString()

  var root = {
    schemaVersion: 4,
    settings: {
      locale: 'en',
      theme: 'system',
      idleThresholdSeconds: 60,
      goals: { reactions: 5, comments: 2, connectionRequests: 5, messages: 2, reposts: 1, posts: 0 },
      tracking: {
        activeTime: true, reaction: true, comment: true, connection_request: true,
        message: true, repost: true, post: true,
        follow: false, profile_view: false, company_view: false, job_view: false,
      },
      privacy: {
        storeCommentLength: true, storeCommentMeaningful: true,
        storeConnectionProfileUrl: true, storeConnectionDisplayName: true,
        meaningfulCommentMinChars: 20,
      },
      notifications: { dailyReminder: false, goalCompletion: false, reminderTime: '18:00' },
      paused: false,
      debug: false,
    },
    days: days,
    selectorHealth: {
      reaction: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      comment: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      connection: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      message: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      repost: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      post: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      activeTime: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      ssi: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      profileViews: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
      linkedInDashboard: { status: 'working', lastConfirmedAt: isoAt(today, 9, 30, 0) },
    },
    diagnostics: [
      { id: 'd1', timestamp: isoAt(today, 9, 14, 2), level: 'info', source: 'linkedInDashboard', code: 'snapshot_recorded', message: 'Recorded dashboard snapshot' },
      { id: 'd2', timestamp: isoAt(today, 9, 13, 1), level: 'info', source: 'ssi', code: 'snapshot_recorded', message: 'Recorded SSI 72.0' },
    ],
    installedAt: installed,
    lastSeenVersion: '1.0.0',
  }

  window.chrome = {
    runtime: {
      lastError: undefined,
      openOptionsPage: function () {},
      sendMessage: function (msg) {
        if (msg && msg.kind === 'getState') return Promise.resolve(root)
        if (msg && msg.kind === 'export') {
          return Promise.resolve({ ok: true, format: msg.format, filename: 'report.md', mime: 'text/markdown', content: '# demo' })
        }
        return Promise.resolve({ ok: true })
      },
    },
    storage: {
      local: {
        get: function () { return Promise.resolve({}) },
        set: function () { return Promise.resolve() },
      },
      onChanged: { addListener: function () {}, removeListener: function () {} },
    },
  }
})();
