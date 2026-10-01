# Claude Sidecar

Chrome MV3 extension for claude.ai with three surfaces:
1. **Drawer**, injected into claude.ai: a prompt library backed by a local folder of `.md` files. Clicking a prompt replaces the composer text (no auto-send).
2. **Toolbar icon + popup**: Claude plan usage.
   - Icon: session/weekly rings plus a badge you can configure.
   - Popup: 5-hour and weekly ring cards, a weekly-by-model card, and an activity heatmap.
   - Popup settings (gear): theme/mode, badge, refresh interval, limit alerts, prompt folder, clear history, links.
   - The worker sends notifications at 80% and 95%, and when a maxed-out session resets.
3. **Settings page**: connects or changes the root prompt folder.

## Commands (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Watch-build into `dist/` (load `dist/` unpacked, hit reload in `chrome://extensions`) |
| `pnpm build` | Typecheck + production build |
| `pnpm package` | Build + zip to `releases/ClaudeSidecar-v{version}-{dd.mm}.zip` |
| `pnpm test` | Assert self-checks: `src/md.test.ts`, `src/usage-format.test.ts` |
| `pnpm typecheck` | `tsc --noEmit` |

The version lives only in `package.json`. The build writes it into `dist/manifest.json`; `public/manifest.json` keeps `0.0.0`.

## Codebase structure

```
public/
  manifest.json          MV3 manifest (content scripts, popup, permissions)
  focus-guard.js         MAIN-world script: stops claude.ai stealing focus from the drawer
options.html, popup.html Vite entry pages
src/
  api.ts                 Req union (message protocol) + call() helper, used by every surface
  background.ts          service worker: file ops on the prompt folder, routes messages
  handle.ts              root folder handle in IndexedDB (worker + settings page)
  md.ts                  pure: prompt <-> .md parsing, paths, {{variables}}
  usage.ts               worker: polls usage endpoint, paint() icon/badge, alerts/notifications, stores usageState/activity
  usage-format.ts        pure: tooltip, colours, countdowns, badge text, threshold crossing, activity buckets
  themes.ts              11 palettes x dark/light -> CSS vars; Settings type (theme, mode, usageMinutes, badge, alerts) + DEFAULTS
  ui.css                 shared design system (tokens + primitives + theme picker + switch), imported by every surface
  shared/controls.tsx    shared React controls: Segmented, Switch, ThemePicker (drawer + popup)
  options.tsx            settings page (folder picker / reconnect)
  content/               drawer (one IIFE bundle, shadow DOM)
    main.tsx             mounts shadow root, fonts, event isolation, fetchJson fallback
    App.tsx              open state, view router, data loading
    List.tsx Editor.tsx Settings.tsx ui.tsx insert.ts styles.css
  popup/                 toolbar popup
    main.tsx             data subscription, usage/settings view switch, header
    cards.tsx            RingCard (session | weekly), BreakdownCard (per model), Skeleton
    PopupSettings.tsx    settings view
    Heatmap.tsx          week (7x24 hours) / month (7x5 days) grid
    popup.css
.claude/skills/          on-demand docs (see bottom)
```

