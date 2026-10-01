---
name: usage-tracker
description: How the Claude Sidecar toolbar icon tracks Claude plan usage limits and how to debug it. Use when the icon shows "!", numbers look wrong, the refresh interval misbehaves, or claude.ai changes its usage API.
---

# Usage tracker

## Flow

1. `chrome.alarms` (`usage`, every `settings.usageMinutes`, default 5) fires `refreshUsage()` in `src/usage.ts`. So do install, browser startup and clicking the toolbar icon.
2. It needs an organization id. It reads the cached `orgId` from `chrome.storage.local`. If there isn't one, it calls `GET https://claude.ai/api/organizations` and picks the org whose `capabilities` include `chat`.
3. It calls `GET https://claude.ai/api/organizations/{orgId}/usage`. The response looks like `{ five_hour, seven_day, seven_day_opus, seven_day_sonnet }`, where each value is `{ utilization: 0-100, resets_at: ISO | null }` or `null`.
4. It paints the toolbar icon:
   - Icon: drawn on an `OffscreenCanvas`. The outer ring is the 5-hour session and the inner ring is weekly. Green below 50%, amber below 80%, red from 80%.
   - Badge: session %.
   - Tooltip: every limit with time until reset (`usage-format.ts`).

5. It persists results for the popup in `chrome.storage.local`:
   - `usageState` = `{ usage, at, error? }`. On error the previous `usage` is kept, so the popup can show the last known numbers.
   - `activity` = hourly buckets.
   - `lastSession` = the previous session %.
6. Requests are de-duplicated. `refreshUsage()` shares one in-flight promise across the alarm, popup open and the refresh button, so activity isn't counted twice.

## Badge and alerts

- `paint(u, settings)` draws the icon rings, the badge and the tooltip. The badge shows the 5-hour %, the weekly %, or nothing, per `settings.badge`, and is coloured by `levelColor` of that %. When `settings.badge` changes, the worker repaints from the stored `usageState` without fetching again.
- Alerts are on when `settings.alerts` is true. `crossed(prev, cur)` in `usage-format.ts` reports the highest threshold in `ALERT_AT` (`[80, 95]`) crossed upward since the last poll, for both session and weekly. `resetAfterMax(prev, cur)` fires the "session reset" notification after being at 80% or more.
- Notifications reuse ids (`session`, `weekly`, `reset`), so a new alert replaces the old one. Clicking one opens claude.ai. The icon is the rings drawn at 128px and converted to a data URL.

## Popup (`src/popup/`)

- Clicking the icon opens `popup.html` (`action.default_popup`), so `action.onClicked` no longer fires.
- On open the popup renders what's stored, sends `{ type: 'refreshUsage' }` and re-renders through `storage.onChanged`. A 30s tick keeps the "resets in" and "updated" labels current.
- Activity (`addActivity` in `usage-format.ts`) counts the percentage points of the 5-hour limit used per local hour, keyed `YYYY-MM-DDTHH`.
  - The amount is the difference between consecutive polls. If utilization drops, the window has reset, and the new value counts as fresh usage.
  - Buckets are kept for 35 days.
  - Usage is only seen while Chrome is running, at the poll interval.
  - Week view is 7×24 hours. Month view is 7 weekdays × 5 weeks of daily totals. Cell intensity is relative to the maximum in the visible range.

## Fetch path

- First attempt: the worker fetches directly with `credentials: 'include'`. This relies on `host_permissions: https://claude.ai/*` so the session cookie is sent.
- Fallback when that fails (Cloudflare challenge, cookie policy): `chrome.tabs.sendMessage` to an open claude.ai tab. Its content script (`main.tsx`, message `fetchJson`, restricted to `/api/` paths) fetches same-origin.
- On any usage error the cached `orgId` is dropped, so an account switch heals on the next run.

## Debugging

- "!" badge: hover the icon. The tooltip shows the error. "Open claude.ai and sign in" means the direct fetch failed and no claude.ai tab was open.
- Open the worker console from `chrome://extensions` → service worker, then run `chrome.alarms.getAll()` to check the interval.
- If the endpoint changes, update only `fetchUsage()` and the `Usage` type. Then fix the asserts in `src/usage-format.test.ts` and run `pnpm test`.
- The endpoint is undocumented, and the "weekly" `resets_at` marks when the oldest usage leaves the window, not a full reset.
