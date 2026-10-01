import { levelColor, type Limit, type Usage } from '../usage-format'

const R = 56
const C = 2 * Math.PI * R

const weekdayTime = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// One ring gauge card. `kind` only changes the label and how the reset time reads.
export function RingCard({ kind, limit }: { kind: 'session' | 'weekly'; limit: NonNullable<Limit> }) {
  const pct = Math.min(100, Math.max(0, limit.utilization))
  const reset = !limit.resets_at ? 'Not started'
    : kind === 'session' ? `Resets at ${clockTime(limit.resets_at)}` : `Resets ${weekdayTime(limit.resets_at)}`
  return (
    <article className="card ring-card" style={{ '--level': levelColor(pct) } as React.CSSProperties}>
      <div className="ring">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r={R} className="ring-track" />
          {/* starts at 12 o'clock; a tiny minimum keeps the cap visible at 0% like a dial */}
          <circle cx="70" cy="70" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(pct, 1.5) / 100)} />
        </svg>
        <div className="ring-value" aria-label={`${Math.round(pct)} percent used`}>
          <strong>{Math.round(pct)}</strong><span>%</span>
        </div>
      </div>
      <p className="eyebrow">{kind === 'session' ? '5-hour limit' : 'Weekly limit'}</p>
      <p className="ring-reset">{reset}</p>
    </article>
  )
}

const MODELS: [keyof Usage, string][] = [['seven_day_opus', 'Opus'], ['seven_day_sonnet', 'Sonnet']]

// Per-model weekly limits; only rendered when claude.ai reports at least one.
export function BreakdownCard({ usage }: { usage: Usage }) {
  const rows = MODELS.filter(([k]) => usage[k])
  if (!rows.length) return null
  return (
    <article className="card breakdown-card">
      <p className="eyebrow">Weekly by model</p>
      {rows.map(([k, label]) => {
        const pct = Math.min(100, usage[k]!.utilization)
        return (
          <div className="bar-row" key={k}>
            <div className="bar-label">
              <span>{label}{pct === 0 && <em> · not used yet</em>}</span>
              <span className="num">{Math.round(pct)}%</span>
            </div>
            <div className="bar" role="progressbar" aria-label={`${label} weekly usage`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${pct}%`, background: levelColor(pct) }} />
            </div>
          </div>
        )
      })}
    </article>
  )
}

export const Skeleton = () => <article className="card skeleton" aria-busy="true" />
