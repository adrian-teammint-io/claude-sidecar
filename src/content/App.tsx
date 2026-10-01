import { useEffect, useRef, useState, type ReactNode } from 'react'
import { call, type Status } from '../api'
import { varsOf, type Prompt } from '../md'
import { DEFAULTS, vars, type Settings } from '../themes'
import { insertIntoComposer } from './insert'
import { Icon, IconBtn, Empty } from './ui'
import { List } from './List'
import { Editor, VarsForm } from './Editor'
import { SettingsView } from './Settings'

type View = { kind: 'list' } | { kind: 'edit'; prompt?: Prompt } | { kind: 'vars'; prompt: Prompt } | { kind: 'settings' }

const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches

export function App() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [sysDark, setSysDark] = useState(prefersDark)
  const [status, setStatus] = useState<Status | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [error, setError] = useState('')
  const [view, setView] = useState<View>({ kind: 'list' })
  const [toast, setToast] = useState('')

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(t => (t === msg ? '' : t)), 2200) }

  async function load() {
    try {
      setError('')
      const s = await call<Status>({ type: 'status' })
      setStatus(s)
      if (s.state === 'granted') setPrompts(await call<Prompt[]>({ type: 'list' }))
    } catch (e) { setError((e as Error).message) }
  }

  useEffect(() => {
    chrome.storage.local.get('settings').then(r => r.settings && setSettings({ ...DEFAULTS, ...r.settings }))
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onMq = () => setSysDark(mq.matches)
    mq.addEventListener('change', onMq)
    // Settings page writes rootName after (re)connecting the folder.
    // The popup can change theme/mode too; follow it live.
    const onStore = (c: Record<string, chrome.storage.StorageChange>) => {
      if (c.rootName) load()
      if (c.settings?.newValue) setSettings({ ...DEFAULTS, ...(c.settings.newValue as Settings) })
    }
    chrome.storage.onChanged.addListener(onStore)
    return () => { mq.removeEventListener('change', onMq); chrome.storage.onChanged.removeListener(onStore) }
  }, [])

  const drawer = useRef<HTMLElement>(null)

  // Re-read the folder every time the drawer opens, so edits made in Obsidian show up.
  useEffect(() => {
    if (!open) return
    load()
    drawer.current?.querySelector<HTMLElement>('input, textarea')?.focus()
    // Close on any click outside the drawer. Capture phase so page handlers can't swallow it.
    const host = (drawer.current!.getRootNode() as ShadowRoot).host
    const onDown = (e: PointerEvent) => { if (!e.composedPath().includes(host)) setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  function updateSettings(s: Partial<Settings>) {
    const next = { ...settings, ...s }
    setSettings(next)
    chrome.storage.local.set({ settings: next })
  }

  function insert(text: string) {
    if (insertIntoComposer(text)) { setOpen(false); setView({ kind: 'list' }) }
    else flash('Chat box not found on this page')
  }

  function use(p: Prompt) {
    if (varsOf(p.body).length) setView({ kind: 'vars', prompt: p })
    else insert(p.body)
  }

  const dark = settings.mode === 'dark' || (settings.mode === 'system' && sysDark)
  const theme = vars(settings.theme, dark) as React.CSSProperties
  const connected = status?.state === 'granted'

  let body: ReactNode
  if (error && !connected) body = <Empty title="Something went wrong" text={error} action="Open settings" onAction={() => call({ type: 'openOptions' })} />
  else if (!status) body = null
  else if (status.state === 'none') body = <Empty title="Connect your prompt folder" text="Pick a folder of .md files once. Each file becomes a prompt; subfolders become groups." action="Connect folder" onAction={() => call({ type: 'openOptions' })} />
  else if (!connected && view.kind !== 'settings') body = <Empty title="Reconnect folder" text={`Chrome paused access to "${status.name}". One click in settings restores it.`} action="Reconnect" onAction={() => call({ type: 'openOptions' })} />
  else if (view.kind === 'edit') body = <Editor prompt={view.prompt} folders={[...new Set(prompts.map(p => p.folder).filter(Boolean))]} onDone={async msg => { setView({ kind: 'list' }); if (msg) { flash(msg); await load() } }} />
  else if (view.kind === 'vars') body = <VarsForm prompt={view.prompt} onInsert={insert} onBack={() => setView({ kind: 'list' })} />
  else if (view.kind === 'settings') body = <SettingsView settings={settings} dark={dark} status={status} prompts={prompts} onChange={updateSettings} onImported={async n => { flash(`Imported ${n} prompt${n === 1 ? '' : 's'}`); await load() }} onError={flash} />
  else body = <List prompts={prompts} onUse={use} onEdit={p => setView({ kind: 'edit', prompt: p })} onClose={() => setOpen(false)} />

  const title = { list: 'Prompts', edit: view.kind === 'edit' && view.prompt ? 'Edit prompt' : 'New prompt', vars: 'Fill variables', settings: 'Settings' }[view.kind]

  return (
    <div className={`root ${dark ? 'dark' : 'light'}`} style={theme}>
      <button className="launcher" data-hidden={open} aria-label="Open prompt library" title="Prompt library" onClick={() => setOpen(true)}>
        <Icon d="library" size={18} />
      </button>
      <aside ref={drawer} className="drawer" data-open={open} inert={!open} aria-label="Prompt library"
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); view.kind === 'list' ? setOpen(false) : setView({ kind: 'list' }) } }}>
        <header className="head">
          {view.kind !== 'list' ? <IconBtn icon="back" label="Back" onClick={() => setView({ kind: 'list' })} /> : <span className="mark"><Icon d="library" /></span>}
          <h1>{title}</h1>
          {view.kind === 'list' && connected && <IconBtn icon="plus" label="New prompt" onClick={() => setView({ kind: 'edit' })} />}
          {view.kind !== 'settings' && <IconBtn icon="gear" label="Settings" onClick={() => setView({ kind: 'settings' })} />}
          <IconBtn icon="x" label="Close" onClick={() => setOpen(false)} />
        </header>
        <div className="body">{body}</div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </aside>
    </div>
  )
}
