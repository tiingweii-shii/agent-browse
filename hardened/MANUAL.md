# Agent Browse — User Manual (hardened fork)

A private, hardened fork of [hanzi-browse](https://github.com/hanzili/hanzi-browse):
a browser-automation agent you drive from Claude, running in **your own Chrome
profile** with your logins. This manual covers day-to-day use, setup, and every
issue we hit getting it working — with the fix for each.

Companion docs: **`HARDENING.md`** (what was changed and why + security),
**`AGENT-PROFILE.md`** (dedicated-profile setup details).

---

## 1. What it is / how it fits together

```
  You, in Claude              Your Mac (localhost only)                 Your browser
 ┌───────────────┐   stdio   ┌──────────────┐   ws://127.0.0.1:7862  ┌──────────────────┐
 │ Claude Desktop│──────────▶│  MCP server  │──────────┐             │ Chrome "Agent    │
 │  or Claude    │           │ (the fork)   │          ▼             │ Browse" profile  │
 │  Code (CLI)   │           │ auto-starts →│      ┌────────┐  ◀────▶ │  + the extension │
 └───────────────┘           └──────────────┘      │ relay  │        │  (service worker)│
        │  "use agent browse to …"                  └────────┘        └──────────────────┘
        ▼                                              │ reads your Claude creds
   a browsing sub-agent                                ▼ (Keychain, local only)
   runs 5–30 steps in your Chrome                 api.anthropic.com
```

- **The extension** does the actual browsing — reads pages, clicks, types, screenshots — via the Chrome DevTools Protocol. It runs in one Chrome profile.
- **The relay** (`ws://127.0.0.1:7862`) is a local message router between the MCP server and the extension. It also reads your Claude credentials locally and proxies the LLM calls (so the extension never handles your token directly).
- **The MCP server** is what Claude Desktop / Claude Code launch; it auto-starts the relay.
- Everything is **loopback-only** — nothing listens on the network.

---

## 2. Daily use

1. Make sure the **Chrome "Agent Browse" profile** is open (that's where the agent works).
2. In Claude (Desktop or a `claude` CLI session in this project), just ask:
   > "Use agent browse to check my LinkedIn messages"
   > "Use agent browse to go to example.com and read the page"
3. Watch it run; it drives tabs in the Agent Browse profile.

That's it. The relay and MCP server start themselves.

---

## 3. First-time setup (or setting it up again)

See `AGENT-PROFILE.md` for the long version. Short version:

1. **Dedicated Chrome profile** named "Agent Browse" (keep only the logins you want the agent to have in it).
2. **Load the extension** — in that profile: `chrome://extensions` → **Developer mode** ON → **Load unpacked** → select this repo's root (`/Users/tingwei/Documents/GitHub/agent-browse`). It persists across restarts (dismiss the "developer mode extensions" nag).
3. **Configure it** — pin the extension, open its side panel once (so its worker connects to the relay), then:
   ```
   node hardened/configure-extension.mjs
   ```
   Expect `extensionConnected = true` → `config_saved: {"success":true}`.
4. **Log in** to the sites you want the agent to use.
5. **Test** — "use agent browse to read example.com". It should complete without timing out.

---

## 4. The golden rules (break these and it stops working)

1. **One copy of the extension, anywhere.** The relay serves exactly **one** extension at a time. A second live copy — in another Chrome profile, in Arc, or the old Web Store build — causes the two to evict each other in a loop (see Issue A). The agent lives **only** in the Chrome Agent Browse profile.
2. **Arc is your normal browser** — open it from the dock. It must **not** have the fork loaded. (Never use the old `--load-extension` / `launch-arc.sh` route; it loads browser-wide and reintroduces a second copy.)
3. **Don't "reload" the extension from `chrome://extensions` while using it.** If you need a fresh worker, close and reopen the profile instead. (Reloading can leave the old worker alive → two copies.)
4. **One browser context at a time.** The relay can't drive two browsers/profiles simultaneously — this is an upstream limitation, not a bug.

---

## 5. Known issues & fixes

Everything below was hit and solved during setup. If something breaks, find the symptom here.

### A. Console shows `WebSocket connected` → `disconnected` looping (~every 5s)
- **Meaning:** two extension copies are registering as `extension` and evicting each other (`WS_RECONNECT_DELAY_MS = 5000` is the cadence).
- **Cause:** a second live copy — another Chrome profile, **Arc still running with the fork**, or the old Web Store build.
- **Fix:** get down to one copy. Quit Arc entirely (`--load-extension` copies can't be disabled in the UI and only clear on quit). Confirm no other profile/browser has it. Only the Chrome Agent Browse profile should have it.
- **Note:** don't trust `extensionConnected = true` as an "it's fine" signal — it reads `true` even mid-flap (one of the two is always momentarily connected). **Judge from the service-worker console**, not from that.

### B. Task opens a tab in the *wrong* profile, then times out
- **Cause:** the extension is loaded in more than one profile; the copy that won the relay slot isn't the one whose window you're watching, and it can't drive a tab in a profile its worker doesn't own.
- **Fix:** same as A — one copy, in the Agent Browse profile only.

### C. LLM call fails immediately with `Failed to fetch`
- **Cause:** the extension is using the fresh-install default API URL (`http://127.0.0.1:8000`, the "ccproxy" default) because its config wasn't loaded.
- **Fix:** run `node hardened/configure-extension.mjs` (pushes the real `api.anthropic.com` config). This build reloads config immediately on push (`save_config → loadConfig`), so no manual extension reload is needed. If you're on an older build, reload the extension once after configuring.

### D. Task hangs for minutes, then times out (no `Failed to fetch`)
- **Cause:** the relay can't read your Claude Keychain credentials in its current process context — macOS shows (or silently blocks on) a *"node wants to use Claude Code-credentials"* Keychain prompt, and the dead native-host fallback stretches the stall to ~10 min.
- **Fix:** run the relay from a context authorized for your Keychain. In practice: **start the fork from a terminal `claude` session** (your terminal's Keychain access is what works), or when the *"node wants to use…"* prompt appears, click **Always Allow**. Verify your creds exist: `security find-generic-password -s "Claude Code-credentials" -w >/dev/null && echo readable`.

### E. Relay is listening on `*` instead of `127.0.0.1` (security)
- **Meaning:** the relay is network-exposed — any device on your LAN could read your Claude/Codex tokens. This is the upstream bug the fork fixes.
- **Check:** `lsof -nP -iTCP:7862 -sTCP:LISTEN` — the address must be `127.0.0.1`, never `*`.
- **Fix:** make sure the **fork's** relay is the one running (it binds loopback + screens origins), not a stray `npx hanzi-browse` one. See Issue G.

### F. Extension shows "service worker (Inactive)" and never connects (Web Store only)
- **Cause:** the Chrome Web Store build of v2.3.3 ships **without `src/tools/definitions.js`**, so the service worker never registers. This is why the fork exists.
- **Fix:** you're on the fork, which includes the file — this doesn't apply. To sanity-check any build: `node hardened/check-sw-graph.mjs` must print `OK — 44 modules resolve`.

### G. It "came back" / an unpatched relay reappeared after an update
- **Cause:** some MCP host is still launching `npx hanzi-browse`, which re-downloads a fresh (unpatched) copy.
- **Fix:** every MCP host must point at the fork, not npx:
  - **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` → the server's `command`/`args` should be `node .../agent-browse/server/dist/index.js` (quit Claude Desktop before editing — it rewrites the file).
  - **Claude Code:** `~/.claude.json` → `projects["<this project>"].mcpServers.browser` → same (edit with **no** `claude` session running — a live session rewrites it on exit).
  - Add `"env": { "DO_NOT_TRACK": "1", "HANZI_TELEMETRY": "0" }` to keep server telemetry off.
  - Once all hosts are on the fork, the npx cache can be deleted.

### H. Chrome re-downloaded the old Web Store "Hanzi Browse"
- **Cause:** deleting the extension's *files* but leaving Chrome's "enabled" preference makes Chrome reinstall it on next launch → a second copy (→ Issue A).
- **Fix:** remove it via `chrome://extensions` → **Remove** (clears the preference), not just by deleting files.

---

## 6. Maintenance & health checks

| Want to check… | Command |
|---|---|
| Extension graph is intact after an edit | `node hardened/check-sw-graph.mjs` → `OK — 44 modules resolve` |
| Relay is up and loopback-bound | `lsof -nP -iTCP:7862 -sTCP:LISTEN` → shows `127.0.0.1` |
| Relay is the fork (not npx) | `ps -o command= -p $(lsof -nP -iTCP:7862 -sTCP:LISTEN -t\|head -1)` → path contains `agent-browse` |
| Re-push config to the extension | open side panel, then `node hardened/configure-extension.mjs` |

**Pull upstream fixes (if it ever revives):**
```
git fetch upstream && git merge upstream/main
node hardened/check-sw-graph.mjs        # must still say OK
```
Then confirm the hardening survived the merge — grep for `hanzilla`, the Sentry DSN
(`ingest.us.sentry.io`), and the hackathon captcha URL; all should be absent or
neutralized. Rebuild the server if `server/src` changed: `cd server && npm install && npm run build`.

---

## 7. What's hardened (security summary)

Full detail in `HARDENING.md`. In brief, versus upstream:

- **Relay bound to loopback** (`127.0.0.1`) with a non-loopback-peer reject and an origin screen — closes the LAN credential-exfiltration hole (the most serious upstream issue).
- **No telemetry** — Sentry DSN removed from the extension; server telemetry disabled via env.
- **No third-party egress** — the hackathon captcha backend and the `api.hanzilla.co` managed-pairing path are neutralized; the on-page "Powered by Hanzi Browse" link is removed.
- **BYOM-local only** — your page content/screenshots go only to the LLM provider you configured (Anthropic), and the relay reads your Claude creds **locally** to make **your** calls. Nothing goes to any hosted service.

**Inherent risks to stay aware of** (not fixable by hardening): the extension has broad browser control (`<all_urls>` + debugger), and LLM-driven agents are susceptible to prompt-injection from hostile pages. Don't run it unattended on sensitive tabs, which is exactly why it lives in a dedicated, isolated profile.

---

## 8. Where things live

| Path | What |
|---|---|
| `src/` | the extension (unbundled service worker + content scripts) |
| `server/dist/index.js` | the MCP server (Claude launches this) |
| `server/dist/relay/server.js` | the relay (auto-started by the MCP server) |
| `hardened/MANUAL.md` | this file |
| `hardened/HARDENING.md` | what changed, why, and the security/deployment detail |
| `hardened/AGENT-PROFILE.md` | dedicated-profile setup steps |
| `hardened/configure-extension.mjs` | push BYOM config + telemetry-off to the extension |
| `hardened/check-sw-graph.mjs` | verify the service-worker import graph resolves |
