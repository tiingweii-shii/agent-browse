#!/bin/bash
# Launch Arc with the hardened Agent Browse extension loaded unpacked.
#
# WHY a wrapper: --load-extension is a per-launch flag. Arc drops it whenever it
# is started any other way (dock icon, Spotlight, self-relaunch on update). Use
# THIS script to start Arc whenever you want the hardened extension loaded.
#
# It loads the fork ALONGSIDE your normal profile and other extensions (it does
# NOT pass --disable-extensions-except, so nothing else is disabled). Make sure
# the Chrome Web Store copy of Hanzi Browse is disabled first (see HARDENING.md,
# step 1) — two copies fight over the single relay slot.
set -u

FORK="/Users/tingwei/Documents/GitHub/agent-browse"
ARC_BIN="/Applications/Arc.app/Contents/MacOS/Arc"

if [ ! -f "$FORK/manifest.json" ]; then
  echo "ERROR: no manifest.json at $FORK"; exit 1
fi

# Fail fast if the hardened build would not register (missing SW module).
if ! node "$FORK/hardened/check-sw-graph.mjs" "$FORK"; then
  echo "ERROR: service-worker import graph is broken — not launching."; exit 1
fi

# Gracefully quit any running Arc (the flag only takes effect on a fresh start).
if pgrep -f "Arc.app/Contents/MacOS/Arc" >/dev/null 2>&1; then
  echo "Quitting running Arc so the flag takes effect..."
  osascript -e 'tell application "Arc" to quit' >/dev/null 2>&1
  for _ in $(seq 1 15); do
    pgrep -f "Arc.app/Contents/MacOS/Arc" >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -f "Arc.app/Contents/MacOS/Arc" >/dev/null 2>&1; then
    echo "Arc did not quit gracefully; force-quitting..."
    pkill -f "Arc.app/Contents" >/dev/null 2>&1
    sleep 2
  fi
fi

echo "Launching Arc with hardened 'Agent Browse (hardened)'..."
nohup "$ARC_BIN" --load-extension="$FORK" >/dev/null 2>&1 &
disown
echo "Launched."
echo
echo "Reminders:"
echo "  • Keep the Web Store Hanzi Browse DISABLED (relay allows one extension)."
echo "  • Reopen Arc via THIS script to keep the hardened extension loaded."
echo "  • First run on a fresh unpacked ID has empty config — run:"
echo "      node $FORK/hardened/configure-extension.mjs"
