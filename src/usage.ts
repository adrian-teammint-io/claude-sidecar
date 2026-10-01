// Toolbar usage tracker: polls claude.ai's internal usage endpoint and paints it on the extension icon.
// ponytail: undocumented endpoint (/api/organizations/{org}/usage); if claude.ai changes it, only fetchUsage needs updating.
import { usageTitle, badgeText, badgePct, levelColor, levelInk, untilText, addActivity, crossed, resetAfterMax, type Usage, type Activity, type UsageState } from './usage-format'
import { DEFAULTS, type Settings } from './themes'

const BASE = 'https://claude.ai'

async function getJson(path: string) {
  const r = await fetch(BASE + path, { credentials: 'include', headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

// Fallback: if the worker's request is rejected (e.g. bot protection), let an open claude.ai tab fetch same-origin.
async function viaTab(path: string) {
  const [tab] = await chrome.tabs.query({ url: `${BASE}/*` })
  if (!tab?.id) throw new Error('Open claude.ai and sign in')
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'fetchJson', path })
  if (!res?.ok) throw new Error(res?.error ?? 'Tab fetch failed')
  return res.data
}

const get = (path: string) => getJson(path).catch(() => viaTab(path))

async function fetchUsage(): Promise<Usage> {
  let { orgId } = await chrome.storage.local.get('orgId')
  if (!orgId) {
    const orgs: { uuid: string; capabilities?: string[] }[] = await get('/api/organizations')
    orgId = (orgs.find(o => o.capabilities?.includes('chat')) ?? orgs[0])?.uuid
    if (!orgId) throw new Error('No Claude organization found')
    await chrome.storage.local.set({ orgId })
  }
  try {
    return await get(`/api/organizations/${orgId}/usage`)
  } catch (e) {
    await chrome.storage.local.remove('orgId') // maybe switched accounts; rediscover next time
    throw e
  }
}

function drawRings(size: number, session: number, weekly: number) {
  const canvas = new OffscreenCanvas(size, size)
  const c = canvas.getContext('2d')!
  const mid = size / 2
  const ring = (r: number, w: number, pct: number, color: string) => {
    c.lineWidth = w
    c.strokeStyle = 'rgba(128,128,128,0.35)'
    c.beginPath(); c.arc(mid, mid, r, 0, Math.PI * 2); c.stroke()
    c.strokeStyle = color
    c.lineCap = 'round'
    c.beginPath(); c.arc(mid, mid, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(pct, 100)) / 100); c.stroke()
  }
  ring(size * 0.4, size * 0.16, session, levelColor(session)) // outer: 5-hour session
  ring(size * 0.18, size * 0.14, weekly, levelColor(weekly)) // inner: weekly
  return { canvas, c }
}

const getSettings = async (): Promise<Settings> => ({ ...DEFAULTS, ...((await chrome.storage.local.get('settings')).settings as Partial<Settings>) })

// Icon + badge + tooltip from a usage snapshot. Also re-run when badge settings change (no refetch needed).
async function paint(u: Usage, settings: Settings) {
  const s = u.five_hour?.utilization ?? 0
  const w = u.seven_day?.utilization ?? 0
  const pct = badgePct(u, settings.badge) ?? 0
  const imageData = Object.fromEntries([16, 32].map(size => { const { c } = drawRings(size, s, w); return [size, c.getImageData(0, 0, size, size)] }))
  await Promise.all([
    chrome.action.setIcon({ imageData }),
    chrome.action.setBadgeText({ text: badgeText(u, settings.badge) }),
    chrome.action.setBadgeBackgroundColor({ color: levelColor(pct) }),
    chrome.action.setBadgeTextColor({ color: levelInk(pct) }),
    chrome.action.setTitle({ title: usageTitle(u) }),
  ])
}

