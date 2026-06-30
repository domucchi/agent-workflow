# Agent Workflow

Source for local agent workflow routers and skills.

## Apply

Run:

```bash
bin/apply
```

`bin/apply` is idempotent. It:

- symlinks skills into `~/.codex/skills` and `~/.claude/skills`
- inserts or updates managed router blocks in `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`
- preserves unrelated global config
- creates timestamped backups before first editing a router file
- refuses same-named non-symlinks or symlinks that point outside this checkout

Keep this checkout somewhere permanent. Do not manually rewrite global Claude or Codex config. Edit files here, then rerun `bin/apply`.

## Local Setup

Run:

```bash
bin/init-local
```

This creates local runtime/config scaffolding only. It never overwrites existing config and never writes real secrets.

## Boundaries

This repository is the source of workflow affordances, not task state.

Task artifacts live under:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/
```

Project lore lives at:

```text
~/.agent-workflow/projects/<project-id>/PROJECT.md
```

Notification preferences live at:

```text
~/.agent-workflow/NOTIFY.md
```

Do not add workflow state, phase commands, approval commands, or status files.
