# Agent Workflow Control Plane

Local web UI and API for inspecting and operating `~/.agent-workflow` state.

This package is intentionally local-first. It derives state from task folders,
git worktrees, runtime files, leases, forge CLIs, and the workflow scripts in
`../../bin`. It is not the source of truth.

## What It Shows

- projects under `~/.agent-workflow/projects/`
- tasks grouped by project
- worktrees grouped by task
- branch, dirty, PR/MR, preview, cleanup, and archive state
- dev and preview pid/port details
- task lease details
- installed editor CLIs: Zed, Cursor, VS Code

## What It Can Do

- open project repos and task worktrees in an editor
- start, restart, stop, and open operator preview
- stop the managed agent dev lane
- reap stale leases
- archive tasks
- force archive tasks with typed task-id confirmation
- cleanup one worktree
- force cleanup one worktree with typed worktree-id confirmation

Normal cleanup/archive removes the git worktree and deletes the local branch.
Forced cleanup/archive leaves the branch alone.

## Safety Model

The server binds only loopback or Tailscale addresses:

- `localhost`
- `127.0.0.1`
- `::1`
- Tailscale IPv4 `100.64.0.0/10`
- Tailscale IPv6 `fd7a:115c:a1e0:*`

Every `/api/*` route requires `Authorization: Bearer <token>` or
`x-agent-token: <token>`.

The token lives in:

```bash
~/.config/agent-workflow/control-plane.env
```

Do not expose this service on a public interface.

## Install And Run

Preferred path:

```bash
~/.agent-workflow/bin/agent-cp install
~/.agent-workflow/bin/agent-cp start
~/.agent-workflow/bin/agent-cp status
```

Stop:

```bash
~/.agent-workflow/bin/agent-cp stop
```

Default URL:

```text
http://127.0.0.1:45731/
```

## Local Development

Install deps:

```bash
bun install
```

Build UI:

```bash
bun run build
```

Run server directly:

```bash
source ~/.config/agent-workflow/control-plane.env
bun run src/server.ts
```

Run Vite only:

```bash
bun run dev
```

Vite only serves the frontend shell. API calls still need the Bun server.

## Environment

Read by `src/server.ts`:

```bash
AGENT_WORKFLOW_HOME=~/.agent-workflow
AGENT_CP_HOST=127.0.0.1
AGENT_CP_PORT=45731
AGENT_CP_TOKEN=<secret>
```

`agent-cp install` creates `AGENT_CP_TOKEN` if missing.

## API

Representative routes:

```text
GET  /health
GET  /api/health
GET  /api/worktrees?projectId=<project-id>
GET  /api/editors
POST /api/preview
POST /api/open
POST /api/leases/reap
POST /api/worktrees/:task/dev
POST /api/worktrees/:task/cleanup
POST /api/worktrees/:task/worktrees/:worktreeId/cleanup
```

The API shells out to workflow scripts instead of duplicating runtime rules.
Important callers:

- `agent-dev`
- `agent-preview`
- `agent-cleanup`
- `agent-lease`
- `git`
- `gh`, when available
- `glab`, when available

## Verification

From repo root:

```bash
tests/control-plane.sh
```

Useful broader checks:

```bash
tests/agent-runtime.sh
tests/agent-lease.sh
```
