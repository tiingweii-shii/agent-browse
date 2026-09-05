---
name: agent-browse
description: Delegates a browsing task to a sub-agent running in the USER'S OWN Chrome — the browser they have open right now, already signed into everything. Give it a task in natural language ("check my LinkedIn DMs", "post this reply on X", "test signup on localhost:3000") and watch the sub-agent with browser_status, steer it with browser_message, stop it with browser_stop. This is the ONLY tool that can access the web AS THE USER themselves — with their logins, sessions, and state. Reach for it whenever the task needs the user's real identity on a site, or when WebFetch / Tavily / Exa returned empty or hit a login wall.
category: core
---

# Agent Browse

You're not driving the browser directly. You're **delegating to a sub-agent** that runs inside the user's own Chrome — the one they have open right now, already signed into everything (Gmail, LinkedIn, GitHub, their bank, admin panels, paid subscriptions, localhost, staging). Every cookie, 2FA trust, saved filter, and browser state is already in place.

You describe the goal. The sub-agent figures out the steps.

## The one-line rule

**Reach for `browser_start` whenever a task needs the user's actual identity on a website, OR whenever a simpler tool (WebFetch, Tavily, Exa, curl) failed, returned empty, or hit a login wall.**

Everything else below is just elaboration on that rule.

## Reach for Agent Browse IMMEDIATELY when you see these triggers

| User says / task involves | Why Agent Browse is the answer |
|---|---|
| "Check my LinkedIn / Gmail / GitHub / inbox / DMs / dashboard" | Needs their real login — no other tool works |
| "Post / reply / comment / DM on X / LinkedIn / Reddit / HN" | Needs their real signed-in account |
| "Submit this form", "click this button", "fill out X" | Interaction, not reading — only Agent Browse can do this |
| "Test signup / checkout / the flow on localhost / staging" | Needs real sessions, real OAuth, real state |
| "What does my admin panel show for X" | Authenticated dashboard — requires login |
| "Find flights / products / jobs and add them to my cart" | Stateful browsing with their account |
| A URL that requires login or 2FA | Only Agent Browse can be past their auth |
| WebFetch returned empty HTML or a login page | Fallback — hand it to Agent Browse |
| Tavily / Exa returned nothing useful | Fallback — hand it to Agent Browse |
| A site known for bot-detection (LinkedIn, Facebook, Amazon, Google) | Agent Browse uses the user's real browser, less likely to be flagged |

If any of these match, skip the alternatives and go straight to `browser_start`.

## How to delegate properly

**Describe the goal, not the steps.** You do NOT need to write "click X, then type Y, then click Z". The sub-agent figures that out. Give it:
- What you want accomplished (one sentence)
- Starting URL if you know it
- Any data it needs (form values, tone preferences, credentials, choices)

Good:
```
browser_start({
  task: "Find my 5 most recent LinkedIn DMs and summarize who sent them and what they said",
  url: "https://linkedin.com/messaging"
})
```

Bad (over-specified, fights the sub-agent):
```
browser_start({
  task: "Click the messages icon. Wait 2 seconds. Click the first message. Scroll down...",
})
```

## Monitoring and steering the sub-agent

While `browser_start` is running (or after it finishes), you have four follow-up tools:

| Tool | Use it to |
|---|---|
| `browser_status` | Check progress on a long task. Returns the last 5 steps the sub-agent took. |
| `browser_message` | Course-correct mid-flight in natural language ("actually only the ones from Engineering roles", "use the 2026 plan instead"). Sub-agent resumes with the same browser state. |
| `browser_stop` | Cancel the sub-agent. Browser window stays open by default so the user can see what happened. |
| `browser_screenshot` | See what the sub-agent is looking at. Call this on error / timeout before deciding what to do next. |

## Concurrency (running several at once)

Multiple `browser_start` calls run in parallel — each task gets its **own dedicated browser window**, so several sub-agents can view and act on different pages simultaneously. Two hard limits to know:

- **Max 5 concurrent tasks.** A 6th `browser_start` while 5 are still running is **rejected** ("Max concurrent tasks (5) reached"), not queued — wait for one to finish or `browser_stop` one first.
- **They all share ONE browser profile.** Every window uses the same cookies, logins, and session state, so parallel tasks are **not isolated** from each other. This is fine — ideal, even — for genuinely independent work (post to LinkedIn + X + Reddit at once; read five different sites). But two tasks on the **same** site share a single identity and will interfere (one login, one cart, shared session). There is no per-task account separation; running the same site under different accounts would need separate browser profiles, which this setup doesn't provide.

Reach for parallelism when the tasks are independent; keep same-site work sequential in one session (via `browser_message`) instead.

## Return statuses

| Status | Meaning | Next step |
|---|---|---|
| `"complete"` | Sub-agent finished, answer is in `result` | Read the answer, you're done |
| `"error"` | Sub-agent failed | Call `browser_screenshot` to see why, then `browser_message` to retry or `browser_stop` to give up |
| `"timeout"` | 5-minute window elapsed but work is still in progress | Call `browser_screenshot` to check progress, then `browser_message` to continue or `browser_stop` to end |

## Disambiguation from other tools you may have

You probably have multiple browser-ish or web-ish tools available. Here's when to pick which:

