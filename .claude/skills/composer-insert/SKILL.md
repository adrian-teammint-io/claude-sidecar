---
name: composer-insert
description: Fix or change how Claude Sidecar inserts a prompt into the claude.ai chat box. Use when insert stops working, "Chat box not found" appears, text lands without line breaks, or auto-send is requested.
---

# Composer insert

All logic is in `src/content/insert.ts`.

## How it works

1. Finds the composer with the first matching selector in `SELECTORS`, in order: ProseMirror contenteditable, `data-testid="chat-input"`, any contenteditable inside a fieldset, then a textarea.
2. Selects all of its content and dispatches a synthetic `paste` carrying `text/plain`. ProseMirror handles paste natively and turns `\n` into paragraphs.
3. If the resulting `innerText` doesn't match, it falls back to `document.execCommand('insertText')`.
4. Textareas use the native value setter plus an `input` event so React state updates.

## When claude.ai changes

1. On claude.ai, open DevTools and inspect the composer. Note its tag, `contenteditable` and any `data-testid`.
2. Put the new selector first in `SELECTORS`. Keep the old ones as fallbacks.
3. Paste this in the console to check it before rebuilding: `document.querySelector('<selector>')`.
4. Run `pnpm build`, reload the extension, refresh claude.ai and insert a multi-line prompt.

## Auto-send (not enabled yet)

After inserting, wait one frame, then click `button[aria-label*="Send"]`, or dispatch Enter `keydown` on the editor. Gate it behind a per-prompt setting or a global setting; the user asked for no auto-send in v1.
