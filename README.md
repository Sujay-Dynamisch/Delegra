# Delegra

**Orchestrate every agent.**

A local dashboard that orchestrates **Claude Code agents across any project on your computer**, using the Claude plan you are already signed in to.

- **Projects:** connect any folder; each project has its own tasks, workflows and executions, and an access level (read-only, edit files, or full access).
- **Tasks:** one Claude Code agent per task, with live activity, changed files, tokens and duration, plus run, stop and re-run.
- **Agents:** reusable specialists (model, role, skills, standing instructions).
- **Workflows:** an n8n-style node editor with trigger, Claude agent, If (branch), Merge and Sticky note nodes. Each agent node has its own model and can be set read-only or allowed to edit files. Click **Execute workflow** and watch each node light up.
- **Executions:** every workflow run, with each node's output.
- **Chat:** read-only questions about the project; start with `/lean` for a cheap, staged plan.
- **Analytics:** token use by model, success rate and activity, from what Claude Code reports.
- **Rules:** guardrails that are added to every agent prompt.

## Documentation

Full step-by-step docs are built into the app: open **Docs** in the sidebar (http://127.0.0.1:3210/docs).

## How "Connect Claude" works

There is no API key. The app drives the **Claude Code CLI** (`claude -p`) on this machine:

1. If you are not signed in, **Sign in with Claude** runs `claude auth login`, which opens Anthropic's own sign-in page.
2. A consent screen lists what the app will do; **Allow** stores that grant locally (in `data/`).
3. Agent runs use your CLI login, so usage counts against your Claude plan. `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are removed from every agent process, so nothing silently switches to API billing.

The app never reads, copies or stores Claude credentials.

## Run it

Requirements: Node 20+, and Claude Code installed (`npm i -g @anthropic-ai/claude-code`). Antigravity (`agy`) is optional; when it is not installed, its options are hidden.

```bash
npm install
npm run dev     # http://127.0.0.1:3210
```

The server listens on `127.0.0.1` only, and API calls from other origins are rejected.

## Data

Everything is stored as JSON in `./data` (git-ignored): projects, agents, tasks, workflows, runs, rules and the permission grant.

## Stack

Next.js 16 (App Router, TypeScript), shadcn/ui on Base UI, Tailwind v4, React Flow (`@xyflow/react`) and lucide icons.

## Roadmap

- Scheduled workflows (cron trigger node)
- Parallel branches executing concurrently
- Git worktree per task for conflict-free parallel agents
- Diff viewer for changed files
