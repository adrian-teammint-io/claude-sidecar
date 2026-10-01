import { createRoot } from 'react-dom/client'
import geist from '@fontsource-variable/geist/wght.css?inline'
import mono from '@fontsource-variable/jetbrains-mono/wght.css?inline'
import css from './styles.css?inline'
import { App } from './App'

// @font-face is ignored inside shadow roots, so fonts go on the page; everything else stays isolated in the shadow DOM.
const fonts = document.createElement('style')
fonts.textContent = geist + mono
document.head.append(fonts)

const host = document.createElement('claude-sidecar')
host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; right: 0;'
document.documentElement.append(host)
// Keep keystrokes/pastes typed in the drawer away from claude.ai's document-level handlers (type-to-focus, shortcuts,
// paste-as-attachment). React's listeners sit on the mount node inside the shadow root, so they still run first.
for (const type of ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste']) host.addEventListener(type, e => e.stopPropagation())
// open: focus-guard.js (page world) needs host.shadowRoot to tell drawer focus from page focus
const shadow = host.attachShadow({ mode: 'open' })
const style = document.createElement('style')
style.textContent = css
const mount = document.createElement('div')
shadow.append(style, mount)
createRoot(mount).render(<App />)

// Usage-tracker fallback: the worker asks this tab to fetch claude.ai JSON same-origin (with the user's session).
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg?.type !== 'fetchJson' || typeof msg.path !== 'string' || !msg.path.startsWith('/api/')) return
  fetch(msg.path, { headers: { accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(data => reply({ ok: true, data }), e => reply({ ok: false, error: String(e.message) }))
  return true
})
