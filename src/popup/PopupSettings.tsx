import { useEffect, useState } from 'react'
import { call, type Status } from '../api'
import type { Badge, Settings } from '../themes'
import { ALERT_AT } from '../usage-format'
import { Segmented, Switch, ThemePicker } from '../shared/controls'

const BADGES: readonly (readonly [Badge, string])[] = [['session', '5-hour'], ['weekly', 'Weekly'], ['off', 'Off']]
const INTERVALS = [1, 5, 15, 30].map(m => [m, `${m} min`] as const)

export function PopupSettings({ settings, dark, onChange }: { settings: Settings; dark: boolean; onChange: (s: Partial<Settings>) => void }) {
  const [status, setStatus] = useState<Status>()
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => { call<Status>({ type: 'status' }).then(setStatus, () => setStatus({ state: 'none' })) }, [])

  async function clearHistory() {
    if (!confirmClear) return setConfirmClear(true)
    await chrome.storage.local.remove(['activity', 'lastSession', 'lastWeekly'])
    setConfirmClear(false)
  }

  return (
    <div className="p-settings">
      <section>
        <h2 className="eyebrow">Appearance</h2>
        <ThemePicker settings={settings} dark={dark} onChange={onChange} />
      </section>

      <section>
        <h2 className="eyebrow">Toolbar badge</h2>
        <Segmented label="Toolbar badge" value={settings.badge} options={BADGES} onChange={badge => onChange({ badge })} />
      </section>

      <section>
        <h2 className="eyebrow">Refresh every</h2>
        <Segmented label="Refresh interval" value={settings.usageMinutes} options={INTERVALS} onChange={usageMinutes => onChange({ usageMinutes })} />
      </section>

      <section className="setting-row">
        <div>
          <strong>Limit alerts</strong>
          <span className="muted">Notify at {ALERT_AT.join('% and ')}%, and when a maxed-out session resets</span>
        </div>
        <Switch label="Limit alerts" checked={settings.alerts} onChange={alerts => onChange({ alerts })} />
      </section>

      <section className="setting-row">
        <div>
          <strong>Prompt folder</strong>
          <span className="muted">{!status ? '…' : status.state === 'granted' ? status.name : status.state === 'none' ? 'Not connected' : `${status.name} · access paused`}</span>
        </div>
        <button className="btn ghost" onClick={() => chrome.runtime.openOptionsPage()}>{status?.state === 'granted' ? 'Change' : 'Connect'}</button>
      </section>

      <section className="setting-row">
        <div>
          <strong>Activity history</strong>
          <span className="muted">Stored locally, last 35 days</span>
        </div>
        <button className={`btn ${confirmClear ? 'danger' : 'ghost'}`} onClick={clearHistory} onBlur={() => setConfirmClear(false)}>
          {confirmClear ? 'Confirm' : 'Clear'}
        </button>
      </section>

      <nav className="p-links">
        <a href="https://claude.ai/new" target="_blank" rel="noreferrer">New chat</a>
        <a href="https://claude.ai/settings/usage" target="_blank" rel="noreferrer">Usage page</a>
        <span className="muted">v{chrome.runtime.getManifest().version}</span>
      </nav>
    </div>
  )
}
