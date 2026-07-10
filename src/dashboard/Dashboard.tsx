import { useEffect, useMemo, useState } from 'react'
import { dayKeyFromDate, formatLocalDateTime24 } from '../common/date'
import { eventLabelKey, translator } from '../common/i18n'
import type { MessageKey } from '../common/i18n'
import type { ExportResult, SettingsPatch } from '../common/messages'
import { goalRows, summarizeStats } from '../common/summary'
import type {
  DailyGoals,
  LinkedInDashboardEntry,
  LocaleCode,
  ProfileViewsEntry,
  Settings,
  SSIEntry,
  StorageRoot,
  TrackedEventType,
} from '../common/types'
import {
  downloadText,
  exportAndDownload,
  loadState,
  sendMessage,
  subscribeState,
} from '../ui/chrome'

type Tab = 'today' | 'history' | 'ssi' | 'goals' | 'privacy' | 'diagnostics'

const mainTabs: Array<{ key: Tab; label: MessageKey }> = [
  { key: 'today', label: 'nav.today' },
  { key: 'history', label: 'nav.history' },
  { key: 'ssi', label: 'nav.ssi' },
  { key: 'goals', label: 'nav.goals' },
]

const utilityTabs: Array<{ key: Tab; label: MessageKey }> = [
  { key: 'privacy', label: 'nav.privacy' },
  { key: 'diagnostics', label: 'nav.diagnostics' },
]

const goalStatusKeys = {
  done: 'dash.today.goal.done',
  remaining: 'dash.today.goal.remaining',
} as const satisfies Record<string, MessageKey>

const manualTypes = [
  'reaction',
  'comment',
  'connection_request',
  'message',
  'repost',
  'post',
] as const satisfies readonly TrackedEventType[]

function eventLabel(settings: Settings, type: TrackedEventType): string {
  return translator(settings.locale)(eventLabelKey(type))
}

function sortedDayKeys(state: StorageRoot): string[] {
  return Object.keys(state.days).sort().reverse()
}

