---
name: folder-access
description: How Claude Sidecar gets read/write access to the local prompt folder (File System Access API) and how to debug it. Use for "Reconnect folder", "Folder access expired", changing the root folder, or file read/write errors.
---

# Folder access

## Model

- `src/options.tsx` calls `showDirectoryPicker({ mode: 'readwrite' })`. The resulting handle is stored in the extension-origin IndexedDB (`sidecar` db, `kv` store, key `root`) through `src/handle.ts`.
- `src/background.ts` (service worker) loads the handle and calls `queryPermission`. It only proceeds when the result is `granted`. A worker can't call `requestPermission`, which needs a window plus a user gesture.
- After a browser restart Chrome may reset the permission to `prompt`. The drawer then shows "Reconnect", which opens the settings page, which calls `requestPermission`. If the user picks **"Allow on every visit"** in Chrome's prompt, the permission persists.
- The settings page writes `rootName` to `chrome.storage.local` after connecting. Open drawers listen for that key and reload.
- The browser API never exposes the full disk path, only `handle.name`. That's why Settings shows a folder name and "Change folder" instead of a path input.

## Debugging

- Open the service worker console from `chrome://extensions` → Claude Sidecar → "service worker". To inspect the stored handle, run `chrome.runtime.sendMessage({ type: 'status' })` from the settings page console. The reply shows `state` and `name`.
- Run `pnpm build` and reload the extension. The handle survives reloads but not an uninstall.
- Writes go through `createWritable()`, which replaces the file atomically on close. A rename writes the new path first, then deletes the old one. On case-insensitive volumes, a case-only rename keeps the old filename so the file isn't deleted.

## Known ceiling

If Chrome ever stops exposing `FileSystemHandle` to extension service workers, move the file operations into an offscreen document (`chrome.offscreen`) and keep the message protocol in `src/api.ts` unchanged.
