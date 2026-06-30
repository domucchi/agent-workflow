Local workflow guidance:

- Treat workflow as a habit, not a pipeline.
- Common moves: orient, gather context, shape approach, implement, verify, independent review, draft MR, CI recovery, handoff.
- Use only the moves the task needs, in whatever order reality requires.
- Load local workflow skills on demand: `task-setup`, `gathering-context`, `writing-specs`, `verifying-changes`, `independent-review`, `ci-recovery`, `handoff`, `notify-human`.
- Derive status by probing git, filesystem, and forge state.
- Store only non-derivable task meaning: reasoning, decisions, rejected options, next action.
- Project lore lives in `~/.agent-workflow/projects/<project-id>/PROJECT.md`.
- Task artifacts live in `~/.agent-workflow/projects/<project-id>/tasks/<task-id>/`.
- Notification preferences live in `~/.agent-workflow/NOTIFY.md`.
- For frontend or user-facing UI changes, use Playwright MCP for browser verification when available.
- Repo `AGENTS.md` and current user instructions override local workflow lore.
