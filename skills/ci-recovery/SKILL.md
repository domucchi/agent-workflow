---
name: ci-recovery
description: Recover from failing CI on an MR/PR. Use when checking CI status, reading failed job logs, deciding whether an obvious fix is safe, making one fix attempt, or reporting CI failures back to the human.
---

# CI Recovery

Poll snapshots. Do not watch indefinitely.

## Read First

Read repo instructions, project lore, task artifacts, MR/PR state, and current CI status.

## Failure Handling

On failure:

1. Read the failed job log.
2. Identify whether there is one obvious fix.
3. If yes, make one fix attempt and verify locally.
4. Stop and report.

Do not loop through repeated fixes without a human turn.

## Reporting

If green, tell the human the draft MR/PR is ready for their review.

If still failing, report:

- failing check/job
- relevant log excerpt or summary
- attempted fix, if any
- recommended next action

Record useful notes in `scratch.md` under `CI notes`.
