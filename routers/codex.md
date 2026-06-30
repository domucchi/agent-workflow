Local workflow guidance:

- Treat workflow as a habit, not a pipeline.
- Common moves: orient, gather context, shape approach, implement, verify, independent review, draft MR, CI recovery, handoff.
- Use only the moves the task needs, in whatever order reality requires.
- Load workflow skills on demand.
- Local workflow skills:
  - `task-setup`: start a ticket/task workspace, worktree, ignored symlink, or task folder.
  - `gathering-context`: inspect ticket/code/docs/MRs and write or refresh `context.md`.
  - `writing-specs`: preserve approach, decisions, rejected options, scope, risks, and gates before risky work.
  - `verifying-changes`: run project checks and use Playwright MCP for frontend/user-facing UI changes.
  - `independent-review`: request a fresh read-only peer review before draft MR/PR or human review.
  - `ci-recovery`: inspect failing CI, make one obvious fix attempt, then report.
- Derive status by probing git, filesystem, and forge state.
- Store only non-derivable task meaning: reasoning, decisions, rejected options, next action.
- Project lore lives in `~/agent-workspace/<project>/PROJECT.md`.
- Task artifacts live in `~/agent-workspace/<project>/<task-id>/`.
- For frontend or user-facing UI changes, use Playwright MCP for browser verification when available.
- Repo `AGENTS.md` and current user instructions override local workflow lore.
