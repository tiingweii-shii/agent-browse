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
| 5 | `src/background/managers/log-retention.js` (new) + `service-worker.js` wiring + `modules/constants.js` | Auto-deletes task-log folders (Store 3) older than `taskLogRetentionDays` | Upstream writes one folder per task run to `~/Downloads/browser-agent/` via `chrome.downloads` and never deletes them — an unbounded on-disk record of every page the agent touched. See [Task-log retention](#task-log-retention-store-3). |

The missing-file bug (`src/tools/definitions.js`) that breaks the Web Store 2.3.3
build does **not** affect this fork — the file is present. Verified:

```
$ node hardened/check-sw-graph.mjs
OK — 45 modules resolve
```

### Egress paths intentionally left as-is (not leaks)
- LLM calls to your configured provider (`api.anthropic.com`) and OAuth token
  refresh (`console.anthropic.com`) — the whole point of the tool.
- The `ccproxy` path and the legacy embed pairing default to `localhost` — no
  external egress unless you explicitly point them off-box.

## Switchover — run the extension in a dedicated profile

**See `hardened/AGENT-PROFILE.md` for the full steps.** In short: the relay accepts
only ONE extension, so the fork must run in exactly one browser profile. Use a
dedicated **Chrome profile** and `chrome://extensions` → Developer mode → **Load
unpacked** → this repo root. Chrome's Load-unpacked is per-profile, so only that
profile runs a worker; it persists across restarts and runs alongside your Arc.
Then open the side panel once and `node hardened/configure-extension.mjs`, log into
the sites you need, and remove any other copy of the extension (Web Store build,
Arc `--load-extension`) so nothing competes for the relay slot.

> **Retired: `hardened/launch-arc.sh` and Arc `--load-extension`.** Arc loads the
> extension browser-wide, so multiple profiles' workers register as `extension` and
> evict each other every ~5s (`WS_RECONNECT_DELAY_MS`) — an endless flap.
> `--profile-directory` does not fix it. Use the dedicated-profile method above.

## Task-log retention (Store 3)

`saveTaskLogs()` writes one folder per task run to the browser's Downloads dir:

```
~/Downloads/browser-agent/<timestamp>-<sessionId>/log.json          # full turn-by-turn history, AI text, tool results, token usage
~/Downloads/browser-agent/<timestamp>-<sessionId>/screenshot_N.png
```

Upstream never deletes these. This build sweeps them:

- **`src/background/managers/log-retention.js`** — a `chrome.alarms` job (daily, plus
  once ~1 min after each service-worker start, plus opportunistically after each
  task) that calls `chrome.downloads.removeFile` + `erase` on every task-log file
  whose `startTime` is older than the retention window. Strict filename regex
  (`browser-agent/<folder>/log.json` or `screenshot_N.png`) so it can't touch an
  unrelated download. Opportunistic runs are throttled to once per 6 h.
- **Setting:** `taskLogRetentionDays` in `chrome.storage.local`
  (pushed by `hardened/configure-extension.mjs`, default **14**). `0` = keep
  forever (sweep disabled). Unset/invalid → 14.
- **`chrome.downloads.removeFile` deletes permanently** — files do **not** go to
  the Trash.

**Limitation:** `chrome.downloads` can delete files, not directories, and can only
see files it still has a history record for. So empty `browser-agent/<folder>/`
dirs are left behind, and if you clear Chrome's download history the extension
can no longer find older files. **`hardened/prune-task-logs.sh`** is the
filesystem-side backstop — it removes whole folders older than N days (by mtime)
and clears leftover empty dirs. Run it by hand, or from `cron`/`launchd`:

```
hardened/prune-task-logs.sh 14              # delete folders older than 14 days
hardened/prune-task-logs.sh 14 --dry-run    # preview
RETENTION_DAYS=30 hardened/prune-task-logs.sh
```

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
  `nativeMessaging` (relay reads creds from disk now), `identity`, `tabGroups`.
  Test after removing each; some providers/flows rely on them. (`downloads` and
  `alarms` are now used by the task-log retention sweep — keep them.)

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

To spot-check the relay is loopback at any time: `lsof -nP -iTCP:7862 -sTCP:LISTEN`
should show `127.0.0.1`, never `*`. Zero-code backstop for the exposure itself:
block inbound TCP 7862 at the macOS firewall.

> A LaunchAgent that ran the fork relay standalone was tried and abandoned: macOS
> TCC blocks a launchd agent from executing a script under `~/Documents`, and a
> standalone relay loses the port race to the host-supervised one. Repointing the
> hosts is the deterministic fix.
