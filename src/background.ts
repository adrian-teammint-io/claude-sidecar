import { refreshUsage } from './usage'
import { getRoot } from './handle'
import { parseMd, toMd, pathFor, type Prompt } from './md'
import type { Req, Status } from './api'

async function root(): Promise<FileSystemDirectoryHandle> {
  const h = await getRoot()
  if (!h) throw new Error('No folder connected')
  if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Folder access expired. Reconnect it in Settings.')
  return h
}

async function walk(dir: FileSystemDirectoryHandle, prefix: string, out: Prompt[]) {
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith('.')) continue // .obsidian, .git, .trash
    const path = prefix + name
    if (h.kind === 'directory') await walk(h as FileSystemDirectoryHandle, path + '/', out)
    else if (name.toLowerCase().endsWith('.md')) out.push(parseMd(path, await (await (h as FileSystemFileHandle).getFile()).text()))
  }
  return out
}

async function fileAt(path: string, create: boolean) {
  const segs = path.split('/')
  if (segs.some(s => !s || s === '.' || s === '..')) throw new Error(`Bad path: ${path}`)
  let dir = await root()
  for (const s of segs.slice(0, -1)) dir = await dir.getDirectoryHandle(s, { create })
  return { dir, name: segs.at(-1)!, file: await dir.getFileHandle(segs.at(-1)!, { create }) }
}

async function exists(path: string) {
  try { await fileAt(path, false); return true } catch { return false }
}

async function save(p: Prompt, prevId?: string): Promise<Prompt> {
  let id = pathFor(p.folder, p.title)
  // macOS volumes are case-insensitive: a case-only rename is the same file, so never delete prevId after writing it.
  // ponytail: case-only renames keep the old filename casing
  const sameFile = prevId?.toLowerCase() === id.toLowerCase()
  if (sameFile) id = prevId!
  else if (await exists(id)) throw new Error(`"${id}" already exists`)
  const { file } = await fileAt(id, true)
  const w = await file.createWritable()
  await w.write(toMd({ ...p, id }))
  await w.close()
  if (prevId && !sameFile) await remove(prevId)
  return parseMd(id, toMd({ ...p, id }))
}

async function remove(id: string) {
  const { dir, name } = await fileAt(id, false)
  await dir.removeEntry(name)
}

async function handle(req: Req): Promise<unknown> {
  switch (req.type) {
    case 'status': {
      const h = await getRoot()
      return (h ? { state: await h.queryPermission({ mode: 'readwrite' }), name: h.name } : { state: 'none' }) satisfies Status
    }
    case 'list':
      return (await walk(await root(), '', [])).sort((a, b) => a.id.localeCompare(b.id))
    case 'save':
      return save(req.prompt, req.prevId)
    case 'delete':
      return remove(req.id)
    case 'import': {
      // ponytail: existing files with the same path are skipped, not merged
      let added = 0
      for (const p of req.prompts) if (!(await exists(pathFor(p.folder ?? '', p.title)))) { await save({ ...p, tags: p.tags ?? [] }); added++ }
      return added
    }
    case 'openOptions':
      return chrome.runtime.openOptionsPage()
    case 'refreshUsage':
      return refreshUsage()
  }
}

chrome.runtime.onMessage.addListener((req: Req, _s, reply) => {
  handle(req).then(data => reply({ ok: true, data }), e => reply({ ok: false, error: String(e?.message ?? e) }))
  return true
})
