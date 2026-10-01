import { useState } from 'react'
import { call } from '../api'
import { varsOf, fillVars, type Prompt } from '../md'

export function Editor({ prompt, folders, onDone }: { prompt?: Prompt; folders: string[]; onDone: (msg?: string) => void }) {
  const [title, setTitle] = useState(prompt?.title ?? '')
  const [folder, setFolder] = useState(prompt?.folder ?? '')
  const [tags, setTags] = useState(prompt?.tags.join(', ') ?? '')
  const [body, setBody] = useState(prompt?.body ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const v = varsOf(body)

  async function save() {
    setBusy(true); setErr('')
    try {
      const tagList = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      await call({ type: 'save', prevId: prompt?.id, prompt: { id: '', title, folder, tags: tagList, body, extra: prompt?.extra } })
      onDone('Saved')
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  async function del() {
    if (!confirmDel) return setConfirmDel(true)
    try { await call({ type: 'delete', id: prompt!.id }); onDone('Deleted') } catch (e) { setErr((e as Error).message) }
  }

  return (
    <form className="form" onSubmit={e => { e.preventDefault(); save() }}
      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() } }}>
      <label htmlFor="sc-title">Title</label>
      <input id="sc-title" value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="Review a pull request" />
      <div className="row">
        <div>
          <label htmlFor="sc-folder">Folder</label>
          <input id="sc-folder" value={folder} onChange={e => setFolder(e.target.value)} list="sc-folders" placeholder="Unfiled" />
          <datalist id="sc-folders">{folders.map(f => <option key={f} value={f} />)}</datalist>
        </div>
        <div>
          <label htmlFor="sc-tags">Tags</label>
          <input id="sc-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="code, review" />
        </div>
      </div>
      <label htmlFor="sc-body">Prompt</label>
      <textarea id="sc-body" value={body} onChange={e => setBody(e.target.value)} required rows={12} placeholder={'Review this {{language}} code for bugs:\n\n{{code}}'} />
      <p className="hint muted">
        {v.length ? <>Variables: {v.map(x => <code key={x}>{x}</code>)}</> : <>Use <code>{'{{name}}'}</code> for values you fill in at insert time.</>}
      </p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        {prompt && <button type="button" className={`btn ${confirmDel ? 'danger' : 'ghost'}`} onClick={del} onBlur={() => setConfirmDel(false)}>{confirmDel ? 'Confirm delete' : 'Delete'}</button>}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => onDone()}>Cancel</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}<kbd>⌘↵</kbd></button>
      </div>
    </form>
  )
}

export function VarsForm({ prompt, onInsert, onBack }: { prompt: Prompt; onInsert: (t: string) => void; onBack: () => void }) {
  const names = varsOf(prompt.body)
  const [vals, setVals] = useState<Record<string, string>>({})
  const preview = fillVars(prompt.body, vals)
  return (
    <form className="form" onSubmit={e => { e.preventDefault(); onInsert(preview) }}
      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onInsert(preview) } }}>
      <p className="vars-title">{prompt.title}</p>
      {names.map((n, i) => (
        <div key={n}>
          <label htmlFor={`sc-v-${i}`}>{n}</label>
          <textarea id={`sc-v-${i}`} rows={n.length > 0 && /code|text|content|input/i.test(n) ? 4 : 1} autoFocus={i === 0}
            value={vals[n] ?? ''} onChange={e => setVals({ ...vals, [n]: e.target.value })} />
        </div>
      ))}
      <label>Preview</label>
      <pre className="preview">{preview}</pre>
      <div className="actions">
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onBack}>Cancel</button>
        <button type="submit" className="btn primary">Insert<kbd>⌘↵</kbd></button>
      </div>
    </form>
  )
}
