# Agent Browse Skills

Agent skills for **Agent Browse** (a private, hardened fork of hanzi-browse) — give your AI agent a real browser.

## Core Skill

| Skill | Description |
|-------|-------------|
| [agent-browse](agent-browse/) | Browser automation via MCP — click, type, fill forms, read authenticated pages |

## Workflow Skills

| Skill | Description |
|-------|-------------|
| [e2e-tester](e2e-tester/) | Test web apps like a QA person with real browser interactions |
| [social-poster](social-poster/) | Draft and post content across LinkedIn, Twitter/X, Reddit |
| [linkedin-prospector](linkedin-prospector/) | Find and connect with prospects on LinkedIn |
| [a11y-auditor](a11y-auditor/) | Run accessibility audits in a real browser |
| [x-marketer](x-marketer/) | Twitter/X marketing workflows |

## Installation

### Claude Code
```bash
# Copy a skill to your project
cp -r agent-browse/ .claude/skills/agent-browse/

# Or install globally
cp -r agent-browse/ ~/.claude/skills/agent-browse/
```

### Cursor
```bash
cp -r agent-browse/ .cursor/skills/agent-browse/
```

### Other agents
Copy the skill directory to your agent's skills folder.

## Setup

This fork is **not** installed via `npx hanzi-browse setup`. It runs in a dedicated
Chrome profile with the extension loaded unpacked, and the MCP server auto-starts
the (loopback-bound) relay. Full setup and troubleshooting:

- `hardened/AGENT-PROFILE.md` — dedicated-profile setup
- `hardened/MANUAL.md` — daily use, golden rules, known issues & fixes
- `hardened/HARDENING.md` — what was changed and why (security)
