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
RELAY_PLIST="$HOME/Library/LaunchAgents/com.agentbrowse.relay.plist"

# Address the relay on :7862 is listening on ("127.0.0.1", "*", "[::1]", ...); empty if none.
relay_addr() {
  lsof -nP -iTCP:7862 -sTCP:LISTEN -Fn 2>/dev/null \
    | awk '/^n/{sub(/^n/,"");sub(/:7862$/,"");print;exit}'
}
is_loopback_addr() {
  case "$1" in
    127.0.0.1|\[::1\]|::1|localhost) return 0 ;;
    *) return 1 ;;
  esac
}

if [ ! -f "$FORK/manifest.json" ]; then
  echo "ERROR: no manifest.json at $FORK"; exit 1
fi

# Fail fast if the hardened build would not register (missing SW module).
if ! node "$FORK/hardened/check-sw-graph.mjs" "$FORK"; then
  echo "ERROR: service-worker import graph is broken — not launching."; exit 1
fi

# Assert the relay on :7862 is loopback-bound. A network-exposed relay (bind "*"
# or a non-loopback IP) means a fresh/unpatched relay won the port — e.g. after an
# npx cache wipe. Reclaim it for the hardened loopback relay before launching.
echo "Checking relay bind on :7862..."
ADDR="$(relay_addr)"
if [ -z "$ADDR" ]; then
  echo "  none listening — the LaunchAgent/MCP server will start one on demand. OK."
elif is_loopback_addr "$ADDR"; then
  echo "  bound to $ADDR — loopback. OK."
else
  echo "  WARNING: relay bound to '$ADDR' (network-exposed). Reclaiming for loopback..."
  PID=$(lsof -nP -iTCP:7862 -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && echo "  stopped exposed relay (pid $PID)"
  if [ -f "$RELAY_PLIST" ]; then
    launchctl kickstart -k "gui/$(id -u)/com.agentbrowse.relay" 2>/dev/null \
      || { launchctl unload "$RELAY_PLIST" 2>/dev/null; launchctl load "$RELAY_PLIST" 2>/dev/null; }
    echo "  kicked com.agentbrowse.relay to reclaim :7862"
  else
    echo "  NOTE: durable relay service not installed — run hardened/install-relay-service.sh"
  fi
  for _ in 1 2 3 4 5; do ADDR="$(relay_addr)"; [ -n "$ADDR" ] && break; sleep 1; done
  if is_loopback_addr "$ADDR"; then
    echo "  reclaimed — relay now bound to $ADDR."
  else
    echo "  WARNING: relay is '${ADDR:-none}', not loopback. An MCP host may be respawning"
    echo "           an unpatched relay — restart the durable service, or apply the stopgap"
    echo "           patch to the npx copy (see HARDENING.md). NOT launching Arc."
    exit 1
  fi
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
