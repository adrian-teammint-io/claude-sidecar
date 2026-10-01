---
name: ui-verify
description: Visually verify the Claude Sidecar drawer (mock claude.ai page) or toolbar popup (stubbed usage data) by screenshotting them in headless Chrome. Use after UI or style changes, or to reproduce a render bug without loading the extension.
---

# UI verify

`mock.html` (next to this file) loads `content.js` into a fake claude.ai page. The page has a ProseMirror composer, a stubbed `chrome.runtime` / `chrome.storage`, and five sample prompts. It shows errors as `<pre id="e">`.

The URL hash picks the state to render: `list`, `settings`, `vars`, `edit`, `insert` (clicks a prompt, so check that the composer text was replaced), `trigger` (types `;;` mid-text and picks a prompt; the composer should read `fix this: Explain error… please`), `empty` (no folder connected), `light` (Claude Paper theme in light mode).

```bash
pnpm build
S=$(mktemp -d); cp dist/content.js .claude/skills/ui-verify/mock.html $S/
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for m in list settings vars edit insert trigger empty light; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1280,860 --force-dark-mode \
    --allow-file-access-from-files --virtual-time-budget=8000 --screenshot=$S/$m.png "file://$S/mock.html#$m"
done
# errors:
"$CHROME" --headless=new --allow-file-access-from-files --virtual-time-budget=3000 --dump-dom "file://$S/mock.html#vars" | grep -o '<pre id="e">[^<]*'
```

Then open the PNGs with the Read tool.

## Popup

```bash
pnpm build && bash .claude/skills/ui-verify/shoot-popup.sh
```

The script serves a copy of the build output over `localhost:8765`, because the popup's assets use absolute paths and so `file://` won't work. It injects `popup-stub.js`, which provides fake `usageState`, 30 days of activity and settings. It writes PNGs for six states: `dark`, `light`, `high` (86%, red), `err` (warning banner), `month`, and `empty` (skeletons). Change the query strings in the script to try other values.

Shell tip: a PreToolUse hook treats the first line of any heredoc in a Bash command as a commit message and blocks the command. Write helper files with the Write tool and run them as scripts.

- Use `--virtual-time-budget=8000`. Shorter budgets can capture the drawer mid-transition, so it looks faded or half-closed even though the state is correct.
- For readable stacks, run `pnpm build -- --minify false`. It only affects the content build.
- This doesn't exercise the real file system or real claude.ai DOM. For those, load the extension unpacked.
