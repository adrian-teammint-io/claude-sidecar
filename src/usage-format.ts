// Pure formatting for the toolbar usage tracker (no chrome APIs, so plain node can test it).

export type Limit = { utilization: number; resets_at: string | null } | null
export type Usage = { five_hour?: Limit; seven_day?: Limit; seven_day_opus?: Limit; seven_day_sonnet?: Limit }

// Last poll result, persisted in chrome.storage.local ('usageState') for the popup. `error` keeps the previous data.
export type UsageState = { usage?: Usage; at?: number; error?: string }

export const levelColor =(pct: number) => (pct >= 80 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#22c55e')

export function untilText(iso: string | null, now = Date.now()): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 48) return `${h}h ${mins % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

const LABELS: [keyof Usage, string][] = [
  ['five_hour', 'Session (5h)'],
  ['seven_day', 'Weekly'],
  ['seven_day_opus', 'Weekly Opus'],
  ['seven_day_sonnet', 'Weekly Sonnet'],
]

export function usageTitle(u: Usage, now = Date.now()): string {
  const lines = LABELS.filter(([k]) => u[k]).map(([k, label]) => {
    const l = u[k]!
    const reset = untilText(l.resets_at, now)
    return `${label}: ${Math.round(l.utilization)}%${reset ? ` · resets in ${reset}` : ''}`
  })
  const at = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return [`Claude usage (updated ${at})`, ...lines].join('\n')
}

// Activity = percentage points of the 5-hour limit consumed, bucketed per local hour ("YYYY-MM-DDTHH").
// Derived from successive polls: a drop in utilization means the window reset, so the new value is all fresh usage.
// ponytail: only sees usage at poll resolution; usage that starts and resets between two polls is missed.
export type Activity = Record<string, number>
const pad = (n: number) => String(n).padStart(2, '0')
export const hourKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`
export const dayKey = (d: Date) => hourKey(d).slice(0, 10)

export function addActivity(act: Activity, prev: number | undefined, cur: number, now: Date, keepDays = 35): Activity {
  const delta = prev === undefined ? 0 : cur >= prev ? cur - prev : cur
  const next: Activity = {}
  const cutoff = hourKey(new Date(now.getTime() - keepDays * 86400000))
  for (const [k, v] of Object.entries(act)) if (k >= cutoff) next[k] = v
  if (delta > 0) next[hourKey(now)] = Math.round(((next[hourKey(now)] ?? 0) + delta) * 10) / 10
  return next
}

export const badgePct = (u: Usage, which: 'session' | 'weekly' | 'off') =>
  which === 'off' ? undefined : (which === 'weekly' ? u.seven_day : u.five_hour)?.utilization
export const badgeText = (u: Usage, which: 'session' | 'weekly' | 'off' = 'session') => {
  const p = badgePct(u, which)
  return p === undefined ? '' : `${Math.round(p)}%`
}

export const ALERT_AT = [80, 95]
// Highest threshold crossed upward between two polls (undefined = no new crossing, or no baseline yet).
export function crossed(prev: number | undefined, cur: number, at = ALERT_AT): number | undefined {
  if (prev === undefined) return undefined
  return at.filter(t => prev < t && cur >= t).at(-1)
}
// A drop after being near the cap means the window reset: worth telling the user they can continue.
export const resetAfterMax = (prev: number | undefined, cur: number) => prev !== undefined && prev >= ALERT_AT[0] && cur < prev
