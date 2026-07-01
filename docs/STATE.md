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
      tasks/
        <task-id>/
          context.md
          spec.md
          scratch.md
          handoff.md
          evidence/
          reviews/
          screenshots/
          worktree/
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
  "worktree": "/Users/example/.agent-workflow/projects/github-com-domucchi-agent-workflow/tasks/GH-1-state-contract/worktree",
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
best-effort; reapers must remove stale lease files only after proving the holder is
dead and no configured ports are live.

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

## Worktree Invariant

Agents do implementation work only in per-task worktrees:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktree/
```

Main checkouts are for read-only inspection unless the human explicitly asks
otherwise. Work outside a task worktree is invisible to lease, dashboard, and cleanup
layers.

## Dev Stack Invariant

One project has one leased agent dev stack. Use mutual exclusion, not parallel
isolation. Projects with shared Postgres, RabbitMQ, MinIO, or similar backing
services cannot safely run two agent stacks just because ports differ.

The operator preview lane is separate from the lease. It uses fixed preview ports
over the same shared infrastructure and is never claimed or reaped by lease tooling.

## Config Precedence

Resolve settings in this order:

1. Repository instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent) and live user instructions.
2. Project `PROJECT.md`, including the dev-stack block.
3. CLI defaults.

Higher-precedence instructions override lower-precedence defaults. Later phases must
test concrete precedence behavior where their CLIs consume this contract.
