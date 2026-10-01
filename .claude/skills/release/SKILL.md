---
name: release
description: Version bump, package and install Claude Sidecar. Use when asked to release, package, ship, bump the version or produce a zip.
---

# Release

1. Bump the version. `package.json` is the only source of truth:
   ```bash
   pnpm version patch --no-git-tag-version   # or minor / major
   ```
2. Package:
   ```bash
   pnpm package
   ```
   This typechecks, builds, and writes `releases/ClaudeSidecar-v{version}-{dd.mm}.zip`. The zip contains one folder, and the manifest version is injected at build time.
3. Install or update: unzip, open `chrome://extensions`, turn on Developer mode, then "Load unpacked" and choose the unzipped folder. To update an existing install, replace the folder and hit reload.
4. Commit with a conventional title, e.g. `chore(release): v0.2.0`, plus a bullet body.

`releases/` is gitignored. Share zips directly.
