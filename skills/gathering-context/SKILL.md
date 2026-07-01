---
name: gathering-context
description: Gather and synthesize task context before or during implementation. Use when reading a ticket, issue, MR/PR, related code, docs, previous attempts, or when creating or refreshing task context.md with sources and decisions.
---

# Gathering Context

Gather enough context to act. Stop when the next decision is clear.

## Read First

Read repo instructions and `~/.agent-workflow/projects/<project-id>/PROJECT.md` if present. Read existing task artifacts before rewriting anything.

## Sources

Use primary sources:

- ticket or issue
- linked MR/PR
- repo code
- project docs
- CI logs, when relevant
- conversation instructions

Prefer live probes over stored status.

## Write `context.md` Only When Useful

Create or refresh `context.md` only when synthesis is useful or scope changed.

Use it for gathered facts, source links, constraints, or code relationships that would be expensive to rediscover. Do not create it just because a task started.

Include:

- task request in plain language
- relevant code areas
- constraints and risks
- related work
- unresolved questions
- sources list with links or file paths

Do not turn `context.md` into status. Branch, CI state, MR number, and current diff are derived by probing.

For tiny obvious work, write a short intent note in `scratch.md` instead.
