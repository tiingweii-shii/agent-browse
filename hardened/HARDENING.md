# Hardened build — what changed & how to switch over

A private, egress-reduced, auto-update-frozen build of the extension, loaded
unpacked into Arc. Goal: no data leaves your machine except to the LLM provider
you configured, and no code changes under you without your review.

## What was changed (vs upstream)

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `src/background/modules/error-reporter.js` | `SENTRY_DSN` set to `''` | Kills the extension's own Sentry error telemetry (default-on; NOT covered by the npm `telemetry off`). Empty DSN ⇒ `dsn` stays `null` ⇒ every send path short-circuits. |
| 2 | `src/background/modules/captcha-solvers.js` | `bruteForceSolver` returns failure before any network call | Removes egress of challenge data to a third-party hackathon Cloud Run backend. Export kept so the SW import graph still resolves. |
| 3 | `src/background/modules/mcp-bridge.js` | `managed_pair` case refuses without fetching | Removes pairing/task routing through Hanzi's hosted service (`api.hanzilla.co`). This build is BYOM-local only. |
| 4 | `manifest.json` | name → `Agent Browse (hardened)` | So you can tell this build apart from the Web Store copy in the extensions list. (chrome.storage is keyed by ID/path, not name — safe.) |

The missing-file bug (`src/tools/definitions.js`) that breaks the Web Store 2.3.3
build does **not** affect this fork — the file is present. Verified:

```
$ node hardened/check-sw-graph.mjs
OK — 44 modules resolve
```

### Egress paths intentionally left as-is (not leaks)
- LLM calls to your configured provider (`api.anthropic.com`) and OAuth token
  refresh (`console.anthropic.com`) — the whole point of the tool.
- The `ccproxy` path and the legacy embed pairing default to `localhost` — no
  external egress unless you explicitly point them off-box.

## Switchover — one time

1. **Disable the Web Store copy.** `arc://extensions` → turn OFF (or Remove)
   "Hanzi Browse". The relay accepts only ONE extension; two copies flap.
2. **Launch Arc with the hardened build:**
   ```
   bash /Users/tingwei/Documents/GitHub/agent-browse/hardened/launch-arc.sh
   ```
   (Quits Arc, verifies the SW graph, relaunches with `--load-extension`.)
3. **Approve it.** Arc may show a "developer mode extension" notice — keep it
   enabled. Confirm "Agent Browse (hardened)" appears and is ON.
4. **Wake + configure.** Open the side panel once (wakes the service worker so it
   connects to the relay), then:
   ```
   node /Users/tingwei/Documents/GitHub/agent-browse/hardened/configure-extension.mjs
   ```
   Expect `extensionConnected = true` → `config_saved: {"success":true}`.
5. **Verify.** Run a trivial task; confirm the relay shows the extension connected
   and an LLM call succeeds.

## Every time after

- Reopen Arc via `hardened/launch-arc.sh` — **not** the dock icon. `--load-extension`
  is per-launch; a normal start drops it (and re-enables nothing external).
- If Arc self-relaunches after an update, run the script again.

## Staying current with upstream (optional)

Upstream is dormant, but if it revives:
```
git fetch upstream && git merge upstream/main   # review the diff
node hardened/check-sw-graph.mjs                 # must print OK
```
Re-check that patches 1–3 survived the merge (grep for `hanzilla`, the Sentry DSN,
and the hackathon URL — all should be absent/neutralized).

## Optional next hardening (not done — behavior risk)
- **Least-privilege manifest:** candidates to drop if unused in your flow —
  `nativeMessaging` (relay reads creds from disk now), `identity`, `downloads`,
  `tabGroups`. Test after removing each; some providers/flows rely on them.

## Relay security (done)

The relay bound to `0.0.0.0` with no auth — any LAN device could register as the
"extension" and read Claude/Codex OAuth tokens via `read_credentials`. Fixed in
`server/src/relay/server.ts` (+ committed `server/dist/relay/server.js`): loopback
bind (`127.0.0.1`, override `WS_RELAY_HOST`), non-loopback peers rejected at
connect, and a `verifyClient` origin screen (node clients + `chrome-extension://`
allowed; http/https web origins rejected).

**Deployment — the fix only helps in what RUNS.** The relay is a singleton on
`:7862`, launched by whichever MCP HOST starts first — not a standalone service.
On this machine the hosts are Claude Desktop and the Claude Code project `browser`
MCP server. The relay binary they run is the npx build
(`~/.npm/_npx/.../hanzi-browse/dist/relay/server.js`), not the fork. Two tiers:

1. **Stopgap** — the same patch was applied to the live npx copy. Closes the hole
   now, but is wiped if the npx cache is cleared/reinstalled.
2. **Durable — repoint each host to the fork.** Change every MCP host's server
   from `npx hanzi-browse` to the fork build, so the host launches the fork's
   patched relay itself. Requires `server/node_modules` (`cd server && npm install`
   once). Set the server to:
   ```
   command: <abs path to node>       # e.g. process.execPath of your node
   args:    [ ".../agent-browse/server/dist/index.js" ]
   env:     { "DO_NOT_TRACK": "1", "HANZI_TELEMETRY": "0" }
   ```
   - **Claude Desktop:** edit `~/Library/Application Support/Claude/claude_desktop_config.json`
     (`mcpServers.hanzi-browser`). Quit Claude Desktop first — it live-rewrites the file.
   - **Claude Code:** edit `~/.claude.json` (`projects["<project>"].mcpServers.browser`).
     Do this with NO `claude` session running — a live session rewrites the file on exit.
   Verify the fork relay owns the port:
   ```
   P=$(lsof -nP -iTCP:7862 -sTCP:LISTEN -t | head -1)
   lsof -nP -iTCP:7862 -sTCP:LISTEN            # address must be 127.0.0.1
   ps -o command= -p "$P" | grep agent-browse && echo FORK
   ```
   Once every host is repointed AND verified, the npx copy is unused and can be
   deleted (`rm -rf ~/.npm/_npx/<hash>` — guard on `node_modules/hanzi-browse`).

`launch-arc.sh` also asserts the relay is loopback on every Arc start and
reclaims/fails-closed if not — a backstop against an unpatched relay slipping in.
Zero-code backstop for the exposure itself: block inbound TCP 7862 at the macOS
firewall.

> A LaunchAgent that ran the fork relay standalone was tried and abandoned: macOS
> TCC blocks a launchd agent from executing a script under `~/Documents`, and a
> standalone relay loses the port race to the host-supervised one. Repointing the
> hosts is the deterministic fix.
