---
name: task-setup
description: Set up local task workspace for agent work. Use when starting a new ticket/task, creating a task artifact folder, creating or finding a git worktree, adding an ignored repo-local .agent-workflow symlink, deriving safe task ids, or choosing branch names.
---

# Task Setup

Set up only scaffolding. Do not decide phase, state, approval, or next step.

## Inputs

Identify:

- repo root
- project id
- task id
- desired branch name, if provided

If project id or task id is missing and cannot be inferred, ask one concise question.

## Read First

Read repo instructions (`AGENTS.md`, `CLAUDE.md`, or equivalent). If present, read `~/.agent-workflow/projects/<project-id>/PROJECT.md`.

Current user instructions and repo instructions override local project lore.

## Safe Names

Project id is a safe path segment. Prefer deriving it from git remote as `<host>-<owner>-<repo>` with punctuation collapsed to `-`. If no remote exists, use the sanitized repo basename. Ask if that would collide or be unclear.

Task id should preserve issue-tracker identity:

- Jira: `ABC-123`
- GitHub: `GH-23`
- GitLab: `GL-23`
- Linear: `TEAM-123`
- Manual: `TASK-short-slug`

Add a short slug when useful: `ABC-123-account-settings`, `GH-23-login-redirect`.

Reject names containing `/`, `\`, empty segments, control characters, shell metacharacters, or path segments equal to `.` or `..`. Collapse whitespace and punctuation in slugs to `-`.

## Task Home

Use:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/
```

Create it if needed.

Create `scratch.md` if missing:

```md
# Scratch

## Open questions

## Attempts / dead ends

## Verification notes

## Independent review notes

## CI notes
```

Create `context.md`, `spec.md`, `handoff.md`, `evidence/`, `reviews/`, and `screenshots/` only when their lifecycle begins.

## Repo Symlink

Prefer a repo-local hidden symlink to the project workspace:

```text
<repo>/.agent-workflow -> ~/.agent-workflow/projects/<project-id>
```

Create it only when useful. If creating it, ensure `.agent-workflow` is ignored locally via:

```bash
git rev-parse --git-common-dir
```

Then edit that common dir's `info/exclude`. Do not edit committed `.gitignore` for local workflow files.

Do not create per-task symlinks inside the repo. Do not follow or copy `.agent-workflow` into archives, uploads, patches, prompts, or commits unless the user explicitly asks for task artifacts.

If `.agent-workflow` already exists and is not the expected symlink, stop and ask.

## Branch

Use the branch naming rule in `PROJECT.md` when present. Default:

```text
{type}/{task-id}
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`.

Pick the obvious type:

- `feat` for new behavior
- `fix` for bug fixes
- `chore` for tooling, workflow, dependencies, or maintenance
- exact type when the task is clearly docs, refactor, tests, CI, or performance

Do not work directly on `main`, `master`, or shared integration branches unless the user explicitly asks.

## Worktree

Agents should use git worktrees for non-trivial code changes.

Use:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktree/
```

Prefer an existing suitable worktree if one already exists. Otherwise create a branch and worktree using normal git commands and the project's branch naming rule.

Do not copy env files by glob. Never copy, read, print, summarize, diff, or commit production secrets.
