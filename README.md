<div align="center">

[English](README.md) | [中文](docs/zh/README.md)

<img src="docs/logo.svg" width="80" alt="Agent Browse" />

# Agent Browse

**The context layer for browsing agents.**

Your browsing agent keeps failing on real sites — X uses Draft.js, LinkedIn hides the<br/>
connect button, Gmail needs keyboard shortcuts. Agent Browse ships 24 site playbooks —<br/>
**hints for the LLM, not brittle scripts** — so it actually finishes the task.

[![License](https://img.shields.io/badge/license-PolyForm%20NC-green)](LICENSE)

**Works with** Claude Code · Cursor · Codex · Gemini CLI · VS Code · Kiro · Antigravity · OpenCode

</div>

<br/>

> **This is a private, hardened fork** of [hanzi-browse](https://github.com/hanzili/hanzi-browse):
> telemetry removed, hosted-service egress removed, relay bound to loopback, auto-update
> frozen. It runs **BYOM-local only** — page content and screenshots go only to the LLM
> provider you configure. See [`hardened/MANUAL.md`](hardened/MANUAL.md) for day-to-day use
> and [`hardened/HARDENING.md`](hardened/HARDENING.md) for exactly what changed and why.

<br/>

## Two ways to use Agent Browse

Same 24 site playbooks underneath. Two paths depending on who's driving.

### For your agent — a browser sub-agent for your coding agent

`npx hanzi-browse setup` detects every AI agent on your machine (Claude Code, Cursor, Codex, and more) and wires Agent Browse in as an MCP tool. Your main agent delegates browser work; a sub-agent runs the loop — *read page → plan next action → click/type/scroll → observe → repeat until done* — and returns a clean answer. Site playbooks auto-load by URL so the model already knows the quirks.

![Use it now](docs/diagrams/use-it.svg)

### For your product — browser automation for your users, described in English

Your backend calls `runTask({ task: "…" })`. Your users' own Chrome executes it, signed in as themselves. Same 24 playbooks as the CLI, exposed as a REST API and the `@hanzi-browse/sdk` TypeScript client. (The hosted endpoint is disabled in this fork — self-host the server under `server/` to use this path.)

![Build with it](docs/diagrams/build-with-it.svg)

<br/>

## Get Started

```bash
npx hanzi-browse setup
```

One command does everything:

```
npx hanzi-browse setup
│
├── 1. Detect browsers ──── Chrome, Brave, Edge, Arc, Chromium
│
├── 2. Install extension ── Load the built extension unpacked
│
├── 3. Detect AI agents ─── Claude Code, Cursor, Codex, Windsurf,
│                           VS Code, Gemini CLI, Amp, Cline, Roo Code
│
├── 4. Configure MCP ────── Merges hanzi-browse into each agent's config
│
├── 5. Install skills ───── Copies browser skills into each agent
│
└── 6. Choose AI mode ───── BYOM (use your own model / key)
```

**BYOM** — use your Claude Pro/Max subscription, GPT Plus, or any API key. Runs locally; no data leaves your machine except calls to the provider you configured.

> For the hardened dedicated-profile setup this fork is built around, follow
> [`hardened/MANUAL.md`](hardened/MANUAL.md) §3 instead of the wizard.

<br/>

## Examples

```
"Go to Gmail and unsubscribe from all marketing emails from the last week"
"Apply for the senior engineer position on careers.acme.com"
"Log into my bank and download last month's statement"
"Find AI engineer jobs on LinkedIn in San Francisco"
```

<br/>

## Skills

Installed automatically during `npx hanzi-browse setup`. Your agent reads these as markdown files — each one teaches the agent *when* and *how* to use the browser for a specific workflow.

| Skill | Description |
|-------|-------------|
| `agent-browse` | Core skill — when and how to use browser automation |
| `e2e-tester` | Test your app in a real browser, report bugs with screenshots |
| `social-poster` | Draft per-platform posts, publish from your signed-in accounts |
| `linkedin-prospector` | Find prospects, send personalized connection requests |
| `a11y-auditor` | Run accessibility audits in a real browser |
| `data-extractor` | Extract structured data from websites into CSV/JSON |
| `x-marketer` | Twitter/X marketing workflows |

Skills live in [`server/skills/`](server/skills/) — add your own by dropping in a `SKILL.md`.

### Site Playbooks — the context layer

Both CLI and SDK rely on a shared set of **site playbooks** — verified interaction recipes for complex websites. They teach the LLM how async loading works on X, which selector hides LinkedIn's connect button, that Gmail responds to keyboard shortcuts, and how to sidestep anti-bot detection on ~20 other sites.

**Hints for the LLM, not brittle scripts.** The model stays in control; we just hand it the cheat sheet. When the DOM shifts, the agent adapts — no adapter to rebuild.

**Currently supports 24 sites:** X, LinkedIn, Gmail, GitHub, Notion, Figma, Slack, Reddit, Amazon, eBay, Walmart, Target, Zillow, Apartments.com, Craigslist, Indeed, Google Docs, Sheets, Calendar, Drive, ChatGPT, Claude.ai, Stack Overflow.

All playbooks live in [`server/src/agent/domain-skills.json`](server/src/agent/domain-skills.json) as a single shared JSON array. To add a site, append a `{ domain, skill }` entry.

<br/>

## SDK

Embed browser automation in your product. Your app calls the API, a real browser executes the task, you get the result back. This fork's hosted endpoint is disabled — point the SDK at your own deployment of `server/`.

```typescript
import { HanziClient } from '@hanzi-browse/sdk';

const client = new HanziClient({ apiKey: process.env.HANZI_API_KEY, baseUrl: 'https://your-deployment.example.com' });

const { pairingToken } = await client.createPairingToken();
const sessions = await client.listSessions();

const result = await client.runTask({
  browserSessionId: sessions[0].id,
  task: 'Read the patient chart on the current page',
});
console.log(result.answer);
```

[Sample integration](examples/partner-quickstart/)

<br/>

## Tools

| Tool | Description |
|------|-------------|
| `browser_start` | Run a task. Blocks until complete. |
| `browser_message` | Send follow-up to an existing session. |
| `browser_status` | Check progress. |
| `browser_stop` | Stop a task. |
| `browser_screenshot` | Capture current page as image. |

<br/>

## Development

**Prerequisites:** [Node.js 18+](https://nodejs.org/), [Docker Desktop](https://docs.docker.com/get-docker/) (must be running before `make fresh`).

### First time (local setup)

```bash
git clone https://github.com/hanzili/hanzi-browse
cd hanzi-browse
make fresh
```

Performs full setup: installs deps, builds server/dashboard/extension, starts Postgres, runs migrations, and launches the dev server (~90s).

### Run the project

```bash
make dev
```

Starts the backend services (Postgres + migrations + API server) and serves the dashboard UI.
- API: http://localhost:3456
- Dashboard (requires Google OAuth): http://localhost:3456/dashboard

### Configuration

The defaults in `.env.example` are enough to run the server.

Optional services:
- **Google OAuth** (dashboard sign-in) -- add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to `.env`
- **Vertex AI** (managed task execution) -- see `.env.example` for setup steps

### Load the extension

Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the project root (the folder that contains `manifest.json`).

### Verify everything works

After `make dev` is running and the extension is loaded:

```bash
# In a separate terminal:
node server/dist/cli.js start "Go to example.com and tell me the page title"
```

You should see a Chrome window open, the agent navigate to example.com, and return the page title. If this works, the relay + extension + agent loop are all connected.

### Notes

- **Local vs CLI usage** -- `npx hanzi-browse setup` is for packaged usage and may not work in a local clone
- **Port conflicts** -- if you see `EADDRINUSE` on `3456`, stop existing processes or run `make stop`

### Commands

| Command | What it does |
|---------|-------------|
| `make fresh` | Full first-time setup (deps + build + DB + start) |
| `make dev` | Start everything (DB + migrate + server) |
| `make build` | Rebuild server + dashboard + extension |
| `make stop` | Stop Postgres |
| `make clean` | Stop + delete database volume |
| `make check-prereqs` | Verify Node 18+ and Docker are available |
| `make help` | Show all commands |

<br/>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

<br/>

## Privacy

This fork runs **BYOM-local only**. No data is sent to any hosted service — screenshots and page content go only to the AI provider you configure. [Read the privacy policy](PRIVACY.md).

<br/>

## License

[Polyform Noncommercial 1.0.0](LICENSE)
