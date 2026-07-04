import { useEffect, useMemo, useState } from 'react'
import { dayKeyFromDate } from '../common/date'
import { eventLabelKey, translator } from '../common/i18n'
import type { MessageKey } from '../common/i18n'
import type { ExportResult, SettingsPatch } from '../common/messages'
import { goalRows, summarizeStats } from '../common/summary'
import type {
  DailyGoals,
  LinkedInDashboardEntry,
  LocaleCode,
  Settings,
  StorageRoot,
  TrackedEvent,
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

const tabs: Array<{ key: Tab; label: MessageKey }> = [
  { key: 'today', label: 'nav.today' },
  { key: 'history', label: 'nav.history' },
  { key: 'ssi', label: 'nav.ssi' },
  { key: 'goals', label: 'nav.goals' },
  { key: 'privacy', label: 'nav.privacy' },
  { key: 'diagnostics', label: 'nav.diagnostics' },
]

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

function sortedEvents(events: TrackedEvent[]): TrackedEvent[] {
  return [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
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
        <div>
          <h1>{t('dash.title')}</h1>
          <p>{todayKey}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            void run(() => sendMessage({ kind: 'setPaused', paused: !state.settings.paused }))
          }
        >
          {state.settings.paused ? t('popup.resume') : t('popup.pause')}
        </button>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        {tabs.map((item) => (
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

      {tab === 'today' && (
        <TodayTab
          state={state}
          dayKey={todayKey}
          summary={todaySummary}
          events={today?.events ?? []}
          onRun={run}
        />
      )}
      {tab === 'history' && <HistoryTab state={state} />}
      {tab === 'ssi' && <SsiTab state={state} />}
      {tab === 'goals' && <GoalsTab state={state} onRun={run} />}
      {tab === 'privacy' && <PrivacyTab state={state} onRun={run} />}
      {tab === 'diagnostics' && <DiagnosticsTab state={state} onRun={run} />}
    </main>
  )
}

function TodayTab(props: {
  state: StorageRoot
  dayKey: string
  summary: ReturnType<typeof summarizeStats>
  events: TrackedEvent[]
  onRun: (action: () => Promise<void>, success?: string) => Promise<void>
}) {
  const t = translator(props.state.settings.locale)
  const rows = goalRows(props.summary, props.state.settings.goals)

  return (
    <section>
      <h2>{t('dash.today.heading')}</h2>
      <div className="goal-grid">
        <article className="metric">
          <span>{t('events.activeTime')}</span>
          <strong>
            {props.summary.activeMinutes} {t('common.minutes')}
          </strong>
        </article>
        {rows.map((row) => (
          <article className="metric" key={row.key}>
            <span>{t(eventLabelKey(row.key))}</span>
            <strong>
              {row.current} / {row.target}
            </strong>
            <div className="bar">
              <span style={{ width: `${Math.round(row.ratio * 100)}%` }} />
            </div>
          </article>
        ))}
      </div>

      <h3>{t('dash.today.events')}</h3>
      {props.events.length === 0 ? (
        <p>{t('dash.today.noEvents')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('dash.today.eventTime')}</th>
              <th>{t('dash.today.eventType')}</th>
              <th>{t('dash.today.eventSource')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedEvents(props.events).map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                <td>{eventLabel(props.state.settings, event.type)}</td>
                <td>{t(event.source === 'manual' ? 'dash.source.manual' : 'dash.source.automatic')}</td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      void props.onRun(() =>
                        sendMessage({
                          kind: 'deleteEvent',
                          dayKey: props.dayKey,
                          eventId: event.id,
                        }),
                      )
                    }
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
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
          meta={latestSSI?.timestamp ? new Date(latestSSI.timestamp).toLocaleString() : undefined}
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
      {entries.length === 0 ? (
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
                <th>{t('dash.ssi.source')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
                  <td>{formatMetricValue(e.total)}</td>
                  <td>{formatMetricValue(e.professionalBrand)}</td>
                  <td>{formatMetricValue(e.findRightPeople)}</td>
                  <td>{formatMetricValue(e.engageWithInsights)}</td>
                  <td>{formatMetricValue(e.buildRelationships)}</td>
                  <td>{e.source ? t(`dash.source.${e.source}`) : '-'}</td>
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
      {viewEntries.length === 0 ? (
        <p>{t('dash.views.noData')}</p>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table compact">
            <thead>
              <tr>
                <th>{t('dash.ssi.date')}</th>
                <th>{t('dash.views.viewers')}</th>
                <th>{t('dash.views.rangeDays')}</th>
                <th>{t('dash.ssi.source')}</th>
              </tr>
            </thead>
            <tbody>
              {viewEntries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
                  <td>{formatMetricValue(e.viewers)}</td>
                  <td>{formatMetricValue(e.rangeDays)}</td>
                  <td>{e.source ? t(`dash.source.${e.source}`) : '-'}</td>
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
      {dashboardEntries.length === 0 ? (
        <p>{t('dash.linkedinDashboard.noData')}</p>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table wide">
            <thead>
              <tr>
                <th>{t('dash.ssi.date')}</th>
                <th>{t('dash.linkedinDashboard.postImpressions')}</th>
                <th>{t('dash.linkedinDashboard.postImpressionsRangeDays')}</th>
                <th>{t('dash.linkedinDashboard.followers')}</th>
                <th>{t('dash.linkedinDashboard.followersChangePercent')}</th>
                <th>{t('dash.linkedinDashboard.profileViewers')}</th>
                <th>{t('dash.linkedinDashboard.profileViewersRangeDays')}</th>
                <th>{t('dash.linkedinDashboard.searchAppearances')}</th>
                <th>{t('dash.linkedinDashboard.searchAppearancesPeriod')}</th>
                <th>{t('dash.linkedinDashboard.searchAppearancesChangePercent')}</th>
                <th>{t('dash.linkedinDashboard.weeklyPosts')}</th>
                <th>{t('dash.linkedinDashboard.weeklyComments')}</th>
                <th>{t('dash.linkedinDashboard.weeklyPeriod')}</th>
                <th>{t('dash.ssi.source')}</th>
              </tr>
            </thead>
            <tbody>
              {dashboardEntries.map((e, i) => (
                <LinkedInDashboardRow
                  key={`${e.timestamp}-${i}`}
                  entry={e}
                  sourceLabel={e.source ? t(`dash.source.${e.source}`) : '-'}
                />
              ))}
            </tbody>
          </table>
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

function LinkedInDashboardRow({
  entry,
  sourceLabel,
}: {
  entry: LinkedInDashboardEntry
  sourceLabel: string
}) {
  return (
    <tr>
      <td>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}</td>
      <td>{formatMetricValue(entry.postImpressions)}</td>
      <td>{formatMetricValue(entry.postImpressionsRangeDays)}</td>
      <td>{formatMetricValue(entry.followers)}</td>
      <td>{formatMetricValue(entry.followersChangePercent)}</td>
      <td>{formatMetricValue(entry.profileViewers)}</td>
      <td>{formatMetricValue(entry.profileViewersRangeDays)}</td>
      <td>{formatMetricValue(entry.searchAppearances)}</td>
      <td>{formatMetricValue(entry.searchAppearancesPeriod)}</td>
      <td>{formatMetricValue(entry.searchAppearancesChangePercent)}</td>
      <td>{formatMetricValue(entry.weeklyPosts)}</td>
      <td>{formatMetricValue(entry.weeklyComments)}</td>
      <td>{formatMetricValue(entry.weeklyPeriod)}</td>
      <td>{sourceLabel}</td>
    </tr>
  )
}

function GoalsTab(props: {
  state: StorageRoot
  onRun: (action: () => Promise<void>, success?: string) => Promise<void>
}) {
  const t = translator(props.state.settings.locale)
  const [goals, setGoals] = useState<DailyGoals>(props.state.settings.goals)

  useEffect(() => setGoals(props.state.settings.goals), [props.state.settings.goals])

  function update<K extends keyof DailyGoals>(key: K, value: string): void {
    setGoals((current) => ({ ...current, [key]: Number(value) }))
  }

  return (
    <section>
      <h2>{t('dash.goals.heading')}</h2>
      <div className="form-grid">
        <NumberField
          label={t('events.reaction')}
          value={String(goals.reactions)}
          onChange={(v) => update('reactions', v)}
        />
        <NumberField
          label={t('events.comment')}
          value={String(goals.comments)}
          onChange={(v) => update('comments', v)}
        />
        <NumberField
          label={t('events.connection_request')}
          value={String(goals.connectionRequests)}
          onChange={(v) => update('connectionRequests', v)}
        />
        <NumberField
          label={t('events.message')}
          value={String(goals.messages)}
          onChange={(v) => update('messages', v)}
        />
        <NumberField
          label={t('events.repost')}
          value={String(goals.reposts)}
          onChange={(v) => update('reposts', v)}
        />
        <NumberField
          label={t('events.post')}
          value={String(goals.posts)}
          onChange={(v) => update('posts', v)}
        />
      </div>
      <button
        type="button"
        onClick={() => void props.onRun(() => sendMessage({ kind: 'setGoals', goals }), t('dash.goals.saved'))}
      >
        {t('common.save')}
      </button>
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
        <label>
          <input
            type="checkbox"
            checked={settings.privacy.storeCommentLength}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeCommentLength: e.target.checked } }),
              )
            }
          />
          {t('dash.privacy.storeCommentLength')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.privacy.storeCommentMeaningful}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeCommentMeaningful: e.target.checked } }),
              )
            }
          />
          {t('dash.privacy.storeCommentMeaningful')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.privacy.storeConnectionProfileUrl}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeConnectionProfileUrl: e.target.checked } }),
              )
            }
          />
          {t('dash.privacy.storeConnectionProfileUrl')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.privacy.storeConnectionDisplayName}
            onChange={(e) =>
              void props.onRun(() =>
                patch({ privacy: { storeConnectionDisplayName: e.target.checked } }),
              )
            }
          />
          {t('dash.privacy.storeConnectionDisplayName')}
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
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
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

function NumberField(props: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {props.label}
      <input
        type="number"
        min="0"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  )
}