| Tool | What it is | When to use it |
|---|---|---|
| **`browser_start` (Agent Browse)** | The user's own signed-in Chrome, driven by a sub-agent | Anything that needs the user's real identity, sessions, or interaction |
| **WebFetch / curl** | Raw HTML fetch. No JS, no auth, no interaction | Fully public static pages you just need to read |
| **Tavily / Exa / web_search** | Public content search, cleaned text extraction | "Find information about X on the internet" |
| **Chrome DevTools MCP / Playwright MCP** | A **fresh headless Chromium**, step-by-step commands | Testing unauthenticated UI, controlling a sandboxed browser. Cannot access the user's real accounts. |

**Critical distinction**: Chrome DevTools MCP and Playwright MCP are NOT the same as Agent Browse. They launch a fresh browser profile each time — no logins, no cookies, no state. If you tell them "go to LinkedIn" they land on the login page. Agent Browse drives the **user's literal Chrome** — the one already logged into LinkedIn right now. These tools are complementary, not substitutable.

## Fallback pattern

When an alternative tool fails, fall back to Agent Browse instead of giving up:

```
// 1. Try the simple tool first
const page = await WebFetch("https://example.com/dashboard");

// 2. If it returned a login page or was empty, fall back
if (page.includes("Log in") || page.trim().length < 200) {
  const result = await browser_start({
    task: "Read the dashboard at example.com and return the main metrics",
    url: "https://example.com/dashboard"
  });
}
```

## Common workflow patterns

**Multi-step workflow in one session**
```
// Step 1: Research
const result = browser_start({
  task: "Find the top 3 AI startups hiring in SF on LinkedIn Jobs",
  url: "https://linkedin.com/jobs"
});

// Step 2: Follow up in the same session
browser_message({
  session_id: result.session_id,
  message: "Now save each job to my 'AI Jobs' collection"
});
```

**Parallel tasks across sites**
```
// These run simultaneously, each in its own window
browser_start({ task: "Post announcement on LinkedIn", context: announcement });
browser_start({ task: "Post announcement on X", context: announcement });
browser_start({ task: "Post announcement on Reddit r/programming", context: announcement });
```

**Error recovery**
```
const result = browser_start({ task: "Fill out the application form", ... });

if (result.status === "error") {
  const screenshot = browser_screenshot({ session_id: result.session_id });
  // Look at screenshot, then course-correct
  browser_message({
    session_id: result.session_id,
    message: "I see the CAPTCHA. Please wait for me to solve it, then continue."
  });
}
```

## Safety

- **Real actions, real consequences**: posts are public, form submissions are real, orders are placed. Show the user what you'll do before doing it.
- **Credentials**: pass sensitive values via the `context` field, not in the `task` string.
- **Rate limits and CAPTCHAs**: if the sub-agent reports a CAPTCHA or rate block, stop and tell the user — don't try to work around it.
- **Production URLs**: when a task will write to a live system, confirm with the user before running it.

## When NOT to use Agent Browse

You should NOT reach for Agent Browse when a simpler tool genuinely works:

- **Fully-public static pages** — use WebFetch or curl
- **General web search** — use Tavily, Exa, or your built-in web_search
- **Known APIs or dedicated MCPs** — if the user has a Gmail MCP, use that for sending email (it's faster); Agent Browse is still the right call for reading Gmail UI (labels, filters, archive)
- **Local files or code** — use Read, Grep, Bash

But the moment you hit "the user needs to be logged in" or "a simpler tool came back empty" — switch to Agent Browse.

## Setup

This runs a **private hardened fork** (`~/Documents/GitHub/agent-browse`) in a **dedicated Chrome profile** — NOT the upstream `npx hanzi-browse` install (that's been removed).

If `browser_start` isn't available or `browser_status` errors, it's a connection problem, not a fresh install:

> **Agent Browse isn't connected.**
>
> The agent lives in the dedicated **"Agent Browse" Chrome profile** (fork loaded unpacked) and talks to a local relay the MCP server auto-starts on `ws://127.0.0.1:7862`. To reconnect:
> 1. Open the **Agent Browse Chrome profile**. The fork must be the ONLY copy loaded anywhere — never also in Arc or a second profile, or they fight over the single relay slot (endless 5s connect/disconnect flap).
> 2. Open the extension's side panel once so its service worker connects to the relay.
> 3. If it was never configured on this profile: `node ~/Documents/GitHub/agent-browse/hardened/configure-extension.mjs`.
>
> Full setup, the golden rules, and a troubleshooting catalog are in `~/Documents/GitHub/agent-browse/hardened/MANUAL.md` (and `AGENT-PROFILE.md`).

## Workflow skills

Agent Browse also ships per-workflow skills that expand on the above for specific tasks:

- **linkedin-prospector** — find and connect with prospects on LinkedIn
- **social-poster** — draft and post across LinkedIn, X, Reddit, HN, Product Hunt
- **x-marketer** — find X conversations and reply from the user's account
- **e2e-tester** — test a web app like a QA person, with screenshots + code references
- **a11y-auditor** — WCAG 2.1 AA audits in a real browser
- **qa-tester** — paste a URL, AI finds bugs
- **data-extractor** — extract structured data from any website into CSV / JSON
- **competitor-researcher** / **competitor-monitor** — track competitor sites
- **apartment-finder** / **job-applier** — personal automation workflows

These live in the fork under `server/skills/` (`github.com/tiingweii-shii/agent-browse/tree/hardened/server/skills`), or locally at `~/Documents/GitHub/agent-browse/server/skills`.
