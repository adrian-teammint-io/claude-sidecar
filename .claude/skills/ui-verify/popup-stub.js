const P = new URLSearchParams(location.search);
const now = new Date(); const act = {};
const pad = n => String(n).padStart(2, '0');
for (let d = 0; d < 30; d++) for (const h of [9, 10, 11, 14, 15, 20, 21]) {
  if ((d * 7 + h) % 3 === 0) continue;
  const t = new Date(now.getTime() - d * 86400000); if (d === 0 && h > now.getHours()) continue;
  act[`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}T${pad(h)}`] = ((d + h) % 7) + 1;
}
const usageState = P.get('empty') ? {} : { at: Date.now() - 120000, error: P.get('err') ? 'HTTP 403' : undefined,
  usage: { five_hour: { utilization: +(P.get('s') ?? 4), resets_at: new Date(Date.now() + 287 * 60000).toISOString() },
    seven_day: { utilization: 9, resets_at: new Date(Date.now() + 3 * 86400000).toISOString() },
    seven_day_opus: { utilization: 0, resets_at: null }, seven_day_sonnet: null } };
usageState.usage && P.get('models') && (usageState.usage.seven_day_sonnet = { utilization: 23, resets_at: null });
window.chrome = { runtime: { getManifest: () => ({ version: '0.1.0' }), openOptionsPage() {},
    sendMessage: m => new Promise(r => setTimeout(() => r({ ok: true, data: m.type === 'status' ? { state: 'granted', name: 'prompt-libraries' } : undefined }), 400)) },
  storage: { local: { get: async () => ({ usageState, activity: act, settings: P.get('light') ? { theme: 'paper', mode: 'light', usageMinutes: 5, badge: 'session', alerts: true } : { theme: 'graphite', mode: 'dark', usageMinutes: 5, badge: 'session', alerts: true } }), set: async () => {}, remove: async () => {} },
    onChanged: { addListener() {}, removeListener() {} } },
  tabs: { create() {} } };
if (P.get('month')) setTimeout(() => document.querySelectorAll('.segmented button')[1].click(), 600);
if (P.get('settings')) setTimeout(() => document.querySelector('[aria-label="Settings"]').click(), 600);
