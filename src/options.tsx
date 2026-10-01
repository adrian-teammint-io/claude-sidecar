import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import css from './content/styles.css?inline'
import { getRoot, setRoot } from './handle'
import { DEFAULTS, vars, type Settings } from './themes'

// The drawer on claude.ai can't open a file picker, so connecting the folder (and re-granting access after a
// browser restart) happens here, in an extension page.
function Options() {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle>()
  const [perm, setPerm] = useState<PermissionState>()
  const [msg, setMsg] = useState('')
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)

  async function refresh() {
    const h = await getRoot()
    setHandle(h)
    setPerm(h ? await h.queryPermission({ mode: 'readwrite' }) : undefined)
  }

  useEffect(() => {
    refresh()
    chrome.storage.local.get('settings').then(r => r.settings && setSettings({ ...DEFAULTS, ...r.settings }))
  }, [])

  async function done(h: FileSystemDirectoryHandle) {
    await refresh()
    // Notifies open claude.ai tabs to reload the library.
    await chrome.storage.local.set({ rootName: `${h.name}:${Date.now()}` })
    setMsg('Connected. You can close this tab and head back to claude.ai.')
  }

  async function pick() {
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'sidecar-root' })
      await setRoot(h)
      await done(h)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg((e as Error).message)
    }
  }

  async function reconnect() {
    if (handle && (await handle.requestPermission({ mode: 'readwrite' })) === 'granted') await done(handle)
    else await refresh()
  }

  return (
    <main className={`root ${dark ? 'dark' : 'light'} page`} style={vars(settings.theme, dark) as React.CSSProperties}>
      <div className="card">
        <h1>Claude Sidecar</h1>
        <p className="muted">Choose the root folder that holds your prompts. Each <code>.md</code> file is a prompt, each subfolder is a group, and <code>tags:</code> in frontmatter become filters.</p>
        <div className="folder-card">
          <div>
            <strong>{handle?.name ?? 'No folder connected'}</strong>
            <span className="muted">{!handle ? 'Pick one to get started' : perm === 'granted' ? 'Read & write access granted' : 'Access paused — Chrome asks again after a restart'}</span>
          </div>
          {handle && perm !== 'granted' && <button className="btn primary" onClick={reconnect}>Reconnect</button>}
          <button className={`btn ${handle ? 'ghost' : 'primary'}`} onClick={pick}>{handle ? 'Change folder' : 'Choose folder'}</button>
        </div>
        <p className="hint muted">Tip: when Chrome asks, choose "Allow on every visit" so you don't need to reconnect after restarts.</p>
        {msg && <p className="ok" role="status">{msg}</p>}
      </div>
    </main>
  )
}

const style = document.createElement('style')
style.textContent = css + `
  body { margin: 0; }
  .page { min-height: 100vh; display: grid; place-items: center; background: var(--bg); padding: 24px; }
  .card { width: min(560px, 100%); display: flex; flex-direction: column; gap: 14px; padding: 28px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line-strong); }
  .card h1 { font-size: 20px; font-weight: 650; letter-spacing: -0.02em; }
  .card .folder-card { background: var(--bg); }
  .ok { color: var(--accent); font-weight: 500; }
  .light .ok { color: var(--text); }
`
document.head.append(style)
createRoot(document.getElementById('app')!).render(<Options />)
