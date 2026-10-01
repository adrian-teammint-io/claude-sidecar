import { useRef } from 'react'
import { call, type Status } from '../api'
import type { Prompt } from '../md'
import { THEMES, type Settings, type Mode } from '../themes'
import { Icon } from './ui'

export function SettingsView({ settings, dark, status, prompts, onChange, onImported, onError }: {
  settings: Settings; dark: boolean; status: Status; prompts: Prompt[]
  onChange: (s: Partial<Settings>) => void; onImported: (n: number) => void; onError: (m: string) => void
}) {
  const file = useRef<HTMLInputElement>(null)

  function exportJson() {
    const data = prompts.map(({ title, folder, tags, body }) => ({ title, folder, tags, body }))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `sidecar-prompts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function importJson(f: File) {
    try {
      const raw = JSON.parse(await f.text())
      if (!Array.isArray(raw)) throw new Error('Expected a JSON array of prompts')
      const valid = raw.filter(p => p && typeof p.title === 'string' && typeof p.body === 'string')
        .map(p => ({ id: '', title: p.title, body: p.body, folder: typeof p.folder === 'string' ? p.folder : '', tags: Array.isArray(p.tags) ? p.tags.map(String) : [] }))
      onImported(await call<number>({ type: 'import', prompts: valid }))
    } catch (e) { onError((e as Error).message) }
  }

  return (
    <div className="settings">
      <section>
        <h2>Prompt folder</h2>
        <div className="folder-card">
          <Icon d="folder" />
          <div><strong>{status.name ?? 'None'}</strong><span className="muted">{status.state === 'granted' ? 'Connected' : status.state === 'none' ? 'Not connected' : 'Access paused'}</span></div>
          <button className="btn ghost" onClick={() => call({ type: 'openOptions' })}>{status.state === 'granted' ? 'Change' : 'Connect'}</button>
        </div>
      </section>
      <section>
        <h2>Appearance</h2>
        <div className="segmented" role="radiogroup" aria-label="Color mode">
          {(['system', 'light', 'dark'] as Mode[]).map(m => (
            <button key={m} role="radio" aria-checked={settings.mode === m} onClick={() => onChange({ mode: m })}>{m[0].toUpperCase() + m.slice(1)}</button>
          ))}
        </div>
        <div className="themes" role="radiogroup" aria-label="Theme">
          {Object.entries(THEMES).map(([key, t]) => {
            const [bg, surface, , text, , accent] = t[dark ? 'dark' : 'light']
            return (
              <button key={key} role="radio" aria-checked={settings.theme === key} className="theme" onClick={() => onChange({ theme: key })}>
                <span className="swatch" style={{ background: bg, color: text }}>
                  <span style={{ background: surface }} /><span style={{ background: accent }} />
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </section>
      <section>
        <h2>Backup</h2>
        <div className="row">
          <button className="btn ghost" onClick={exportJson} disabled={!prompts.length}>Export JSON</button>
          <button className="btn ghost" onClick={() => file.current?.click()} disabled={status.state !== 'granted'}>Import JSON</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
        </div>
        <p className="hint muted">Import writes new .md files into your folder. Files that already exist are skipped.</p>
      </section>
    </div>
  )
}
