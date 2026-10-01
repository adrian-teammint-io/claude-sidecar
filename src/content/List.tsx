import { useEffect, useMemo, useRef, useState } from 'react'
import { varsOf, type Prompt } from '../md'
import { Icon } from './ui'

export function List({ prompts, onUse, onEdit, onClose }: { prompts: Prompt[]; onUse: (p: Prompt) => void; onEdit: (p: Prompt) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const search = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => { search.current?.focus() }, [])

  const folders = useMemo(() => [...new Set(prompts.map(p => p.folder))].sort(), [prompts])
  const tags = useMemo(() => [...new Set(prompts.flatMap(p => p.tags))].sort(), [prompts])
  const shown = useMemo(() => {
    // ponytail: substring match over title/tags/body; swap for fuzzy scoring if libraries get large
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return prompts.filter(p =>
      (folder === null || p.folder === folder) &&
      (tag === null || p.tags.includes(tag)) &&
      words.every(w => `${p.title} ${p.folder} ${p.tags.join(' ')} ${p.body}`.toLowerCase().includes(w)))
  }, [prompts, q, folder, tag])

  useEffect(() => { setActive(0) }, [q, folder, tag])
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); onUse(shown[active]) }
    else if (e.key === 'Escape' && q) { e.stopPropagation(); setQ('') }
  }

  let lastFolder: string | undefined
  return (
    <>
      <div className="search">
        <Icon d="search" />
        <input ref={search} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search prompts" aria-label="Search prompts" />
        <kbd>↵</kbd>
      </div>
      {folders.length > 1 && (
        <div className="chips" role="toolbar" aria-label="Folders">
          <button className="chip" aria-pressed={folder === null} onClick={() => setFolder(null)}>All</button>
          {folders.map(f => <button key={f} className="chip" aria-pressed={folder === f} onClick={() => setFolder(folder === f ? null : f)}>{f || 'Unfiled'}</button>)}
        </div>
      )}
      {tags.length > 0 && (
        <div className="chips tags" role="toolbar" aria-label="Tags">
          {tags.map(t => <button key={t} className="chip tag" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>)}
        </div>
      )}
      {prompts.length === 0 ? (
        <p className="muted pad">No prompts yet. Click + to write your first one.</p>
      ) : shown.length === 0 ? (
        <p className="muted pad">Nothing matches "{q}".</p>
      ) : (
        <ul className="list" ref={listRef}>
          {shown.map((p, i) => {
            const heading = folder === null && p.folder !== lastFolder ? <li className="group" key={`g:${p.folder}`}>{p.folder || 'Unfiled'}</li> : null
            lastFolder = p.folder
            const n = varsOf(p.body).length
            return [heading,
              <li key={p.id} className="item" data-active={i === active} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                onMouseMove={() => i !== active && setActive(i)}>
                <button className="item-main" onClick={() => onUse(p)}>
                  <span className="item-title">{p.title}{n > 0 && <span className="badge">{n} var{n > 1 ? 's' : ''}</span>}</span>
                  <span className="item-body">{p.body.trim().slice(0, 180)}</span>
                  {p.tags.length > 0 && <span className="item-tags">{p.tags.map(t => <span key={t}>#{t}</span>)}</span>}
                </button>
                <button className="item-edit" aria-label={`Edit ${p.title}`} title="Edit" onClick={() => onEdit(p)}><Icon d="pen" size={14} /></button>
              </li>]
          })}
        </ul>
      )}
      <footer className="foot muted"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> insert</span><button className="link" onClick={onClose}><kbd>esc</kbd> close</button></footer>
    </>
  )
}
