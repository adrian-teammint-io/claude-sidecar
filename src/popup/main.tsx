import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './popup.css'
import { call } from '../api'
import { DEFAULTS, vars, type Settings } from '../themes'
import type { Activity, UsageState } from '../usage-format'
import { RingCard, BreakdownCard, Skeleton } from './cards'
import { Heatmap } from './Heatmap'
import { PopupSettings } from './PopupSettings'

// Toolbar popup: renders what the worker stored (usageState, activity), asks for a fresh poll on open,
// and re-renders whenever storage changes.
function Popup() {
  const [state, setState] = useState<UsageState>({})
  const [activity, setActivity] = useState<Activity>({})
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [view, setView] = useState<'usage' | 'settings'>('usage')

  async function refresh() {
    setLoading(true)
    try { await call({ type: 'refreshUsage' }) } finally { setLoading(false) }
  }

  useEffect(() => {
    chrome.storage.local.get(['usageState', 'activity', 'settings']).then(r => {
      if (r.usageState) setState(r.usageState as UsageState)
      if (r.activity) setActivity(r.activity as Activity)
      if (r.settings) setSettings({ ...DEFAULTS, ...(r.settings as Settings) })
    })
    const onChange = (c: Record<string, chrome.storage.StorageChange>) => {
      if (c.usageState) setState(c.usageState.newValue as UsageState)
      if (c.activity) setActivity(c.activity.newValue as Activity)
    }
    chrome.storage.onChanged.addListener(onChange)
    refresh()
    const tick = setInterval(() => setNow(Date.now()), 30_000) // keeps "resets in" / "updated" fresh
    return () => { chrome.storage.onChanged.removeListener(onChange); clearInterval(tick) }
  }, [])

  const dark = settings.mode === 'dark' || (settings.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const theme = vars(settings.theme, dark)
  useEffect(() => { document.documentElement.style.background = theme['--bg'] }, [theme['--bg']])

  function updateSettings(s: Partial<Settings>) {
    const next = { ...settings, ...s }
    setSettings(next)
    chrome.storage.local.set({ settings: next }) // worker reschedules / repaints; drawer follows theme live
  }

  const u = state.usage
  return (
    <main className={`root ${dark ? 'dark' : 'light'} popup`} style={theme as React.CSSProperties}
      onKeyDown={e => { if (e.key === 'Escape' && view === 'settings') { e.preventDefault(); setView('usage') } }}>
      <header className="p-head">
        {view === 'settings' && <IconBtn icon="M15 18l-6-6 6-6" label="Back" onClick={() => setView('usage')} />}
        <h1>{view === 'settings' ? 'Settings' : 'Claude usage'}</h1>
        {view === 'usage' && <>
          <span className="muted p-updated">{state.at ? `Updated ${ago(state.at, now)}` : loading ? 'Loading…' : ''}</span>
          <IconBtn icon="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" label="Refresh" onClick={refresh} disabled={loading} spin={loading} />
          <IconBtn icon={GEAR} label="Settings" onClick={() => setView('settings')} />
        </>}
      </header>

      {view === 'settings' ? <PopupSettings settings={settings} dark={dark} onChange={updateSettings} /> : <>
      {state.error && (
        <div className="p-error" role="alert">
          <span>{u ? 'Showing last known numbers. ' : ''}{state.error}</span>
          <button className="btn ghost" onClick={() => chrome.tabs.create({ url: 'https://claude.ai' })}>Open claude.ai</button>
        </div>
      )}

      <section className="p-cards">
        {u?.five_hour ? <RingCard kind="session" limit={u.five_hour} now={now} /> : <Skeleton />}
        {u?.seven_day ? <RingCard kind="weekly" limit={u.seven_day} now={now} /> : <Skeleton />}
      </section>
      {u && <BreakdownCard usage={u} />}

      <Heatmap activity={activity} now={now} />

      <footer className="p-foot muted">Refreshes every {settings.usageMinutes} min{settings.alerts ? ' · alerts on' : ''}</footer>
      </>}
    </main>
  )
}

const GEAR = 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'

function IconBtn({ icon, label, onClick, disabled, spin }: { icon: string; label: string; onClick: () => void; disabled?: boolean; spin?: boolean }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} onClick={onClick} disabled={disabled} data-spin={spin}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
    </button>
  )
}

function ago(t: number, now: number) {
  const m = Math.round((now - t) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

createRoot(document.getElementById('app')!).render(<Popup />)
