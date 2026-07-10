// English message catalog. Keys are flat, dot-namespaced strings. The `ru`
// catalog is type-checked to contain exactly these keys.
export const en = {
  'app.name': 'LinkedIn Activity Tracker',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.close': 'Close',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.minutes': 'min',
  'common.seconds': 'seconds',
  'common.loading': 'Loading…',
  'common.today': 'Today',
  'common.done': 'Done',

  'popup.title': 'Today',
  'popup.openDashboard': 'Open dashboard',
  'popup.addSSI': 'Add SSI',
  'popup.editToday': 'Edit today',
  'popup.exportReport': 'Export report',
  'popup.pause': 'Pause tracking',
  'popup.resume': 'Resume tracking',
  'popup.paused': 'Tracking is paused',

  'events.activeTime': 'Active time',
  'events.reaction': 'Reactions',
  'events.comment': 'Comments',
  'events.reply': 'Replies',
  'events.connection_request': 'Connects',
  'events.message': 'Messages',
  'events.repost': 'Reposts',
  'events.post': 'Posts',
  'events.follow': 'Follows',
  'events.profile_view': 'Profiles viewed',
  'events.company_view': 'Companies viewed',
  'events.job_view': 'Jobs viewed',

  'nav.today': 'Today',
  'nav.history': 'History',
  'nav.ssi': 'Analytics',
  'nav.goals': 'Daily goals',
  'nav.privacy': 'Privacy',
  'nav.diagnostics': 'Diagnostics',

  'dash.title': 'LinkedIn Activity Tracker',
  'dash.header.trackingActive': 'Tracking active',
  'dash.today.heading': 'Today’s progress',
  'dash.today.subtitle': 'A quick read on today’s visible LinkedIn effort.',
  'dash.today.goal.done': 'Done',
  'dash.today.capture.heading': 'Capture today’s LinkedIn metrics',
  'dash.today.capture.body':
    'Open these LinkedIn pages once today so the extension can save the latest analytics locally.',
  'dash.today.capture.open': 'Open',
  'dash.today.capture.recorded': 'Recorded',
  'dash.today.activeTimeLabel': 'Active time (minutes)',
  'dash.history.heading': 'History',
  'dash.history.date': 'Date',
  'dash.history.time': 'Time',
  'dash.history.empty': 'No history yet.',
  'dash.history.actionsCount': '{count} actions',
  'dash.history.less': 'Less',
  'dash.history.more': 'More',
  'dash.history.profileViewers': 'Viewers',
  'dash.history.postImpressions': 'Impressions',
  'dash.history.followers': 'Followers',
  'dash.history.searchAppearances': 'Search',

  'dash.ssi.heading': 'Social Selling Index',
  'dash.ssi.total': 'Total SSI',
  'dash.ssi.professionalBrand': 'Establish your professional brand',
  'dash.ssi.findRightPeople': 'Find the right people',
  'dash.ssi.engageWithInsights': 'Engage with insights',
  'dash.ssi.buildRelationships': 'Build relationships',
  'dash.ssi.add': 'Add SSI entry',
  'dash.ssi.history': 'Observation history',
  'dash.ssi.date': 'Date',
  'dash.ssi.noData':
    'No SSI entries yet. Open linkedin.com/sales/ssi so the extension can record it.',
  'dash.ssi.disclaimer':
    'Activity and SSI are shown side by side. This is a visual comparison only and does not imply cause and effect.',
  'dash.views.heading': 'Profile viewers',
  'dash.views.viewers': 'Viewers',
  'dash.views.rangeDays': 'Period (days)',
  'dash.views.noData':
    'No entries yet. Open “Who’s viewed your profile” on LinkedIn to record today’s count.',

  'dash.linkedinDashboard.heading': 'LinkedIn dashboard',
  'dash.linkedinDashboard.postImpressions': 'Post impressions',
  'dash.linkedinDashboard.postImpressionsRangeDays': 'Impression period (days)',
  'dash.linkedinDashboard.followers': 'Total followers',
  'dash.linkedinDashboard.followersChangePercent': 'Follower change (%)',
  'dash.linkedinDashboard.profileViewers': 'Profile viewers',
  'dash.linkedinDashboard.profileViewersRangeDays': 'Viewer period (days)',
  'dash.linkedinDashboard.searchAppearances': 'Search appearances',
  'dash.linkedinDashboard.searchAppearancesPeriod': 'Search period',
  'dash.linkedinDashboard.searchAppearancesChangePercent': 'Search change (%)',
  'dash.linkedinDashboard.weeklyPosts': 'Weekly posts',
  'dash.linkedinDashboard.weeklyComments': 'Weekly comments',
  'dash.linkedinDashboard.weeklyPeriod': 'Weekly period',
  'dash.linkedinDashboard.noData':
    'No entries yet. Open linkedin.com/dashboard/ to record aggregate dashboard metrics.',

  'dash.goals.heading': 'Daily goals',
  'dash.goals.subtitle':
    'Set a daily target for each action. Progress shows on the Today tab.',
  'dash.goals.saved': 'Goals saved.',
  'dash.goals.todayCount': 'Today: {count}',
  'dash.goals.offHint': 'Off — not counted toward the daily goal',
  'dash.goals.total': 'Total actions per day',
  'dash.goals.unsaved': 'Unsaved changes',
  'dash.goals.revert': 'Revert',
  'dash.goals.decrease': 'Decrease {label}',
  'dash.goals.increase': 'Increase {label}',

  'dash.privacy.heading': 'Privacy',
  'dash.privacy.notice':
    'This extension never performs actions on LinkedIn. It only records actions that you manually complete in your browser. All activity data is stored locally on your device.',
  'dash.privacy.heroTitle': 'Local-first. Your data is yours.',
  'dash.privacy.heroBody':
    'LinkedIn Activity Tracker runs in your browser, stores data in local Chrome storage, and does not send your activity to any server. The extension is open source, so the code can be inspected.',
  'dash.privacy.sourceCode': 'View source code',
  'dash.privacy.safety': 'Safe for your account',
  'dash.privacy.safetyBody':
    'The extension performs no actions on LinkedIn on your behalf and automates nothing — no auto-likes, auto-messages, or auto-connects. It only records the activity you do yourself, so you can later analyze why your SSI grows or stalls.',
  'dash.privacy.whatStored': 'What is stored',
  'dash.privacy.whatStoredBody':
    'Timestamps, action types, URLs without query parameters, aggregated counters, active time, SSI scores, aggregate profile-viewer counts, aggregate dashboard metrics, and optional local metadata such as comment length and invitation profile details.',
  'dash.privacy.whatNotStored': 'What is never stored',
  'dash.privacy.whatNotStoredBody':
    'No message, comment or post text. No emails, photos, profile contents, cookies, tokens or network responses.',
  'dash.privacy.whereStored': 'Where it is stored',
  'dash.privacy.whereStoredBody':
    'Only locally in your browser (chrome.storage.local). There is no backend account, sync service, or analytics upload for your activity data.',
  'dash.privacy.openSource': 'Open source',
  'dash.privacy.openSourceBody':
    'The extension source code is public and can be reviewed on',
  'dash.privacy.tracking': 'Tracking toggles',
  'dash.privacy.exportData': 'Export all data (JSON)',
  'dash.privacy.importData': 'Import data (JSON)',
  'dash.privacy.deleteAll': 'Delete all history',
  'dash.privacy.deleteAllConfirm':
    'Delete ALL tracked data permanently? This cannot be undone.',
  'dash.privacy.deleted': 'All data deleted.',
  'dash.privacy.storeCommentLength': 'Store comment length',
  'dash.privacy.storeCommentLengthHint':
    'On by default so you can review comment effort later. The text itself is never stored.',
  'dash.privacy.storeCommentMeaningful': 'Store “meaningful” flag for comments',
  'dash.privacy.storeCommentMeaningfulHint':
    'Stores only a yes/no quality signal based on length, not comment text.',
  'dash.privacy.storeConnectionProfileUrl': 'Store profile URL for invitations',
  'dash.privacy.storeConnectionProfileUrlHint':
    'On by default for detailed local invite history. Disable it if you prefer aggregate-only records.',
  'dash.privacy.storeConnectionDisplayName': 'Store display name for invitations',
  'dash.privacy.storeConnectionDisplayNameHint':
    'On by default so invite history stays recognizable locally. Disable it if you do not want names stored.',

  'dash.diag.heading': 'Diagnostics',
  'dash.diag.version': 'Extension version',
  'dash.diag.timezone': 'Timezone',
  'dash.diag.selectorHealth': 'Tracking status',
  'dash.diag.log': 'Event log',
  'dash.diag.empty': 'No diagnostic entries.',
  'dash.diag.export': 'Export diagnostics',
  'dash.diag.clear': 'Clear log',

  'status.working': 'Working',
  'status.needs_verification': 'Needs verification',
  'status.unknown': 'Unknown',

  'settings.idleThreshold': 'Idle threshold',
  'settings.theme': 'Theme',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.language': 'Language',

  'toast.ssiRecorded': 'SSI recorded: {total}',
  'toast.profileViewsRecorded': 'Profile viewers recorded: {viewers}',
  'toast.linkedInDashboardRecorded': 'LinkedIn dashboard recorded',
} as const

export type MessageKey = keyof typeof en
