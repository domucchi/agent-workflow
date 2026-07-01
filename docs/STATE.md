# State Contract

`~/.agent-workflow` is the shared bus for local agent workflow. Consumers must read the
filesystem, git, and forge directly. Do not add parallel stores, databases, or cached
derived tables.

Status is derived, not stored. Files in this contract hold operator intent, project
configuration, task notes, and live-process annotations.

## Layout

```text
~/.agent-workflow/
  NOTIFY.md
  bin/
  projects/
    <project-id>/
      PROJECT.md
      PR_TEMPLATE.md
      leases/
        <resource>.json
      run/
        preview.pid
        preview.log
      archive/
        <task-id>-<timestamp>/
      tasks/
        <task-id>/
          context.md
          spec.md
          scratch.md
          handoff.md
          evidence/
          reviews/
          screenshots/
          worktrees/
            <worktree-id>/
          run/
            dev.pid
            dev.log
```

Only create optional task files when they carry non-derivable meaning. `worktree/`
is a git worktree. `run/` exists only while a dev stack is up.

## Project Configuration

`PROJECT.md` is local project lore plus machine-readable-enough prose for workflow
tools. Later CLIs read its dev-stack block for defaults, then confirm live state from
processes, ports, and git.

Project configuration lives at:

```text
~/.agent-workflow/projects/<project-id>/PROJECT.md
```

Repositories may expose that project workspace through an ignored symlink:

```text
<repo>/.agent-workflow -> ~/.agent-workflow/projects/<project-id>
```

## Lease Files

Lease files annotate exclusive use of a shared resource:

```text
~/.agent-workflow/projects/<project-id>/leases/<resource>.json
```

Shape:

```json
{
  "resource": "dev-stack",
  "holder_pid": 12345,
  "task_id": "GH-1-state-contract",
  "project_id": "github-com-domucchi-agent-workflow",
  "worktree": "/Users/example/.agent-workflow/projects/github-com-domucchi-agent-workflow/tasks/GH-1-state-contract/worktrees/docs-gh-1-state-contract",
  "ports": [4100, 4101],
  "acquired_at": "2026-07-01T10:00:00Z"
}
```

Fields:

- `resource`: lease name, matching the filename without `.json`
- `holder_pid`: process id whose liveness owns the lease
- `task_id`: task folder name under `tasks/`
- `project_id`: project folder name under `projects/`
- `worktree`: absolute path to the leased task worktree
- `ports`: canonical agent-lane ports reserved by this lease
- `acquired_at`: UTC ISO-8601 timestamp

Lease files are advisory. `kill -0 <holder_pid>` and `lsof` are truth. Release is
best-effort; interrupted shells can leave lease files behind. Reapers must remove
stale lease files only after proving the holder is dead or the configured ports
remained unbound past startup grace.

## Runtime Files

When a task owns a running dev stack, it may create:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/run/dev.pid
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/run/dev.log
```

`dev.pid` contains one process id for the stack supervisor. `dev.log` contains the
supervisor log stream. Remove `run/` when the stack stops.

Runtime files are annotations for cleanup and operator visibility. They do not
replace process and port checks.

When the operator preview lane is running, it may create:

```text
~/.agent-workflow/projects/<project-id>/run/preview.pid
~/.agent-workflow/projects/<project-id>/run/preview.log
~/.agent-workflow/projects/<project-id>/run/preview.json
```

Preview runtime files are project-scoped because preview is not owned by a task
and is never claimed or reaped by lease tooling.
`preview.json` records the selected worktree and preview ports so dashboards can
show which task is currently being viewed.

Cleanup archives removed task folders under:

```text
~/.agent-workflow/projects/<project-id>/archive/<task-id>-<timestamp>/
```

Archived task folders are historical metadata only; active state is still derived
from current `tasks/`, git, processes, ports, and forge state.

Worktree cleanup removes one git worktree from a task without archiving the task
folder. Forced cleanup may bypass dirty, unpushed, missing-PR/MR, and missing
worktree blockers, but it still refuses active leases, running managed processes,
and base/integration branches. UI force actions require typing the exact task id
or worktree id, and the control-plane API validates that confirmation server-side.
Normal cleanup also deletes the local branch after removing the worktree. Forced
cleanup deliberately leaves the branch untouched.

## Worktree Invariant

Agents do implementation work only in per-task worktrees:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktrees/<worktree-id>/
```

`worktree-id` is derived from the branch name by lowercasing and collapsing
punctuation/slashes to `-`. Main checkouts are for read-only inspection. Leased
dev workflows must use a task worktree path above; work outside it is invisible
to lease, dashboard, and cleanup layers. Legacy `tasks/<task-id>/worktree/`
paths are read for compatibility only.

## Dev Stack Invariant

One project has one leased agent dev stack. Use mutual exclusion, not parallel
isolation. Projects with shared Postgres, RabbitMQ, MinIO, or similar backing
services cannot safely run two agent stacks just because ports differ.

The operator preview lane is separate from the lease. It uses fixed preview ports
over the same shared infrastructure and is never claimed or reaped by lease tooling.
Preview and leased dev must not run from the same worktree when the app framework
uses filesystem dev locks.
When multiple preview ports are listed in `PROJECT.md`, the last port is the
browser-facing frontend URL.

## Config Precedence

Resolve settings in this order:

1. Repository instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent) and live user instructions.
2. Project `PROJECT.md`, including the dev-stack block.
3. CLI defaults.

Higher-precedence instructions override lower-precedence defaults. Later phases must
test concrete precedence behavior where their CLIs consume this contract.
