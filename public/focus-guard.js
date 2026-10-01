// Runs in the page's own JS world (manifest "world": "MAIN") at document_start.
// claude.ai moves focus to its composer when you type outside one of its inputs. Our drawer is in a shadow root,
// so to the page the focused element is just <claude-sidecar>, and it steals focus. While the drawer has focus,
// ignore page-initiated focus() calls that target anything outside the drawer.
// The content script lives in an isolated world with its own prototypes, so its own focus() calls are unaffected.
const focus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function (...args) {
  const host = document.activeElement
  if (host?.localName === 'claude-sidecar' && this.getRootNode() !== host.shadowRoot) return
  return focus.apply(this, args)
}