- There are two Vite builds. `vite.config.ts` builds the options page, popup and worker as ES modules. `vite.content.config.ts` builds the content script, which must be a single IIFE file.
- Data flows: content and popup → `call(req)` → worker. The worker writes `chrome.storage.local`, and surfaces subscribe via `storage.onChanged`.
- Storage keys: `settings`, `rootName` (bumped on folder connect), `usageState`, `activity`, `lastSession`, `lastWeekly`, `orgId`.
- `settings` is written by the drawer and the popup. Everything follows it live through `storage.onChanged`: the drawer re-themes, and the worker reschedules the alarm or repaints the badge.
- Usage settings (badge, refresh, alerts) live only in the popup. The drawer Settings keeps folder, appearance and backup.
- Popup layout must stay ≤ 600px tall (Chrome's popup limit). Check with `H=600 bash .claude/skills/ui-verify/shoot-popup.sh`.
- The content script never touches the file system. Pickers and `requestPermission` only work in an extension page, which is why the settings page exists.
- Focus stealing: claude.ai moves focus to its composer on keystrokes outside its inputs. To the page, the drawer is just `<claude-sidecar>`. Keep both defenses: `stopPropagation` of key/paste events at the shadow host (`main.tsx`), and `focus-guard.js`.

## UI system (short version; full guide in the `ui-system` skill)

- **Tokens**: `themes.ts` palettes provide 7 base vars (`--bg --surface --raised --text --muted --accent --on-accent`) inline on `.root`. Everything else (`--line`, `--hover`, `--accent-soft`, shadows) is derived in `ui.css` with `color-mix`. Never hard-code theme colours; status colours (green/amber/red levels, error) are the only fixed hues.
- **Primitives** in `ui.css`: `.btn` (`.primary` `.ghost` `.danger`), `.icon-btn`, `.segmented` (radiogroup, any count), `.switch`, `.themes`, `.hint`, `.err`, `kbd`, `code`, `.muted`. Their React wrappers are in `shared/controls.tsx`. Reuse them before adding new ones.
- **Type**: Geist Variable (UI) + JetBrains Mono Variable (data, axes, code). 13px base, uppercase eyebrows at 10.5px with 0.08–0.09em tracking, `tabular-nums` for numbers.
- **Shape**: radius 16 (drawer) / 14 (cards) / 9–10 (inputs, buttons) / 3–5 (cells). Borders are 1px `--line`.
- **Motion**: ease-out curves `--ease-out` / `--ease-drawer`, ≤ 300ms, exact transition properties (never `all`), `:active` scale 0.94–0.97, hover gated by `@media (hover: hover)`, and a reduced-motion fallback in every stylesheet.
- **Every surface** wraps its content in `<div class="root dark|light" style={vars(theme, dark)}>` and resolves `settings.mode` (`system` uses `prefers-color-scheme`).

## Prompt file format

`<root>/<folder...>/<title>.md`.
- Subfolders become groups.
- Frontmatter `tags:` (inline `[a, b]` or a YAML list) become filters. Other frontmatter lines are kept verbatim.
- `{{name}}` is a variable filled in at insert time.
- Dot-folders are skipped.
- `md.ts` stays free of DOM and chrome APIs so plain node can test it.

## Conventions

- Keep it small: no new dependencies for what a few lines do. Mark deliberate shortcuts with `// ponytail:` and name the ceiling.
- Pure logic goes in a chrome-free module with an assert test next to it (`*.test.ts`, run by `pnpm test`).
- Effects use block bodies: `useEffect(() => { x() }, [])`. An expression body can return a value (e.g. a Promise from `scrollIntoView`), and React then crashes on unmount.
- Commits: conventional title (`feat(popup): ...`) + bullet body, no emojis, no AI attribution.
- Shell: a PreToolUse hook reads the first line of any heredoc (or text after `-m`) in a Bash command as a commit message and blocks the command if it isn't conventional. Write files with the editor instead of `cat <<EOF`. For commits, use `git commit -F <file>` or a conventional `-m`.
- Another hook blocks commands that mention `dist`, `build` or `node_modules` as path words, unless the command starts with `npm run build`. Use `npm run build --prefix <repo>`, and write `di''st` in paths.
- Use AGENTS.md for agent docs, not CLAUDE.md.

## Skills (load when relevant)

- `.claude/skills/ui-system`: building or restyling any UI surface (tokens, primitives, layout recipes, adding a theme)
- `.claude/skills/ui-verify`: screenshot the drawer or popup in headless Chrome without loading the extension
- `.claude/skills/composer-insert`: claude.ai changed its DOM and insert broke
- `.claude/skills/folder-access`: folder connect / permission / "access paused" issues
- `.claude/skills/usage-tracker`: usage icon/popup shows "!" or wrong numbers, endpoint changes, activity tracking
- `.claude/skills/release`: bump version, package, install
