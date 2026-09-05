# Running the hardened extension — dedicated browser profile (supported method)

The relay accepts **one** extension at a time. The extension must therefore run
in exactly one browser profile. The reliable way to guarantee that is a dedicated
profile whose extension list is scoped to that profile.

**Do NOT use Arc `--load-extension`.** It loads the extension *browser-wide*, so
every Arc profile that's loaded spins up its own service worker; two of them then
register as `extension` and evict each other every `WS_RECONNECT_DELAY_MS` (5s) —
an endless connect→evict→reconnect flap. `--profile-directory` does not fix it
(Arc keeps other profiles' workers alive). `hardened/launch-arc.sh` is retired
for this reason.

## Recommended: a dedicated Chrome profile

Chrome's **Load unpacked** is *per-profile* (unlike the `--load-extension` CLI
flag), so only that one profile ever runs a worker. It also runs alongside your
normal Arc (different browser; no single-instance conflict).

1. **Dedicated profile.** Use a Chrome profile reserved for the agent (e.g.
   "Agent Browse"). Keep the agent's browsing — and only the logins you want it to
   have — in this profile.
2. **Load the fork into just this profile.** In that profile: `chrome://extensions`
   → **Developer mode** ON → **Load unpacked** → select this repo's root
   (`/Users/tingwei/Documents/GitHub/agent-browse`). "Agent Browse (hardened)"
   installs in this profile only, and persists across restarts (dismiss the
   dev-mode notice each launch).
3. **Only one copy anywhere.** Make sure the fork is not also loaded in Arc (or any
   other profile/browser) — two live copies = the relay eviction flap.
4. **Wake + configure.** Pin the extension, open its side panel once (so the worker
   connects to the relay), then:
   ```
   node hardened/configure-extension.mjs
   ```
   Expect `extensionConnected = true` → `config_saved: {"success":true}`.
5. **Log in** to the sites the agent should use, in this profile.
6. **Verify no flap.** In the extension's service-worker console you should see a
   single stable `WebSocket connected` / `Registered as legacy extension`, with no
   repeating `WebSocket disconnected` every ~5s.

The relay/credential path is machine-level (the relay reads your Claude creds
locally) and independent of the browser profile — see `HARDENING.md`.

## Alternative: dedicated Arc data dir

If you must stay in Arc, isolate with a separate `--user-data-dir` (one profile,
can't leak into others). Caveat: Arc is single-instance, so it can't run at the
same time as your main Arc.
```
AGENT_DIR="$HOME/Library/Application Support/ArcAgent"
mkdir -p "$AGENT_DIR"
osascript -e 'tell application "Arc" to quit'; sleep 3
"/Applications/Arc.app/Contents/MacOS/Arc" --user-data-dir="$AGENT_DIR" \
  --load-extension="/Users/tingwei/Documents/GitHub/agent-browse"
```
Fresh profile → log into your sites → `node hardened/configure-extension.mjs`.