async function notify(id: string, title: string, message: string, u: Usage) {
  // Notifications need an image URL; render the current rings at 128px into a data URL.
  const { canvas } = drawRings(128, u.five_hour?.utilization ?? 0, u.seven_day?.utilization ?? 0)
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  await chrome.notifications.create(id, { type: 'basic', iconUrl: `data:image/png;base64,${btoa(bin)}`, title, message, priority: 1 })
}

async function alert(u: Usage, prevSession?: number, prevWeekly?: number) {
  const s = u.five_hour?.utilization ?? 0
  const w = u.seven_day?.utilization ?? 0
  const reset = untilText(u.five_hour?.resets_at ?? null)
  const hitS = crossed(prevSession, s)
  const hitW = crossed(prevWeekly, w)
  if (hitS) await notify('session', `Claude session at ${Math.round(s)}%`, `5-hour limit${reset ? ` resets in ${reset}` : ''}.`, u)
  if (hitW) await notify('weekly', `Claude weekly usage at ${Math.round(w)}%`, 'Weekly limit is getting close.', u)
  if (resetAfterMax(prevSession, s)) await notify('reset', 'Claude session reset', 'Your 5-hour limit is available again.', u)
}

let inflight: Promise<void> | undefined
// Alarm, popup open and popup refresh can overlap; share one request so activity isn't double-counted.
export const refreshUsage = () => (inflight ??= doRefresh().finally(() => { inflight = undefined }))

async function doRefresh() {
  try {
    const u = await fetchUsage()
    const s = u.five_hour?.utilization ?? 0
    const w = u.seven_day?.utilization ?? 0
    const [settings, prev] = await Promise.all([getSettings(), chrome.storage.local.get(['activity', 'lastSession', 'lastWeekly'])])
    const [lastSession, lastWeekly] = [prev.lastSession, prev.lastWeekly] as (number | undefined)[]
    await Promise.all([
      // Popup reads these from chrome.storage.local and re-renders on change.
      chrome.storage.local.set({
        usageState: { usage: u, at: Date.now() } satisfies UsageState,
        activity: addActivity((prev.activity ?? {}) as Activity, lastSession, s, new Date()),
        lastSession: s,
        lastWeekly: w,
      }),
      paint(u, settings),
      settings.alerts && alert(u, lastSession, lastWeekly),
    ])
  } catch (e) {
    const error = (e as Error).message
    const { usageState } = await chrome.storage.local.get('usageState')
    await Promise.all([
      chrome.storage.local.set({ usageState: { ...(usageState as UsageState | undefined), error } }),
      chrome.action.setBadgeText({ text: '!' }),
      chrome.action.setBadgeBackgroundColor({ color: '#6b7280' }),
      chrome.action.setBadgeTextColor({ color: '#ffffff' }),
      chrome.action.setTitle({ title: `Claude usage unavailable: ${error}` }),
    ])
  }
}

export async function scheduleUsage() {
  const { settings } = await chrome.storage.local.get('settings')
  const minutes = (settings as Settings | undefined)?.usageMinutes ?? DEFAULTS.usageMinutes
  await chrome.alarms.create('usage', { periodInMinutes: minutes })
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === 'usage') refreshUsage() })
chrome.runtime.onInstalled.addListener(() => { scheduleUsage(); refreshUsage() })
chrome.runtime.onStartup.addListener(() => { scheduleUsage(); refreshUsage() })
chrome.storage.onChanged.addListener(async c => {
  if (!c.settings) return
  const [prev, next] = [c.settings.oldValue, c.settings.newValue] as (Settings | undefined)[]
  if (next?.usageMinutes !== prev?.usageMinutes) scheduleUsage()
  if (next?.badge !== prev?.badge) {
    const { usageState } = await chrome.storage.local.get('usageState')
    const u = (usageState as UsageState | undefined)?.usage
    if (u) paint(u, { ...DEFAULTS, ...next })
  }
})
chrome.notifications.onClicked.addListener(id => {
  chrome.notifications.clear(id)
  chrome.tabs.create({ url: 'https://claude.ai' })
})
