#!/bin/bash
# Screenshot the built popup (dist/popup.html) with stubbed chrome APIs (popup-stub.js) in several states.
# Usage: pnpm build && bash .claude/skills/ui-verify/shoot-popup.sh   -> prints PNG paths
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
S=$(mktemp -d)
cp -R "$REPO/dist" "$S/pop" && cp "$HERE/popup-stub.js" "$S/pop/stub.js"
sed -i '' 's|<head>|<head><script src="/stub.js"></script>|' "$S/pop/popup.html"
(cd "$S/pop" && python3 -m http.server 8765 >/dev/null 2>&1 &)
sleep 1
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# state:query  (s = session %, err = show error banner, light = Claude Paper light, month = month tab, empty = loading)
# models = add a Sonnet weekly limit, settings = open the settings view
for v in "dark:x=1" "light:light=1" "high:s=86&models=1" "err:err=1&s=55" "month:month=1" "empty:empty=1" "settings:settings=1" "settings-light:settings=1&light=1"; do
  n=${v%%:*}; q=${v#*:}
  "$C" --headless=new --disable-gpu --hide-scrollbars --window-size=420,${H:-600} --virtual-time-budget=4000 \
    --screenshot="$S/pop-$n.png" "http://localhost:8765/popup.html?$q" >/dev/null 2>&1
done
pkill -f "http.server 8765"
ls "$S"/pop-*.png
