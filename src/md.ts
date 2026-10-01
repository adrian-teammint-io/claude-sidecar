// Pure helpers: prompt <-> .md file, variables. No chrome/DOM APIs so it can be tested with plain node.

export type Prompt = {
  id: string // relative path, e.g. "Coding/Review PR.md"
  folder: string // "" = root
  title: string
  tags: string[]
  body: string
  extra?: string // other frontmatter lines (Obsidian metadata), kept verbatim on save
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseMd(id: string, text: string): Prompt {
  const parts = id.split('/')
  const title = parts.pop()!.replace(/\.md$/i, '')
  let body = text
  let tags: string[] = []
  const extra: string[] = []
  const m = text.match(FM)
  if (m) {
    body = text.slice(m[0].length)
    const lines = m[1].split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].match(/^tags:\s*(.*)$/)
      if (!t) { extra.push(lines[i]); continue }
      if (t[1].trim()) {
        tags = t[1].replace(/^\[|\]$/g, '').split(',')
      } else {
        // YAML list form: "tags:\n  - a\n  - b"
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) tags.push(lines[++i].replace(/^\s*-\s+/, ''))
      }
    }
    tags = tags.map(s => s.trim().replace(/^["'#]+|["']+$/g, '')).filter(Boolean)
  }
  return { id, folder: parts.join('/'), title, tags, body, extra: extra.join('\n') || undefined }
}

export function toMd(p: Prompt): string {
  const fm = [p.tags.length ? `tags: [${p.tags.join(', ')}]` : '', p.extra ?? ''].filter(Boolean).join('\n')
  return fm ? `---\n${fm}\n---\n${p.body}` : p.body
}

const BAD = /[\\/:*?"<>|]/g
export const cleanName = (s: string) => s.replace(BAD, '-').replace(/^\.+/, '').trim()

export function pathFor(folder: string, title: string): string {
  const segs = folder.split('/').map(cleanName).filter(Boolean)
  const name = cleanName(title)
  if (!name) throw new Error('Title is required')
  return [...segs, `${name}.md`].join('/')
}

const VAR = /\{\{\s*([^{}]+?)\s*\}\}/g
export const varsOf = (body: string) => [...new Set([...body.matchAll(VAR)].map(m => m[1]))]
export const fillVars = (body: string, vals: Record<string, string>) =>
  body.replace(VAR, (all, k: string) => (k in vals ? vals[k] : all))
