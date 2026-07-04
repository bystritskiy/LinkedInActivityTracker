import { useEffect, useMemo, useState } from 'react'
import { dayKeyFromDate } from '../common/date'
import { eventLabelKey, translator } from '../common/i18n'
import { goalRows, summarizeStats } from '../common/summary'
import type { StorageRoot } from '../common/types'
import { exportAndDownload, loadState, openDashboard, sendMessage, subscribeState } from '../ui/chrome'

export function Popup() {
  const [state, setState] = useState<StorageRoot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const todayKey = dayKeyFromDate(new Date())

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

  const vm = useMemo(() => {
    if (!state) return null
    const day = state.days[todayKey]
    const stats = day?.stats ?? { dayKey: todayKey, activeSeconds: 0, counters: {} }
    const summary = summarizeStats(stats)
    return {
      t: translator(state.settings.locale),
      summary,
      goals: state.settings.goals,
      rows: goalRows(summary, state.settings.goals),
      paused: state.settings.paused,
    }
  }, [state, todayKey])

  async function togglePaused(): Promise<void> {
    if (!state) return
    await sendMessage({ kind: 'setPaused', paused: !state.settings.paused })
    setState(await loadState())
  }

  async function exportToday(): Promise<void> {
    try {
      await exportAndDownload('markdown', todayKey)
    } catch (err) {
      setError(String((err as Error)?.message ?? err))
    }
  }

  if (error) {
    return (
      <div className="lat-popup">
        <strong>LinkedIn Activity Tracker</strong>
        <p className="error">{error}</p>
      </div>
    )
  }

  if (!vm) {
    return (
      <div className="lat-popup">
        <strong>LinkedIn Activity Tracker</strong>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="lat-popup">
      <header>
        <div>
          <p className="eyebrow">{vm.t('popup.title')}</p>
          <h1>LinkedIn Activity Tracker</h1>
        </div>
        {vm.paused && <span className="badge">{vm.t('popup.paused')}</span>}
      </header>

      <section className="progress-list">
        {vm.rows.map((row) => (
          <div className="progress-row" key={row.key}>
            <div className="progress-label">
              <span>{row.key === 'activeTime' ? vm.t('events.activeTime') : vm.t(eventLabelKey(row.key))}</span>
              <strong>
                {row.current} / {row.target}
              </strong>
            </div>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${Math.round(row.ratio * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <div className="quick-stats">
        <span>SSI</span>
        <strong>{vm.summary.ssi ?? '-'}</strong>
      </div>

      <div className="quick-stats">
        <span>{vm.t('dash.views.heading')}</span>
        <strong>{vm.summary.profileViewers ?? '-'}</strong>
      </div>

      <footer>
        <button type="button" onClick={openDashboard}>
          {vm.t('popup.openDashboard')}
        </button>
        <button type="button" onClick={() => void exportToday()}>
          {vm.t('popup.exportReport')}
        </button>
        <button type="button" className="secondary" onClick={() => void togglePaused()}>
          {vm.paused ? vm.t('popup.resume') : vm.t('popup.pause')}
        </button>
      </footer>
    </div>
  )
}
