# Privacy Policy for Agent Browse

Last updated: September 7, 2026

## Overview

Agent Browse is a browser execution platform for AI agents. This fork is a
**private, hardened build that runs BYOM-local only** — the managed / hosted
service path present in upstream is disabled here (see `hardened/HARDENING.md`).

## BYOM Local Mode (the only mode in this build)

- **No data is sent to any hosted Agent Browse service.** All orchestration happens on your machine.
- Screenshots and page content are sent only to the AI provider you configure (Anthropic, OpenAI, Google, etc.), according to their privacy policies.
- API keys and credentials are stored locally — in Chrome's storage and/or read from your local machine (e.g. macOS Keychain, Claude/Codex config files) by the local relay to make calls as you.
- Conversation history and per-task logs are stored locally (task logs under `~/Downloads/browser-agent/`) and are swept on a retention window — see `hardened/HARDENING.md` → *Task-log retention*. You can clear them at any time.
- Nothing listens on the network; the relay is bound to loopback only.

## What Agent Browse Does Not Do

- Does NOT sell or share user data with third parties
- Does NOT track browsing history outside of active task execution
- Does NOT send telemetry or error reports (Sentry / analytics are removed in this build)

## Third-Party Services

Data is processed only by the AI provider you configure, for example:

- **Anthropic**: [Anthropic Privacy](https://www.anthropic.com/privacy)
- **OpenAI**: [OpenAI Privacy](https://openai.com/privacy)
- **Google**: [Google Cloud Privacy](https://cloud.google.com/terms/data-processing-terms)

## Extension Permissions

The Chrome extension requires broad permissions (`<all_urls>`, `debugger`) to:

- Read page content for AI understanding
- Take screenshots for visual analysis
- Interact with page elements (click, type, scroll)
- Manage browser tabs

These permissions are used solely for browser automation at your request. Because
the extension has broad browser control and LLM-driven agents can be steered by
hostile page content, run it in a dedicated, isolated browser profile.

## Contact

Open an issue: https://github.com/hanzili/hanzi-browse/issues
