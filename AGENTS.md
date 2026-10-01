# Claude Sidecar

Chrome MV3 extension that injects a prompt-library drawer into claude.ai. Prompts are `.md` files in a local folder the user picks once. Clicking a prompt replaces the composer text (no auto-send).

## Commands (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Watch-build both bundles into `dist/` (load `dist/` unpacked, hit reload in `chrome://extensions`) |
| `pnpm build` | Typecheck + production build |
| `pnpm package` | Build + zip to `releases/ClaudeSidecar-v{version}-{dd.mm}.zip` |
| `pnpm test` | `src/md.test.ts` assert self-check (prompt file parsing, paths, variables) |
| `pnpm typecheck` | `tsc --noEmit` |

Version lives only in `package.json`; the build writes it into `dist/manifest.json` (`public/manifest.json` keeps `0.0.0`).

## Architecture

```
claude.ai page
  content.js (IIFE, shadow DOM)  --chrome.runtime.sendMessage-->  background.js (service worker)
    src/content/*                                                  src/background.ts
    drawer UI, insert into composer                                reads/writes .md via FileSystemDirectoryHandle
options.html (src/options.tsx): picks / re-grants the root folder, stores handle in IndexedDB (src/handle.ts)
```

- Two Vite builds: `vite.config.ts` (options page + worker, ES modules) and `vite.content.config.ts` (content script must be one IIFE file). Shared code is fine; it's bundled into both.
- The content script never touches the file system. File pickers and `requestPermission` only work in an extension page, which is why the settings page exists.
- Message protocol is the `Req` union in `src/api.ts`; every response is `{ ok, data | error }`.
- UI lives in a shadow root; fonts are injected into the page `<head>` because `@font-face` is ignored inside shadow DOM.
- Themes: `src/themes.ts` holds 7-color palettes (dark + light) that become CSS vars on `.root`. All other colors in `styles.css` derive from those vars via `color-mix`. Settings (`theme`, `mode`) live in `chrome.storage.local`.

## Prompt file format

`<root>/<folder...>/<title>.md`. Subfolders become groups, frontmatter `tags:` (inline `[a, b]` or YAML list) become filters, and other frontmatter lines are kept verbatim on save. `{{name}}` marks a variable that's filled in at insert time. Dot-folders (`.obsidian`, `.git`) are skipped. Logic lives in `src/md.ts`, which must stay free of DOM and chrome APIs so plain node can test it.

## Conventions

- Keep it small: no new dependencies for what a few lines do. Mark deliberate shortcuts with `// ponytail:` and name the ceiling.
- Effects use block bodies: `useEffect(() => { x() }, [])`. An expression body can return a value (e.g. a Promise from `scrollIntoView`), and React then crashes on unmount.
- Exact CSS transition properties (never `all`), and press/hover ≤ 180ms. Respect `prefers-reduced-motion`.
- Commits: conventional title (`feat(drawer): ...`) + bullet body, no emojis, no AI attribution.
- Use AGENTS.md for agent docs, not CLAUDE.md.

## Skills (load when relevant)

- `.claude/skills/composer-insert`: claude.ai changed its DOM and insert broke
- `.claude/skills/folder-access`: folder connect / permission / "access paused" issues
- `.claude/skills/ui-verify`: screenshot the drawer in headless Chrome without loading the extension
- `.claude/skills/release`: bump version, package, install
