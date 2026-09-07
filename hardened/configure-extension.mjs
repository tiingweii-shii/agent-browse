// One-shot configuration for a freshly-loaded hardened Agent Browse extension.
//
// A load-unpacked extension gets a new extension ID (derived from its path), so
// its chrome.storage.local starts empty. This pushes the BYOM-local config over
// the relay (same mcp_save_config path the CLI setup wizard uses) and disables
// the extension's own error telemetry.
//
// Prereq: the hardened extension must be loaded in Arc and connected to the relay
// (open the side panel once to wake the service worker). Run:  node hardened/configure-extension.mjs

const RELAY = 'ws://localhost:7862';
const CONFIG = {
  provider: 'anthropic',
  apiBaseUrl: 'https://api.anthropic.com/v1/messages',
  authMethod: 'oauth',
  model: 'claude-sonnet-4-5-20250929',
  onboarding_completed: true,
  onboarding_version: 2,
  maxSteps: 30,
  maxTokens: 8000,
  telemetry_enabled: false, // hardened build has no DSN anyway; belt-and-suspenders
  taskLogRetentionDays: 14, // auto-delete Downloads/browser-agent/* logs older than this; 0 = keep forever
};

// Prefer Node's built-in WebSocket (Node 22+); fall back to the npx-cached ws module.
let WS = globalThis.WebSocket;
if (!WS) {
  const candidates = [
    '/Users/tingwei/.npm/_npx/069b4c9a1e8aa26c/node_modules/ws/index.js',
    '/Users/tingwei/.npm/_npx/668c188756b835f3/node_modules/ws/index.js',
  ];
  for (const p of candidates) {
    try { WS = (await import(p)).default.WebSocket; if (WS) break; } catch {}
  }
}
if (!WS) { console.error('No WebSocket available (need Node 22+ or the ws module).'); process.exit(5); }

const ws = new WS(RELAY);
const reqId = 'cfg_' + Date.now();
let done = false;
const bail = (code, msg) => { console.log(msg); process.exit(code); };
setTimeout(() => { if (!done) bail(2, 'TIMEOUT: no response in 12s'); }, 12000);

ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'register', role: 'cli' })));
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
  if (m.type === 'registered') {
    ws.send(JSON.stringify({ type: 'status_query', requestId: 'q1' }));
  } else if (m.type === 'status_response') {
    console.log('extensionConnected =', m.extensionConnected);
    if (!m.extensionConnected) bail(3, 'No extension connected — load the hardened build in Arc and open its side panel first.');
    ws.send(JSON.stringify({ type: 'mcp_save_config', requestId: reqId, payload: CONFIG }));
    console.log('sent mcp_save_config with keys:', Object.keys(CONFIG).join(', '));
  } else if (m.type === 'config_saved' && m.requestId === reqId) {
    done = true;
    console.log('config_saved:', JSON.stringify({ success: m.success, error: m.error || null }));
    ws.close(); process.exit(m.success ? 0 : 1);
  }
});
ws.addEventListener('error', (e) => bail(4, 'WS error: ' + (e.message || 'connection failed')));
