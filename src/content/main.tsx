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
const shadow = host.attachShadow({ mode: 'open' })
const style = document.createElement('style')
style.textContent = css
const mount = document.createElement('div')
shadow.append(style, mount)
createRoot(mount).render(<App />)
