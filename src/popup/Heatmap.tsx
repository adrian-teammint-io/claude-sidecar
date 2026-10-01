import { useState } from 'react'
import { dayKey, type Activity } from '../usage-format'

type Cell = { key: string; value: number; label: string; now?: boolean; future?: boolean }
const DAY = 86400000
const HOURS = Array.from({ length: 24 }, (_, h) => h)

// Week: 7 rows (oldest → today) × 24 hours. Month: GitHub-style, 7 weekday rows × 5 week columns of daily totals.
function weekGrid(act: Activity, now: Date): { label: string; cells: Cell[] }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * DAY)
    const dk = dayKey(d)
    const label = d.toLocaleDateString([], { weekday: 'short' })
    return {
      label,
      cells: HOURS.map(h => {
        const key = `${dk}T${String(h).padStart(2, '0')}`
        const isNow = i === 6 && h === now.getHours()
        return { key, value: act[key] ?? 0, label: `${label} ${String(h).padStart(2, '0')}:00`, now: isNow, future: i === 6 && h > now.getHours() }
      }),
    }
  })
}

function monthGrid(act: Activity, now: Date): { label: string; cells: Cell[] }[] {
  const daily: Record<string, number> = {}
  for (const [k, v] of Object.entries(act)) daily[k.slice(0, 10)] = (daily[k.slice(0, 10)] ?? 0) + v
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const start = new Date(monday.getTime() - 4 * 7 * DAY)
  return Array.from({ length: 7 }, (_, wd) => {
    const first = new Date(start.getTime() + wd * DAY)
    return {
      label: first.toLocaleDateString([], { weekday: 'short' }),
      cells: Array.from({ length: 5 }, (_, w) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + wd)
        const key = dayKey(d)
        return { key, value: daily[key] ?? 0, label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), now: key === dayKey(now), future: d > now }
      }),
    }
  })
}

export function Heatmap({ activity, now }: { activity: Activity; now: number }) {
  const [range, setRange] = useState<'week' | 'month'>('week')
  const date = new Date(now)
  const rows = range === 'week' ? weekGrid(activity, date) : monthGrid(activity, date)
  const max = Math.max(1, ...rows.flatMap(r => r.cells.map(c => c.value)))
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)))
  const cols = rows[0].cells.length

  return (
    <section className="activity">
      <header>
        <h2>Activity</h2>
        <div className="segmented" role="radiogroup" aria-label="Activity range">
          {(['week', 'month'] as const).map(r => (
            <button key={r} role="radio" aria-checked={range === r} onClick={() => setRange(r)}>{r === 'week' ? 'Week' : 'Month'}</button>
          ))}
        </div>
      </header>
      <div className={`heat ${range}`} style={{ '--cols': cols } as React.CSSProperties}>
        <span />
        {range === 'week'
          ? HOURS.map(h => <span key={h} className="heat-axis">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)
          : rows[0].cells.map(c => <span key={c.key} className="heat-axis">{new Date(`${c.key}T00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>)}
        {rows.map(r => [
          <span key={`l${r.label}`} className="heat-axis heat-day">{r.label}</span>,
          ...r.cells.map(c => (
            <span key={c.key} className="heat-cell" data-level={level(c.value)} data-now={c.now} data-future={c.future}
              title={c.future ? undefined : `${c.label} · ${c.value ? `${Math.round(c.value * 10) / 10}% of 5h limit` : 'no usage'}`} />
          )),
        ])}
      </div>
      <div className="heat-legend muted">
        <span>Tracked while Chrome is open</span>
        <span className="legend-scale">Less{[0, 1, 2, 3, 4].map(l => <span key={l} className="heat-cell" data-level={l} />)}More</span>
      </div>
    </section>
  )
}
