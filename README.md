# Claude Sidecar

Chrome extension for claude.ai: a prompt library drawer backed by a local folder of `.md` files, plus a toolbar popup for plan usage. Agent/dev docs live in [AGENTS.md](AGENTS.md).

## Prompt features

- Type `;;` in the chat box to open the library; the chosen prompt replaces the `;;`.
- Variables: `{{name}}`, `{{name=default}}`, or `{{name|a|b|c}}` for a dropdown (first option is the default).
- Pin a prompt (pin button, or `pinned: true` in frontmatter) to keep it on top. The rest sort by most recently inserted.

## TODO

- [ ] **Export a chat to `.md`** in the prompt folder (or a sibling folder in the same Obsidian vault).
  - Fetch the conversation via `/api/organizations/{org}/chat_conversations/{id}` through the existing `fetchJson` path, and write it with the worker's file ops.
  - Summaries: reuse the `/summarize` Claude Code skill on the exported file, so chat notes land next to the CCSummarizations notes in the same format. The extension can't run Claude Code itself, so the export is the hand-off point. To summarize inside claude.ai instead, use a library prompt (e.g. "Summarize this chat as…") inserted before export.
  - Open question: raw transcript, summary only, or both in one note.
- [ ] **Save selection/message as a prompt**: a button on a selected passage or chat message opens the editor pre-filled with that text.
