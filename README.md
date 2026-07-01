# Agent Workflow

Local workflow affordances for coding agents.

This is not a task state machine. It installs short router guidance plus portable skills that agents load on demand: setup, context gathering, specs, resource management, verification, independent review, draft PR/MR prep, and CI recovery.

## Install

```bash
bin/apply
bin/init-local
bin/init-project /path/to/repo [project-id]
```

`bin/apply` installs skills and router guidance. It is idempotent. It:

- symlinks skills into `~/.codex/skills` and `~/.claude/skills`
- inserts or updates managed router blocks in `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`
- preserves unrelated global config
- creates timestamped backups before first editing a router file
- refuses same-named non-symlinks or symlinks that point outside this checkout

Keep this checkout somewhere permanent because installed skills symlink back to it. Do not manually rewrite global agent config. Edit this repository, then rerun `bin/apply`.

`bin/init-local` creates local runtime/config scaffolding. It:

- creates `~/.agent-workflow/projects/`
- creates `~/.agent-workflow/NOTIFY.md` from `templates/NOTIFY.pushover.md` when missing
- creates `~/.config/agent-workflow/pushover.env` with empty placeholders when missing
- creates `~/.agent-workflow/bin/agent-notify`, `agent-lease`, `agent-dev`, `agent-preview`, `agent-cleanup`, and `agent-cp` as symlinks to this checkout
- never overwrites existing config or writes real secrets

Pushover credentials are sourced only by `agent-notify` while sending a notification. Do not source `pushover.env` from shell startup.

`~/.agent-workflow/bin/agent-lease` coordinates one leased dev stack per project:

```bash
~/.agent-workflow/bin/agent-lease claim --wait <resource>
~/.agent-workflow/bin/agent-lease release <resource>
~/.agent-workflow/bin/agent-lease list [resource]
~/.agent-workflow/bin/agent-lease reap [resource]
```

Lease files live under `~/.agent-workflow/projects/<project-id>/leases/`.
Liveness is derived from `kill -0` and `lsof`; unbound ports become reapable after
the configured startup grace. No queue or waiter state is stored. Claiming a
leased resource requires the task worktree:

```bash
~/.agent-workflow/bin/agent-lease claim --wait --project-id <project-id> --task-id <task-id> --worktree ~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktrees/<worktree-id> <resource>
```

`~/.agent-workflow/bin/agent-dev` starts and stops the leased agent lane for a
task worktree. It rejects non-task worktrees. `worktree-id` is derived from the
branch name. `~/.agent-workflow/bin/agent-preview`
starts and stops the unleased operator preview lane. Do not run preview and the
leased dev lane from the same worktree when the framework creates a filesystem
dev lock. `~/.agent-workflow/bin/agent-cleanup` conservatively reports disposable
task worktrees and defaults to dry-run. It can archive a whole task, clean one
task worktree, or force either action while still refusing active leases, running
managed processes, and base/integration branches:

```bash
~/.agent-workflow/bin/agent-cleanup --project-id <project-id> --dry-run <task-id>
~/.agent-workflow/bin/agent-cleanup --project-id <project-id> --execute <task-id>
~/.agent-workflow/bin/agent-cleanup --project-id <project-id> --execute --worktree-id <worktree-id> <task-id>
~/.agent-workflow/bin/agent-cleanup --project-id <project-id> --execute --force <task-id>
```

Normal cleanup removes the git worktree and deletes its local branch. Forced
cleanup removes the worktree/task metadata but leaves the branch alone.

`~/.agent-workflow/bin/agent-cp install|start|stop|status` manages the local
control-plane daemon. It creates `~/.config/agent-workflow/control-plane.env`
with a generated token and a launchd plist at
`~/Library/LaunchAgents/com.agent-workflow.control-plane.plist`. The daemon
binds only loopback or Tailscale addresses and re-derives all dashboard state
from `~/.agent-workflow`, git, forge commands, and existing CLIs.

`bin/init-project` creates per-repo local workflow scaffolding. It:

- creates `~/.agent-workflow/projects/<project-id>/PROJECT.md` when missing
- creates `~/.agent-workflow/projects/<project-id>/PR_TEMPLATE.md` when missing
- creates or repairs the repo-local `.agent-workflow` symlink
- adds `.agent-workflow` to the local git exclude file
- creates `.new` files instead of overwriting existing project lore/templates
- never edits committed repo files or reads env files

## Runtime Files

Task and project memory live outside code repositories:

```text
~/.agent-workflow/projects/<project-id>/PROJECT.md
~/.agent-workflow/projects/<project-id>/PR_TEMPLATE.md
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktrees/<worktree-id>/
```

Projects may expose that workspace through a local, ignored repo symlink:

```text
<repo>/.agent-workflow -> ~/.agent-workflow/projects/<project-id>
```

`PROJECT.md` holds local project lore. `PR_TEMPLATE.md` holds the project-local fallback body shape for draft PRs/MRs. Task folders hold non-derivable task meaning: context, decisions, rejected options, verification notes, review notes, and handoff notes.

Status is derived by probing git, filesystem, and forge state. Do not store status files.

## Skills

- `task-setup`: start a task workspace, worktree, ignored symlink, or task folder
- `gathering-context`: inspect ticket/code/docs/MRs and write or refresh `context.md`
- `writing-specs`: preserve approach, decisions, rejected options, scope, risks, and gates before risky work
- `execution-mode`: choose supervised, draft-MR, implementation-only, or review-only execution
- `managing-resources`: claim/release shared dev-stack resources for app, browser, and e2e work
- `verifying-changes`: run project checks and use Playwright MCP for frontend/user-facing UI changes
- `independent-review`: request a fresh read-only peer review before draft MR/PR or human review
- `draft-pr`: open or update a draft PR/MR using project PR/MR preferences and actual verification evidence
- `ci-recovery`: inspect failing CI, make one obvious fix attempt, then report
- `handoff`: overwrite the forward pointer for the next session
- `notify-human`: send a low-detail notification when human attention is needed

## Principles

- Equip agents; do not orchestrate them.
- Derive status; store only meaning.
- Load instructions on demand.
- Keep project-specific quirks in `PROJECT.md`, not global skills.
- Keep scripts limited to deterministic installation/scaffolding.

## Optional Tools

- Playwright MCP: used by `verifying-changes` for browser checks.
- peer CLI MCP: used by `independent-review` for stronger different-tool review when risk justifies it.
- Pushover: starter config template at `templates/NOTIFY.pushover.md`; copy it to `~/.agent-workflow/NOTIFY.md`.

The skills degrade gracefully when optional tools are unavailable, but they should record the limitation.

## License

MIT.
