// Replace the claude.ai composer content with `text`. No auto-send.
// ponytail: selectors track claude.ai's current DOM; update here when their markup changes.
const SELECTORS = ['div.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"]', 'fieldset [contenteditable="true"]', 'textarea']

export function insertIntoComposer(text: string): boolean {
  const el = SELECTORS.map(s => document.querySelector<HTMLElement>(s)).find(Boolean)
  if (!el) return false
  el.focus()

  if (el instanceof HTMLTextAreaElement) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }

  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)

  // A synthetic paste lets ProseMirror turn newlines into proper paragraphs.
  const dt = new DataTransfer()
  dt.setData('text/plain', text)
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  if (norm(el.innerText) !== norm(text)) document.execCommand('insertText', false, text)
  return true
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
