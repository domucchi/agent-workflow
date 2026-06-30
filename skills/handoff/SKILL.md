---
name: handoff
description: Write or refresh handoff.md for the next agent session. Use when ending a session, pausing work, switching agents, preparing a cold resume, or replacing stale next-step notes.
---

# Handoff

`handoff.md` is a forward pointer. It rots immediately when work continues.

## Rule

Overwrite `handoff.md` fresh each time. Do not append. Do not archive old handoffs.

If information should survive beyond the next session, move it to the right artifact:

- durable task context -> `context.md`
- agreed decisions or scope -> `spec.md`
- messy history, attempts, verification, review notes -> `scratch.md`

## Build From

Regenerate from:

- live probes: git status, branch, worktree, diff, forge/MR/PR, CI when relevant
- current conversation
- `context.md`
- `spec.md`, if present
- `scratch.md`

Do not trust old handoff content without re-probing.

## Shape

Keep it short:

```md
# Handoff

## Do next

## Do not relitigate

## Watch

## Last known verification
```

Use concrete file paths, commands, and current blockers. Avoid status that can be derived unless it explains the next action.