export function Dashboard() {
  const [state, setState] = useState<StorageRoot | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const todayKey = dayKeyFromDate(new Date())

  async function refresh(): Promise<void> {
    setState(await loadState())
  }

  useEffect(() => {
    let mounted = true
    loadState()
      .then((root) => {
        if (mounted) setState(root)
      })
      .catch((err: unknown) => setError(String((err as Error)?.message ?? err)))
    const unsubscribe = subscribeState((root) => setState(root))
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const t = useMemo(() => translator(state?.settings.locale ?? 'en'), [state?.settings.locale])

  async function run(action: () => Promise<void>, success?: string): Promise<void> {
    setError(null)
    setNotice(null)
    try {
      await action()
      await refresh()
      if (success) setNotice(success)
    } catch (err) {
      setError(String((err as Error)?.message ?? err))
    }
  }

  if (!state) {
    return (
      <main className="lat-dashboard">
        <p>{error ?? t('common.loading')}</p>
      </main>
    )
  }

  const today = state.days[todayKey]
  const todayStats = today?.stats ?? { dayKey: todayKey, activeSeconds: 0, counters: {} }
  const todaySummary = summarizeStats(todayStats)

  return (
    <main className="lat-dashboard">
      <header className="app-header">
        <div className="app-title">
          <h1>{t('dash.title')}</h1>
          <p>
            {todayKey}
            <span className="header-active-time">
              {t('events.activeTime')}: {todaySummary.activeMinutes} {t('common.minutes')}
            </span>
          </p>
        </div>
        <div className="app-actions">
          <button
            type="button"
            className={state.settings.paused ? 'tracking-toggle paused' : 'tracking-toggle'}
            onClick={() =>
              void run(() => sendMessage({ kind: 'setPaused', paused: !state.settings.paused }))
            }
            aria-label={state.settings.paused ? t('popup.resume') : t('popup.pause')}
            title={state.settings.paused ? t('popup.resume') : t('popup.pause')}
          >
            <TrackingStatusIcon active={!state.settings.paused} />
            {state.settings.paused ? t('popup.paused') : t('dash.header.trackingActive')}
          </button>
          <nav className="utility-tabs" aria-label="Settings sections">
            {utilityTabs.map((item) => (
              <button
                type="button"
                key={item.key}
                className={tab === item.key ? 'active' : ''}
                onClick={() => setTab(item.key)}
              >
                {t(item.label)}
              </button>
            ))}
          </nav>
          <select
            className="language-select"
            aria-label={t('settings.language')}
            title={t('settings.language')}
            value={state.settings.locale}
            onChange={(e) =>
              void run(() =>
                sendMessage({
                  kind: 'updateSettings',
                  patch: { locale: e.target.value as LocaleCode },
                }),
              )
            }
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        {mainTabs.map((item) => (
          <button
            type="button"
            key={item.key}
            className={tab === item.key ? 'active' : ''}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      {tab === 'today' && <TodayTab state={state} summary={todaySummary} />}
      {tab === 'history' && <HistoryTab state={state} />}
      {tab === 'ssi' && <SsiTab state={state} />}
      {tab === 'goals' && <GoalsTab state={state} onRun={run} />}
      {tab === 'privacy' && <PrivacyTab state={state} onRun={run} />}
      {tab === 'diagnostics' && <DiagnosticsTab state={state} onRun={run} />}
    </main>
  )
}

function TrackingStatusIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="status-icon"
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      focusable="false"
    >
      <path d="M8 2.5V7" />
      <path d="M5.1 4.6A5 5 0 1 0 10.9 4.6" />
      {!active && <path d="M3 3L13 13" />}
    </svg>
  )
}

function TodayTab(props: {
  state: StorageRoot
  summary: ReturnType<typeof summarizeStats>
}) {
  const t = translator(props.state.settings.locale)
  const rows = goalRows(props.summary, props.state.settings.goals)
  const goalRowsWithTargets = rows.filter((row) => row.target > 0)
  const targetActions = goalRowsWithTargets.reduce((sum, row) => sum + row.target, 0)
  const completedActions = goalRowsWithTargets.reduce(
    (sum, row) => sum + Math.min(row.current, row.target),
    0,
  )
  const completionRatio = targetActions > 0 ? Math.min(1, completedActions / targetActions) : 1

  return (
    <section>
      <div className="section-heading today-heading">
        <div>
          <h2>{t('dash.today.heading')}</h2>
          <p>{t('dash.today.subtitle')}</p>
        </div>
      </div>

      <div className="completion-meter">
        <div className="completion-meter-label">
          <span>{t('dash.today.summary.completion')}</span>
          <strong>{Math.round(completionRatio * 100)}%</strong>
        </div>
        <div className="completion-track" aria-hidden="true">
          <span style={{ width: `${Math.round(completionRatio * 100)}%` }} />
        </div>
      </div>

      <MetricCaptureChecklist state={props.state} dayKey={props.summary.dayKey} />

      <div className="goal-grid">
        {goalRowsWithTargets.map((row) => (
          <article
            className={`metric goal-card ${row.met ? 'is-complete' : ''}`}
            key={row.key}
          >
            <div className="metric-topline">
              <span>{t(eventLabelKey(row.key))}</span>
              <em>{goalStatusLabel(t, row.current, row.target, row.met)}</em>
            </div>
            <strong>
              {row.current} / {row.target}
            </strong>
            <div className="bar">
              <span style={{ width: `${Math.round(row.ratio * 100)}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function MetricCaptureChecklist({ state, dayKey }: { state: StorageRoot; dayKey: string }) {
  const t = translator(state.settings.locale)
  const day = state.days[dayKey]
  const items: Array<{ label: string; href: string; recorded: boolean }> = [
    {
      label: t('dash.ssi.heading'),
      href: 'https://www.linkedin.com/sales/ssi',
      recorded: Boolean(day?.ssiEntries?.length || day?.stats.ssi),
    },
    {
      label: t('dash.views.heading'),
      href: 'https://www.linkedin.com/analytics/profile-views/',
      recorded: Boolean(day?.profileViewsEntries?.length || day?.stats.profileViews),
    },
    {
      label: t('dash.linkedinDashboard.heading'),
      href: 'https://www.linkedin.com/dashboard/',
      recorded: Boolean(day?.linkedInDashboardEntries?.length || day?.stats.linkedInDashboard),
    },
  ]
  const missing = items.filter((item) => !item.recorded)
  if (missing.length === 0) return null

  return (
    <aside className="capture-checklist">
      <div>
        <strong>{t('dash.today.capture.heading')}</strong>
        <p>{t('dash.today.capture.body')}</p>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.href} className={item.recorded ? 'is-recorded' : ''}>
            <span>{item.label}</span>
            {item.recorded ? (
              <em>{t('dash.today.capture.recorded')}</em>
            ) : (
              <a href={item.href} target="_blank" rel="noreferrer">
                {t('dash.today.capture.open')}
              </a>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function goalStatusLabel(
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
  current: number,
  target: number,
  met: boolean,
): string {
  if (met) return t(goalStatusKeys.done)
  return t(goalStatusKeys.remaining, { count: target - current })
}

function HistoryTab({ state }: { state: StorageRoot }) {
  const t = translator(state.settings.locale)
  const keys = sortedDayKeys(state)
  return (
    <section>
      <h2>{t('dash.history.heading')}</h2>
      {keys.length === 0 ? (
        <p>{t('dash.history.empty')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('dash.history.date')}</th>
              <th>{t('dash.history.time')}</th>
              <th>{t('events.reaction')}</th>
              <th>{t('events.comment')}</th>
              <th>{t('events.connection_request')}</th>
              <th>{t('events.message')}</th>
              <th>{t('events.repost')}</th>
              <th>{t('events.post')}</th>
              <th>SSI</th>
              <th>{t('dash.history.profileViewers')}</th>
              <th>{t('dash.history.postImpressions')}</th>
              <th>{t('dash.history.followers')}</th>
              <th>{t('dash.history.searchAppearances')}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const s = summarizeStats(state.days[key].stats)
              return (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{s.activeMinutes}</td>
                  <td>{s.reactions}</td>
                  <td>{s.comments}</td>
                  <td>{s.connectionRequests}</td>
                  <td>{s.messages}</td>
                  <td>{s.reposts}</td>
                  <td>{s.posts}</td>
                  <td>{s.ssi ?? '-'}</td>
                  <td>{s.profileViewers ?? '-'}</td>
                  <td>{s.postImpressions ?? '-'}</td>
                  <td>{s.followers ?? '-'}</td>
                  <td>{s.searchAppearances ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function entryDayKey(timestamp: string | undefined): string {
  return timestamp ? dayKeyFromDate(new Date(timestamp)) : 'unknown'
}

function compactEntryList<T extends { timestamp: string }>(
  entries: T[],
  fingerprint: (entry: T) => string,
): T[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entryDayKey(entry.timestamp)}|${fingerprint(entry)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function ssiFingerprint(entry: SSIEntry): string {
  return [
    entry.total,
    entry.professionalBrand,
    entry.findRightPeople,
    entry.engageWithInsights,
    entry.buildRelationships,
  ].join('|')
}

function profileViewsFingerprint(entry: ProfileViewsEntry): string {
  return [entry.viewers, entry.rangeDays].join('|')
}

function linkedInDashboardFingerprint(entry: LinkedInDashboardEntry): string {
  return [
    entry.postImpressions,
    entry.postImpressionsRangeDays,
    entry.followers,
    entry.followersChangePercent,
    entry.profileViewers,
    entry.profileViewersRangeDays,
    entry.searchAppearances,
    entry.searchAppearancesPeriod,
    entry.searchAppearancesChangePercent,
    entry.weeklyPosts,
    entry.weeklyComments,
    entry.weeklyPeriod,
  ].join('|')
}

function SsiTab(props: {
  state: StorageRoot
}) {
  const t = translator(props.state.settings.locale)

  // All observations across all days, newest first. Pre-v2 days may carry only
  // the single stats.ssi snapshot.
  const entries = Object.values(props.state.days)
    .flatMap((d) => (d.ssiEntries?.length ? d.ssiEntries : d.stats.ssi ? [d.stats.ssi] : []))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Same for profile-views observations (pre-v3 days may lack the array).
  const viewEntries = Object.values(props.state.days)
    .flatMap((d) =>
      d.profileViewsEntries?.length
        ? d.profileViewsEntries
        : d.stats.profileViews
          ? [d.stats.profileViews]
          : [],
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const dashboardEntries = Object.values(props.state.days)
    .flatMap((d) =>
      d.linkedInDashboardEntries?.length
        ? d.linkedInDashboardEntries
        : d.stats.linkedInDashboard
          ? [d.stats.linkedInDashboard]
          : [],
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const latestSSI = entries[0]
  const latestViews = viewEntries[0]
  const latestDashboard = dashboardEntries[0]
  const visibleEntries = compactEntryList(entries, ssiFingerprint)
  const visibleViewEntries = compactEntryList(viewEntries, profileViewsFingerprint)
  const visibleDashboardEntries = compactEntryList(dashboardEntries, linkedInDashboardFingerprint)

  return (
    <section className="analytics-tab">
      <div className="section-heading">
        <div>
          <h2>{t('nav.ssi')}</h2>
          <p>{t('dash.ssi.disclaimer')}</p>
        </div>
      </div>

      <div className="analytics-summary">
        <MetricCard
          label={t('dash.ssi.total')}
          value={latestSSI?.total}
          meta={latestSSI?.timestamp ? formatLocalDateTime24(latestSSI.timestamp) : undefined}
        />
        <MetricCard
          label={t('dash.views.viewers')}
          value={latestViews?.viewers}
          meta={latestViews?.rangeDays ? `${latestViews.rangeDays}d` : undefined}
        />
        <MetricCard
          label={t('dash.linkedinDashboard.postImpressions')}
          value={latestDashboard?.postImpressions}
          meta={
            latestDashboard?.postImpressionsRangeDays
              ? `${latestDashboard.postImpressionsRangeDays}d`
              : undefined
          }
        />
        <MetricCard
          label={t('dash.linkedinDashboard.followers')}
          value={latestDashboard?.followers}
          meta={
            latestDashboard?.followersChangePercent !== undefined
              ? `${latestDashboard.followersChangePercent}%`
              : undefined
          }
        />
        <MetricCard
          label={t('dash.linkedinDashboard.searchAppearances')}
          value={latestDashboard?.searchAppearances}
          meta={latestDashboard?.searchAppearancesPeriod}
        />
        <MetricCard
          label={t('dash.linkedinDashboard.weeklyComments')}
          value={latestDashboard?.weeklyComments}
          meta={latestDashboard?.weeklyPeriod}
        />
      </div>

      <AutoRecordHeading
        title={t('dash.ssi.heading')}
        href="https://www.linkedin.com/sales/ssi"
        label="linkedin.com/sales/ssi"
        locale={props.state.settings.locale}
      />
      {visibleEntries.length === 0 ? (
        <p>{t('dash.ssi.noData')}</p>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{t('dash.ssi.date')}</th>
                <th>{t('dash.ssi.total')}</th>
                <th>{t('dash.ssi.professionalBrand')}</th>
                <th>{t('dash.ssi.findRightPeople')}</th>
                <th>{t('dash.ssi.engageWithInsights')}</th>
                <th>{t('dash.ssi.buildRelationships')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{e.timestamp ? formatLocalDateTime24(e.timestamp) : '-'}</td>
                  <td>{formatMetricValue(e.total)}</td>
                  <td>{formatMetricValue(e.professionalBrand)}</td>
                  <td>{formatMetricValue(e.findRightPeople)}</td>
                  <td>{formatMetricValue(e.engageWithInsights)}</td>
                  <td>{formatMetricValue(e.buildRelationships)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AutoRecordHeading
        title={t('dash.views.heading')}
        href="https://www.linkedin.com/analytics/profile-views/"
        label="linkedin.com/analytics/profile-views"
        locale={props.state.settings.locale}
      />
      {visibleViewEntries.length === 0 ? (
        <p>{t('dash.views.noData')}</p>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table compact">
            <thead>
              <tr>
                <th>{t('dash.ssi.date')}</th>
                <th>{t('dash.views.viewers')}</th>
                <th>{t('dash.views.rangeDays')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleViewEntries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{e.timestamp ? formatLocalDateTime24(e.timestamp) : '-'}</td>
                  <td>{formatMetricValue(e.viewers)}</td>
                  <td>{formatMetricValue(e.rangeDays)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AutoRecordHeading
        title={t('dash.linkedinDashboard.heading')}
        href="https://www.linkedin.com/dashboard/"
        label="linkedin.com/dashboard"
        locale={props.state.settings.locale}
      />
      {visibleDashboardEntries.length === 0 ? (
        <p>{t('dash.linkedinDashboard.noData')}</p>
      ) : (
        <div className="dashboard-snapshot-list">
          {visibleDashboardEntries.map((e, i) => (
            <LinkedInDashboardSnapshot
              key={`${e.timestamp}-${i}`}
              entry={e}
              locale={props.state.settings.locale}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function formatMetricValue(value: number | string | undefined): string {
  if (value === undefined || value === '') return '-'
  return typeof value === 'number' ? value.toLocaleString() : value
}

function AutoRecordHeading(props: {
  title: string
  href: string
  label: string
  locale: LocaleCode
}) {
  const before = props.locale === 'ru' ? 'Откройте ' : 'Open '
  const after =
    props.locale === 'ru'
      ? ', чтобы расширение записало данные'
      : ' so the extension can record it'
  return (
    <h3>
      {props.title}{' '}
      <span className="auto-record-hint">
        ({before}
        <a href={props.href} target="_blank" rel="noreferrer">
          {props.label}
        </a>
        {after})
      </span>
    </h3>
  )
}

function MetricCard(props: { label: string; value: number | string | undefined; meta?: string }) {
  return (
    <article className="metric analytics-card">
      <span>{props.label}</span>
      <strong>{formatMetricValue(props.value)}</strong>
      {props.meta && <em>{props.meta}</em>}
    </article>
  )
}

function LinkedInDashboardSnapshot({
  entry,
  locale,
}: {
  entry: LinkedInDashboardEntry
  locale: LocaleCode
}) {
  const t = translator(locale)

  return (
    <article className="dashboard-snapshot">
      <header>
        <span>{entry.timestamp ? formatLocalDateTime24(entry.timestamp) : '-'}</span>
      </header>
      <div className="dashboard-snapshot-grid">
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.postImpressions')}
          value={entry.postImpressions}
          meta={
            entry.postImpressionsRangeDays
              ? `${formatMetricValue(entry.postImpressionsRangeDays)}d`
              : undefined
          }
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.followers')}
          value={entry.followers}
          meta={
            entry.followersChangePercent !== undefined
              ? `${formatMetricValue(entry.followersChangePercent)}%`
              : undefined
          }
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.profileViewers')}
          value={entry.profileViewers}
          meta={
            entry.profileViewersRangeDays
              ? `${formatMetricValue(entry.profileViewersRangeDays)}d`
              : undefined
          }
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.searchAppearances')}
          value={entry.searchAppearances}
          meta={entry.searchAppearancesPeriod}
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.searchAppearancesChangePercent')}
          value={
            entry.searchAppearancesChangePercent !== undefined
              ? `${formatMetricValue(entry.searchAppearancesChangePercent)}%`
              : undefined
          }
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.weeklyPosts')}
          value={entry.weeklyPosts}
          meta={entry.weeklyPeriod}
        />
        <DashboardSnapshotMetric
          label={t('dash.linkedinDashboard.weeklyComments')}
          value={entry.weeklyComments}
          meta={entry.weeklyPeriod}
        />
      </div>
    </article>
  )
}

function DashboardSnapshotMetric(props: {
  label: string
  value: number | string | undefined
  meta?: string
}) {
  return (
    <div className="dashboard-snapshot-metric">
      <span>{props.label}</span>
      <strong>{formatMetricValue(props.value)}</strong>
      {props.meta && <em>{props.meta}</em>}
    </div>
  )
}

const goalFields = [
  { key: 'reactions', label: 'events.reaction' },
  { key: 'comments', label: 'events.comment' },
  { key: 'connectionRequests', label: 'events.connection_request' },
  { key: 'messages', label: 'events.message' },
  { key: 'reposts', label: 'events.repost' },
  { key: 'posts', label: 'events.post' },
] as const satisfies ReadonlyArray<{ key: keyof DailyGoals; label: MessageKey }>

const GOAL_MAX = 99

function GoalsTab(props: {
  state: StorageRoot
  onRun: (action: () => Promise<void>, success?: string) => Promise<void>
}) {
  const t = translator(props.state.settings.locale)
  const saved = props.state.settings.goals
  const [goals, setGoals] = useState<DailyGoals>(saved)

  useEffect(() => setGoals(props.state.settings.goals), [props.state.settings.goals])

  const todayKey = dayKeyFromDate(new Date())
  const todayStats = props.state.days[todayKey]?.stats ?? {
    dayKey: todayKey,
    activeSeconds: 0,
    counters: {},
  }
  const summary = summarizeStats(todayStats)

  const dirty = goalFields.some((field) => goals[field.key] !== saved[field.key])
  const total = goalFields.reduce((sum, field) => sum + goals[field.key], 0)

  function update(key: keyof DailyGoals, value: number): void {
    const next = Math.min(GOAL_MAX, Math.max(0, Math.floor(value) || 0))
    setGoals((current) => ({ ...current, [key]: next }))
  }

  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>{t('dash.goals.heading')}</h2>
          <p>{t('dash.goals.subtitle')}</p>
        </div>
      </div>

      <div className="goals-editor">
        {goalFields.map((field) => {
          const value = goals[field.key]
          const label = t(field.label)
          return (
            <div className={value === 0 ? 'goal-row is-off' : 'goal-row'} key={field.key}>
              <div className="goal-row-info">
                <strong>{label}</strong>
                <small>
                  {value === 0
                    ? t('dash.goals.offHint')
                    : t('dash.goals.todayCount', { count: summary[field.key] })}
                </small>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label={t('dash.goals.decrease', { label })}
                  disabled={value <= 0}
                  onClick={() => update(field.key, value - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={GOAL_MAX}
                  aria-label={label}
                  value={String(value)}
                  onChange={(e) => update(field.key, Number(e.target.value))}
                />
                <button
                  type="button"
                  aria-label={t('dash.goals.increase', { label })}
                  disabled={value >= GOAL_MAX}
                  onClick={() => update(field.key, value + 1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
        <div className="goals-total">
          <span>{t('dash.goals.total')}</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="goals-footer">
        <button
          type="button"
          className="primary"
          disabled={!dirty}
          onClick={() =>
            void props.onRun(() => sendMessage({ kind: 'setGoals', goals }), t('dash.goals.saved'))
          }
        >
          {t('common.save')}
        </button>
        {dirty && (
          <>
            <button type="button" onClick={() => setGoals(saved)}>
              {t('dash.goals.revert')}
            </button>
            <em className="goals-unsaved">{t('dash.goals.unsaved')}</em>
          </>
        )}
      </div>
    </section>
  )
}

function PrivacyTab(props: {
  state: StorageRoot
  onRun: (action: () => Promise<void>, success?: string) => Promise<void>
}) {
  const t = translator(props.state.settings.locale)
  const { settings } = props.state

  function patch(patch: SettingsPatch): Promise<void> {
    return sendMessage({ kind: 'updateSettings', patch })
  }

  return (
    <section>
      <h2>{t('dash.privacy.heading')}</h2>
      <div className="privacy-hero">
        <div>
          <h3>{t('dash.privacy.heroTitle')}</h3>
          <p>{t('dash.privacy.heroBody')}</p>
        </div>
        <a
          className="text-link"
          href="https://github.com/bystritskiy/LinkedInActivityTracker"
          target="_blank"
          rel="noreferrer"
        >
          {t('dash.privacy.sourceCode')}
        </a>
      </div>
      <div className="info-grid">
        <article>
          <h3>{t('dash.privacy.whatStored')}</h3>
          <p>{t('dash.privacy.whatStoredBody')}</p>
        </article>
        <article>
          <h3>{t('dash.privacy.whatNotStored')}</h3>
          <p>{t('dash.privacy.whatNotStoredBody')}</p>
        </article>
        <article>
          <h3>{t('dash.privacy.whereStored')}</h3>
          <p>{t('dash.privacy.whereStoredBody')}</p>
        </article>
        <article>
          <h3>{t('dash.privacy.openSource')}</h3>
          <p>
            {t('dash.privacy.openSourceBody')}{' '}
            <a
              className="text-link"
              href="https://github.com/bystritskiy/LinkedInActivityTracker"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </p>
        </article>
      </div>

      <h3>{t('dash.privacy.tracking')}</h3>
      <div className="toggle-grid">
        {manualTypes.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={settings.tracking[type]}
              onChange={(e) =>
                void props.onRun(() => patch({ tracking: { [type]: e.target.checked } }))
              }
            />
            {eventLabel(settings, type)}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={settings.tracking.activeTime}
            onChange={(e) =>
              void props.onRun(() => patch({ tracking: { activeTime: e.target.checked } }))
            }
          />
          {t('events.activeTime')}
        </label>
      </div>

      <h3>{t('dash.privacy.heading')}</h3>
      <div className="toggle-grid">
        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.privacy.storeCommentLength}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeCommentLength: e.target.checked } }),
              )
            }
          />
          <span>
            <strong>{t('dash.privacy.storeCommentLength')}</strong>
            <small>{t('dash.privacy.storeCommentLengthHint')}</small>
          </span>
        </label>
        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.privacy.storeCommentMeaningful}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeCommentMeaningful: e.target.checked } }),
              )
            }
          />
          <span>
            <strong>{t('dash.privacy.storeCommentMeaningful')}</strong>
            <small>{t('dash.privacy.storeCommentMeaningfulHint')}</small>
          </span>
        </label>
        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.privacy.storeConnectionProfileUrl}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeConnectionProfileUrl: e.target.checked } }),
              )
            }
          />
          <span>
            <strong>{t('dash.privacy.storeConnectionProfileUrl')}</strong>
            <small>{t('dash.privacy.storeConnectionProfileUrlHint')}</small>
          </span>
        </label>
        <label className="toggle-card">
          <input
            type="checkbox"
            checked={settings.privacy.storeConnectionDisplayName}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeConnectionDisplayName: e.target.checked } }),
              )
            }
          />
          <span>
            <strong>{t('dash.privacy.storeConnectionDisplayName')}</strong>
            <small>{t('dash.privacy.storeConnectionDisplayNameHint')}</small>
          </span>
        </label>
      </div>

      <div className="toolbar danger-zone">
        <button type="button" onClick={() => void props.onRun(() => exportAndDownload('json'))}>
          {t('dash.privacy.exportData')}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (window.confirm(t('dash.privacy.deleteAllConfirm'))) {
              void props.onRun(() => sendMessage({ kind: 'clearAllData' }), t('dash.privacy.deleted'))
            }
          }}
        >
          {t('dash.privacy.deleteAll')}
        </button>
      </div>
    </section>
  )
}

function DiagnosticsTab(props: {
  state: StorageRoot
  onRun: (action: () => Promise<void>, success?: string) => Promise<void>
}) {
  const { state } = props
  const t = translator(state.settings.locale)

  async function exportDiagnostics(): Promise<void> {
    const result = await sendMessage<ExportResult>({ kind: 'exportDiagnostics' })
    if (!result.ok || !result.filename || !result.mime || result.content === undefined) {
      throw new Error(result.error ?? 'export_failed')
    }
    downloadText(result.filename, result.mime, result.content)
  }

  return (
    <section>
      <h2>{t('dash.diag.heading')}</h2>
      <div className="toolbar">
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={state.settings.debug}
            onChange={(e) =>
              void props.onRun(() =>
                sendMessage({ kind: 'updateSettings', patch: { debug: e.target.checked } }),
              )
            }
          />
          Verbose console logging
        </label>
        <button type="button" onClick={() => void props.onRun(exportDiagnostics)}>
          {t('dash.diag.export')}
        </button>
        <button
          type="button"
          onClick={() => void props.onRun(() => sendMessage({ kind: 'clearDiagnostics' }))}
        >
          {t('dash.diag.clear')}
        </button>
      </div>
      <dl className="diagnostic-grid">
        <div>
          <dt>{t('dash.diag.version')}</dt>
          <dd>{state.lastSeenVersion}</dd>
        </div>
        <div>
          <dt>{t('dash.diag.timezone')}</dt>
          <dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd>
        </div>
      </dl>
      <h3>{t('dash.diag.selectorHealth')}</h3>
      <div className="info-grid">
        {Object.entries(state.selectorHealth).map(([key, health]) => (
          <article key={key}>
            <h3>{key}</h3>
            <p>{t(`status.${health.status}` as MessageKey)}</p>
            {health.note && <p>{health.note}</p>}
          </article>
        ))}
      </div>
      <h3>{t('dash.diag.log')}</h3>
      {state.diagnostics.length === 0 ? (
        <p>{t('dash.diag.empty')}</p>
      ) : (
        <table>
          <tbody>
            {state.diagnostics.map((entry) => (
              <tr key={entry.id}>
                <td>{formatLocalDateTime24(entry.timestamp)}</td>
                <td>{entry.level}</td>
                <td>{entry.source}</td>
                <td>{entry.code}</td>
                <td>{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

