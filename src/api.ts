import type { Prompt } from './md'

export type Status = { state: 'none' | 'prompt' | 'granted' | 'denied'; name?: string }

export type Req =
  | { type: 'status' }
  | { type: 'list' }
  | { type: 'save'; prompt: Prompt; prevId?: string }
  | { type: 'delete'; id: string }
  | { type: 'import'; prompts: Prompt[] }
  | { type: 'openOptions' }
  | { type: 'refreshUsage' }

type Res<T> = { ok: true; data: T } | { ok: false; error: string }

const RELOADED = 'Extension was reloaded. Refresh this page.'

export async function call<T>(req: Req): Promise<T> {
  // An orphaned content script (extension reloaded/updated under an open tab) loses chrome.runtime entirely.
  if (!chrome.runtime?.id) throw new Error(RELOADED)
  const res: Res<T> | undefined = await chrome.runtime.sendMessage(req)
  if (!res) throw new Error(RELOADED)
  if (!res.ok) throw new Error(res.error)
  return res.data
}
