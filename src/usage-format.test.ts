import assert from 'node:assert/strict'
import { untilText, usageTitle, badgeText, levelColor, addActivity, dayKey, crossed, resetAfterMax } from './usage-format.ts'

const now = Date.parse('2026-10-01T10:00:00Z')
assert.equal(untilText('2026-10-01T10:45:00Z', now), '45m')
assert.equal(untilText('2026-10-01T12:14:00Z', now), '2h 14m')
assert.equal(untilText('2026-10-04T13:00:00Z', now), '3d 3h')
assert.equal(untilText('2026-10-01T09:00:00Z', now), '0m') // already passed
assert.equal(untilText(null, now), '')

const u = { five_hour: { utilization: 23.4, resets_at: '2026-10-01T12:14:00Z' }, seven_day: { utilization: 41, resets_at: null }, seven_day_opus: null }
const t = usageTitle(u, now).split('\n')
assert.equal(t[1], 'Session (5h): 23% · resets in 2h 14m')
assert.equal(t[2], 'Weekly: 41%')
assert.equal(t.length, 3) // header + 2 limits (null opus skipped)
assert.equal(badgeText(u), '23%')
assert.equal(badgeText({}), '')
assert.deepEqual([levelColor(10), levelColor(50), levelColor(80)], ['#22c55e', '#f59e0b', '#ef4444'])
const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m)
let act = addActivity({}, undefined, 10, at(9)) // first poll: no baseline, nothing recorded
assert.deepEqual(act, {})
act = addActivity(act, 10, 14, at(9, 5))
act = addActivity(act, 14, 15.5, at(9, 10))
assert.deepEqual(act, { '2026-10-01T09': 5.5 })
act = addActivity(act, 15.5, 3, at(14)) // window reset: 3 is fresh usage
assert.equal(act['2026-10-01T14'], 3)
act = addActivity(act, 3, 3, at(15)) // no change: no bucket
assert.equal(act['2026-10-01T15'], undefined)
act = addActivity({ '2026-08-01T10': 9, ...act }, 3, 4, at(16)) // old buckets pruned
assert.equal(act['2026-08-01T10'], undefined)
assert.equal(dayKey(at(16)), '2026-10-01')
assert.equal(badgeText(u, 'weekly'), '41%')
assert.equal(badgeText(u, 'off'), '')
assert.equal(crossed(undefined, 90), undefined) // no baseline
assert.equal(crossed(70, 85), 80)
assert.equal(crossed(70, 97), 95) // jumped both: report the highest
assert.equal(crossed(85, 90), undefined) // already past 80
assert.equal(crossed(96, 99), undefined)
assert.equal(resetAfterMax(92, 4), true)
assert.equal(resetAfterMax(50, 4), false)
assert.equal(resetAfterMax(92, 95), false)
console.log('usage ok')
