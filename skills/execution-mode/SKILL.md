---
name: execution-mode
description: Choose and follow the task execution mode after a spec or intent is agreed. Use when deciding whether to run autonomously to draft MR/PR, work step-by-step with the user, stop after implementation/verification, perform review-only work, or define stop-and-notify conditions.
---

# Execution Mode

Execution mode decides how far the agent may proceed without another human check-in. It is not workflow state.

Store the chosen mode in `spec.md` when a spec exists. For trivial work without a spec, write a short intent note in `scratch.md`.

## Modes

Use one of:

- `draft-mr`: proceed through implementation, verification, independent review, clear fixes, draft MR/PR, and one CI recovery attempt.
- `supervised`: check in before major moves. Use when user wants to collaborate step by step.
- `implementation-only`: implement and verify locally, then stop before independent review or MR/PR.
- `review-only`: inspect existing work and report findings; do not implement unless asked.

Choose mode in this order: explicit user instruction or spec decision, then `PROJECT.md` default, then `supervised`. If risk is high or approval is unclear, use `supervised` even when the project default is more autonomous.

## Spec Text

Record the decision as prose:

```md
## Execution

Mode: draft-mr
Human agreed on YYYY-MM-DD.

Agent may proceed through implementation, verification, independent review,
clear high-severity fixes, draft MR/PR, and one CI recovery attempt.

Stop and notify human on the stop conditions below.
```

Do not store phase, approval booleans, or progress flags.

## Draft MR Mode

In `draft-mr`, use existing skills as needed:

- `task-setup`
- `gathering-context`
- `writing-specs`
- `verifying-changes`
- `independent-review`
- `ci-recovery`
- `handoff`
- `notify-human`

Expected happy path:

1. Implement in the task worktree.
2. Verify changed behavior.
3. Request independent review.
4. Fix obvious high-severity findings that are within scope.
5. Open or update a draft MR/PR.
6. Check CI snapshot.
7. Attempt one obvious CI fix if needed.
8. Notify human when draft MR/PR is ready or a stop condition fires.

This is one autonomous pass, not an infinite loop. Do not keep cycling through review/CI fixes without a human turn.

## Stop Conditions

Stop and notify human when:

- spec appears wrong or incomplete
- product behavior is ambiguous
- architecture direction changes
- auth, payments, permissions, migrations, security, or data-loss risk appears beyond the agreed spec
- review finding is a judgment call
- review finds high-severity issue without an obvious in-scope fix
- fixing a review finding expands scope
- CI fails with no obvious fix
- one CI recovery attempt was already used
- required tool, credential, environment, or service is unavailable
- agent confidence drops below "I know the next safe action"
- draft MR/PR is ready for human review

For any stop condition, use `notify-human` when configured and write a concise session message.

## Fix Policy

Fix without asking only when the fix is:

- clearly correct
- within agreed scope
- low judgment
- covered by available verification

Ask instead when the fix changes product behavior, architecture, data shape, permissions, migration strategy, or scope.
