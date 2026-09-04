#!/bin/bash
# Durable switch: make the hardened fork relay the one that always runs.
# Installs a LaunchAgent that keeps the fork's loopback-bound relay owning 7862.
# Idempotent — safe to re-run (e.g. after a node upgrade or npx reinstall).
set -u

FORK="/Users/tingwei/Documents/GitHub/agent-browse"
PLIST_SRC="$FORK/hardened/com.agentbrowse.relay.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.agentbrowse.relay.plist"

# 1. Relay dependency (ws) must be installed in the fork's server package.
if [ ! -d "$FORK/server/node_modules/ws" ]; then
  echo "==> Installing fork relay deps (npm install in server/) ..."
  (cd "$FORK/server" && npm install) || { echo "npm install failed"; exit 1; }
fi

# 2. Smoke-test the fork relay on a scratch port (don't disturb 7862 yet).
echo "==> Smoke-testing fork relay on :7999 ..."
WS_RELAY_PORT=7999 WS_RELAY_HOST=127.0.0.1 "$FORK/hardened/relay-service.sh" >/tmp/agentbrowse-relay-smoke.log 2>&1 &
SMOKE=$!
sleep 1
if lsof -nP -iTCP:7999 -sTCP:LISTEN 2>/dev/null | grep -q '127.0.0.1'; then
  echo "    OK — binds 127.0.0.1"
else
  echo "    WARNING: relay did not bind loopback on :7999 — see /tmp/agentbrowse-relay-smoke.log"
fi
kill "$SMOKE" 2>/dev/null

# 3. Install + (re)load the LaunchAgent.
echo "==> Installing LaunchAgent ..."
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null

# Free 7862 from any currently-running (npx) relay so the agent can claim it.
OLD=$(lsof -nP -iTCP:7862 -sTCP:LISTEN -t 2>/dev/null | head -1)
[ -n "$OLD" ] && { echo "    stopping existing relay (pid $OLD)"; kill "$OLD" 2>/dev/null; sleep 1; }

launchctl load "$PLIST_DST"
sleep 1

echo "==> Result:"
lsof -nP -iTCP:7862 -sTCP:LISTEN 2>/dev/null | awk 'NR==1||/node/{print}'
echo
echo "Done. The hardened fork relay now owns 127.0.0.1:7862 and restarts at login."
echo "Verify anytime:  lsof -nP -iTCP:7862 -sTCP:LISTEN   (should show 127.0.0.1, never *)"
echo "Logs:            ~/Library/Logs/agent-browse-relay.log"
echo "Uninstall:       launchctl unload $PLIST_DST && rm $PLIST_DST"
