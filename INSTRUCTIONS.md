# Agent Workflow

Source for local agent workflow routers and skills.

## Apply

Run:

```bash
bin/apply
```

The installer is idempotent. It:

- symlinks skills into `~/.codex/skills` and `~/.claude/skills`
- inserts or updates managed router blocks in `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`
- preserves unrelated global config
- creates timestamped backups before first editing a router file

Do not manually rewrite global Claude or Codex config. Edit files here, then rerun `bin/apply`.

## Boundaries

This repository is the source of workflow affordances, not task state.

Task artifacts live under:

```text
~/agent-workspace/<project>/<task-id>/
```

Project lore lives at:

```text
~/agent-workspace/<project>/PROJECT.md
```

Do not add workflow state, phase commands, approval commands, or status files.
