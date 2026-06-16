<p align="center">
  <img src="https://raw.githubusercontent.com/felipelincoln/snaildit/main/docs/snail-breathing.gif" alt="Snaild.it" width="111" />
</p>

<h1 align="center">Snaild.it</h1>

<p align="center">The open-source AI code reviewer that runs on your own Codex subscription.</p>

---

Snaild.it forwards your repository's webhooks to **automations** you define. On each event it runs `codex exec` on your machine with a prompt **you wrote** — review pull requests, triage issues, push fixes, reply in threads. Reviewing PRs is just one prompt.

It acts through the `gh` CLI as a GitHub App **you own**, on **your** Codex subscription: no API keys, no per-token billing, no backend to host.

> [!CAUTION]
> **Snaild.it runs `codex exec` on your machine** — an AI agent with write access to the working directory and network access. Use it deliberately:
> - A bad (or malicious) prompt can modify your checked-out code or exfiltrate data over the network.
> - On a **public** repo, anyone who opens an issue or PR feeds text into the agent's prompt — a prompt-injection path to your machine. Start with **private repos you trust**.
> - Scope the GitHub App's permissions to the minimum, and don't run it on a machine holding secrets you can't afford to leak.

## Quickstart

```sh
npx snaildit start
```

This opens a local dashboard with three steps: create a GitHub App you own, pick which repositories it can touch, and connect Codex. After that it runs your automations from your machine.

## Automations

An automation is a webhook event plus a prompt you write. For example:

| On | …it runs your prompt |
| --- | --- |
| `issues.labeled` → `auto-fix` | *“Check out `main`, reproduce the issue, write a fix, and open a PR that closes it.”* |
| `pull_request.opened` | *“Review the diff, leave inline comments, and approve or request changes.”* |
| `issue_comment.created` | *“If it's a question, answer it from the codebase and link the files involved.”* |

## Requirements

- Node.js >= 24.15
- A [Codex](https://developers.openai.com/codex/cli/) subscription (logged in via the dashboard)
- The [`gh`](https://cli.github.com/) CLI on your PATH — Snaild.it hands it a short-lived GitHub App token per run (via `GH_TOKEN`), so you don't authenticate `gh` yourself.
- macOS or Linux (Windows isn't supported yet)

(`cloudflared` is downloaded automatically on first run.)

## From source

```sh
git clone https://github.com/felipelincoln/snaildit
cd snaildit
npm install
npm run build
npm start
```
