# Agent Workflow

Local workflow affordances for coding agents.

This is not a task state machine. It installs short router guidance plus portable skills that agents load on demand: setup, context gathering, specs, verification, independent review, and CI recovery.

## Install

```bash
bin/apply
```

The installer is idempotent. It:

- symlinks skills into `~/.codex/skills` and `~/.claude/skills`
- inserts or updates managed router blocks in `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`
- preserves unrelated global config
- creates timestamped backups before first editing a router file
- refuses same-named non-symlinks or symlinks that point outside this checkout

Keep this checkout somewhere permanent because installed skills symlink back to it. Do not manually rewrite global agent config. Edit this repository, then rerun `bin/apply`.

## Runtime Files

Task and project memory live outside code repositories:

```text
~/.agent-workflow/projects/<project-id>/PROJECT.md
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktree/
```

Projects may expose that workspace through a local, ignored repo symlink:

```text
<repo>/.agent-workflow -> ~/.agent-workflow/projects/<project-id>
```

`PROJECT.md` holds local project lore. Task folders hold non-derivable task meaning: context, decisions, rejected options, verification notes, review notes, and handoff notes.

Status is derived by probing git, filesystem, and forge state. Do not store status files.

## Skills

- `task-setup`: start a task workspace, worktree, ignored symlink, or task folder
- `gathering-context`: inspect ticket/code/docs/MRs and write or refresh `context.md`
- `writing-specs`: preserve approach, decisions, rejected options, scope, risks, and gates before risky work
- `verifying-changes`: run project checks and use Playwright MCP for frontend/user-facing UI changes
- `independent-review`: request a fresh read-only peer review before draft MR/PR or human review
- `ci-recovery`: inspect failing CI, make one obvious fix attempt, then report
- `handoff`: overwrite the forward pointer for the next session

## Principles

- Equip agents; do not orchestrate them.
- Derive status; store only meaning.
- Load instructions on demand.
- Keep project-specific quirks in `PROJECT.md`, not global skills.
- Keep scripts limited to deterministic installation/scaffolding.

## Optional Tools

- Playwright MCP: used by `verifying-changes` for browser checks.
- peer CLI MCP: used by `independent-review` for stronger different-tool review when risk justifies it.

The skills degrade gracefully when optional tools are unavailable, but they should record the limitation.

## License

MIT.
