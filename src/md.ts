// Pure helpers: prompt <-> .md file, variables. No chrome/DOM APIs so it can be tested with plain node.

export type Prompt = {
  id: string // file name in the root folder, e.g. "Review PR.md"
  title: string
  tags: string[]
  body: string
  pinned?: boolean // frontmatter `pinned: true`; pinned prompts list first
  extra?: string // other frontmatter lines (Obsidian metadata), kept verbatim on save
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseMd(id: string, text: string): Prompt {
  const title = id.replace(/\.md$/i, '')
  let body = text
  let tags: string[] = []
  let pinned = false
  const extra: string[] = []
  const m = text.match(FM)
  if (m) {
    body = text.slice(m[0].length)
    const lines = m[1].split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const pin = lines[i].match(/^pinned:\s*(true|false)\s*$/i)
      if (pin) { pinned = pin[1].toLowerCase() === 'true'; continue }
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
  return { id, title, tags, body, ...(pinned && { pinned }), extra: extra.join('\n') || undefined }
}

export function toMd(p: Prompt): string {
  const fm = [p.tags.length ? `tags: [${p.tags.join(', ')}]` : '', p.pinned ? 'pinned: true' : '', p.extra ?? ''].filter(Boolean).join('\n')
  return fm ? `---\n${fm}\n---\n${p.body}` : p.body
}

const BAD = /[\\/:*?"<>|]/g
export const cleanName = (s: string) => s.replace(BAD, '-').replace(/^\.+/, '').trim()

export function pathFor(title: string): string {
  const name = cleanName(title)
  if (!name) throw new Error('Title is required')
  return `${name}.md`
}

// {{name}}, {{name=default}}, or {{name|a|b|c}} (a choice; the first option is the default)
export type Var = { name: string; def: string; options?: string[] }
const VAR = /\{\{\s*([^{}]+?)\s*\}\}/g

function parseVar(raw: string): Var {
  const [head, ...opts] = raw.split('|').map(s => s.trim())
  if (opts.length) return { name: head, def: opts[0], options: opts }
  const eq = head.indexOf('=')
  return eq < 0 ? { name: head, def: '' } : { name: head.slice(0, eq).trim(), def: head.slice(eq + 1).trim() }
}

// One entry per name; the first occurrence decides the default/options.
export function varsOf(body: string): Var[] {
  const seen = new Map<string, Var>()
  for (const m of body.matchAll(VAR)) { const v = parseVar(m[1]); if (!seen.has(v.name)) seen.set(v.name, v) }
  return [...seen.values()]
}

export const fillVars = (body: string, vals: Record<string, string>) =>
  body.replace(VAR, (all, raw: string) => { const v = parseVar(raw); return v.name in vals ? vals[v.name] : v.def || all })
