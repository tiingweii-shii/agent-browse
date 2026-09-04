#!/bin/bash
# Runs the hardened fork relay bound to loopback. Invoked by the LaunchAgent
# (com.agentbrowse.relay). Owning port 7862 means the npx MCP server's own relay
# defers to this one (EADDRINUSE → graceful exit), so the version-controlled,
# patched relay is what actually runs — surviving any npx cache wipe.
export WS_RELAY_HOST=127.0.0.1
FORK="/Users/tingwei/Documents/GitHub/agent-browse"

# launchd has no nvm shims — resolve a node binary explicitly.
NODE=""
for c in \
  "/Users/tingwei/.nvm/versions/node/v22.19.0/bin/node" \
  "$(command -v node 2>/dev/null)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node"; do
  [ -n "$c" ] && [ -x "$c" ] && NODE="$c" && break
done
[ -z "$NODE" ] && { echo "relay-service: node not found" >&2; exit 1; }

exec "$NODE" "$FORK/server/dist/relay/server.js"
