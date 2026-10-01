import { useEffect, useRef, useState, type ReactNode } from 'react'
import { call, type Status } from '../api'
import { varsOf, type Prompt } from '../md'
import { DEFAULTS, vars, type Settings } from '../themes'
import { insertIntoComposer, composer, composerText, textBeforeCaret, TRIGGER } from './insert'
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
  const [trigger, setTrigger] = useState(false) // opened by typing TRIGGER in the composer
  const [recent, setRecent] = useState<Record<string, number>>({}) // prompt id -> last inserted at

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
    chrome.storage.local.get(['settings', 'recentPrompts']).then(r => {
      if (r.settings) setSettings({ ...DEFAULTS, ...r.settings })
      if (r.recentPrompts) setRecent(r.recentPrompts as Record<string, number>)
    })
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
    // Typing ";;" in the chat box opens the drawer. The ";;" stays until a prompt replaces it.
    const onInput = (e: Event) => {
      if ((e as InputEvent).data !== TRIGGER.at(-1)) return
      const el = composer()
      if (!el?.contains(e.target as Node) || !textBeforeCaret(el).endsWith(TRIGGER)) return
      setTrigger(true); setView({ kind: 'list' }); setOpen(true)
    }
    document.addEventListener('input', onInput, true)
    return () => {
      mq.removeEventListener('change', onMq); chrome.storage.onChanged.removeListener(onStore)
      document.removeEventListener('input', onInput, true)
    }
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

  function insert(text: string, p: Prompt) {
    const el = composer()
    if (trigger && el) {
      // ponytail: rebuilds the composer from plain text, so rich formatting and blank lines around ";;" collapse
      const cur = composerText(el)
      const i = cur.lastIndexOf(TRIGGER)
      if (i >= 0) text = cur.slice(0, i) + text + cur.slice(i + TRIGGER.length)
    }
    if (!insertIntoComposer(text)) return flash('Chat box not found on this page')
    setOpen(false); setView({ kind: 'list' }); setTrigger(false)
    // ponytail: ids of deleted/renamed prompts linger here; prune if it ever grows large
    const next = { ...recent, [p.id]: Date.now() }
    setRecent(next)
    chrome.storage.local.set({ recentPrompts: next })
  }

  async function togglePin(p: Prompt) {
    try {
      await call({ type: 'save', prevId: p.id, prompt: { ...p, pinned: !p.pinned } })
      flash(p.pinned ? 'Unpinned' : 'Pinned')
      await load()
    } catch (e) { flash((e as Error).message) }
  }

  function use(p: Prompt) {
    if (varsOf(p.body).length) setView({ kind: 'vars', prompt: p })
    else insert(p.body, p)
  }

  const dark = settings.mode === 'dark' || (settings.mode === 'system' && sysDark)
  const theme = vars(settings.theme, dark) as React.CSSProperties
  const connected = status?.state === 'granted'

  let body: ReactNode
  if (error && !connected) body = <Empty title="Something went wrong" text={error} action="Open settings" onAction={() => call({ type: 'openOptions' })} />
  else if (!status) body = null
  else if (status.state === 'none') body = <Empty title="Connect your prompt folder" text="Pick a folder of .md files once. Each file becomes a prompt." action="Connect folder" onAction={() => call({ type: 'openOptions' })} />
  else if (!connected && view.kind !== 'settings') body = <Empty title="Reconnect folder" text={`Chrome paused access to "${status.name}". One click in settings restores it.`} action="Reconnect" onAction={() => call({ type: 'openOptions' })} />
  else if (view.kind === 'edit') body = <Editor prompt={view.prompt} onDone={async msg => { setView({ kind: 'list' }); if (msg) { flash(msg); await load() } }} />
  else if (view.kind === 'vars') body = <VarsForm prompt={view.prompt} onInsert={t => insert(t, view.prompt)} onBack={() => setView({ kind: 'list' })} />
  else if (view.kind === 'settings') body = <SettingsView settings={settings} dark={dark} status={status} prompts={prompts} onChange={updateSettings} onImported={async n => { flash(`Imported ${n} prompt${n === 1 ? '' : 's'}`); await load() }} onError={flash} />
  else body = <List prompts={prompts} recent={recent} onUse={use} onPin={togglePin} onEdit={p => setView({ kind: 'edit', prompt: p })} onClose={() => setOpen(false)} />

  const title = { list: 'Prompts', edit: view.kind === 'edit' && view.prompt ? 'Edit prompt' : 'New prompt', vars: 'Fill variables', settings: 'Settings' }[view.kind]

  return (
    <div className={`root ${dark ? 'dark' : 'light'}`} style={theme}>
      <button className="launcher" data-hidden={open} aria-label="Open prompt library" title="Prompt library" onClick={() => { setTrigger(false); setOpen(true) }}>
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
