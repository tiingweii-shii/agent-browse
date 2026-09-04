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
- **Least-privilege manifest:** see the list above (unused permissions).

## Relay security (done)

The relay bound to `0.0.0.0` with no auth — any LAN device could register as the
"extension" and read Claude/Codex OAuth tokens via `read_credentials`. Fixed in
`server/src/relay/server.ts` (+ committed `server/dist/relay/server.js`): loopback
bind (`127.0.0.1`, override `WS_RELAY_HOST`), non-loopback peers rejected at
connect, and a `verifyClient` origin screen (node clients + `chrome-extension://`
allowed; http/https web origins rejected).

**Deployment — the fix only helps in what RUNS.** The relay is normally launched
by the npx MCP server (`~/.npm/_npx/.../hanzi-browse/dist/relay/server.js`), not
the fork. Two-tier approach:

1. **Stopgap** — the same patch was applied to the live npx copy. Wiped if the npx
   cache is cleared/reinstalled.
2. **Durable** — a LaunchAgent runs the fork's patched relay and keeps it owning
   `127.0.0.1:7862`, so the npx relay always defers to it (EADDRINUSE → exits).
   Install once:
   ```
   bash hardened/install-relay-service.sh
   ```
   (Installs `ws` if needed, smoke-tests, loads `com.agentbrowse.relay`.) It starts
   at login and restarts on crash. Verify: `lsof -nP -iTCP:7862 -sTCP:LISTEN` shows
   `127.0.0.1`, never `*`. Uninstall:
   `launchctl unload ~/Library/LaunchAgents/com.agentbrowse.relay.plist && rm ~/Library/LaunchAgents/com.agentbrowse.relay.plist`.

   Caveat: if a fresh (post-wipe) npx relay ever grabs 7862 before the agent, it'd
   be unpatched — re-run the installer to reclaim the port. Zero-code backstop:
   block inbound TCP 7862 at the macOS firewall.
