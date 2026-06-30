---
name: task-setup
description: Set up local task workspace for agent work. Use when starting a new ticket/task, creating a task artifact folder, creating or finding a worktree, adding an ignored repo-local tasks symlink, or orienting task files.
---

# Task Setup

Set up only scaffolding. Do not decide phase, state, approval, or next step.

## Inputs

Identify:

- repo root
- project name
- task id
- desired branch name, if provided

If task id is missing and cannot be inferred, ask one concise question.

## Read First

Read repo instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent). If present, read `~/agent-workspace/<project>/PROJECT.md`.

Current user instructions and repo instructions override local project lore.

## Task Home

Use:

```text
~/agent-workspace/<project>/<task-id>/
```

Create it if needed.

Create `scratch.md` from the template if missing. Create `context.md`, `spec.md`, `handoff.md`, `evidence/`, `reviews/`, and `screenshots/` only when their lifecycle begins.

## Repo Symlink

Add a repo-local ignored symlink:

```text
tasks/<task-id> -> ~/agent-workspace/<project>/<task-id>
```

Ensure `tasks/` is ignored locally via:

```bash
git rev-parse --git-common-dir
```

Then edit that common dir's `info/exclude`. Do not edit committed `.gitignore` for local workflow files.

## Worktree

Prefer an existing suitable worktree if one already exists. Otherwise create a task worktree using normal git commands and the user's branch naming convention.

Do not copy env files by glob. Never copy, read, print, summarize, diff, or commit production secrets.
