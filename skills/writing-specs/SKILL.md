---
name: writing-specs
description: Shape implementation approach before risky or ambiguous work. Use when product behavior is unclear, architecture is touched, diff is large, multiple viable approaches exist, or work involves auth, payments, data migration, permissions, security, or task-specific release gates.
---

# Writing Specs

Use a spec to preserve decisions, not to satisfy a phase.

## When To Write

Write `spec.md` only when decisions, tradeoffs, acceptance criteria, approval, or execution mode need to survive the session. Write it before implementation when:

- behavior is ambiguous
- architecture changes
- diff will be large
- multiple approaches are viable
- work touches auth, payments, data migration, permissions, or security
- task-specific release gates matter

For tiny or mechanical work, a short intent note in `scratch.md` is enough. Do not create `spec.md` just because a task started.

## Read First

Read repo instructions, project lore, `context.md`, existing `spec.md`, and current user instructions.

## Contents

Keep it prose-first:

- chosen approach
- rejected options and why
- explicit out of scope
- risks
- verification plan
- task-specific release gates
- human agreement text when risk requires approval

Do not store approval as a boolean or phase. Store the decision itself:

```md
Human agreed to approach X on YYYY-MM-DD.
```

After agreement, treat the spec as stable unless scope changes.

If the work turns out simpler than expected and no durable decision exists, keep the note in `scratch.md` instead of creating `spec.md`.
