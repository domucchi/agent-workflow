---
name: draft-pr
description: Open or update a draft pull request or merge request after implementation, verification, and review. Use when Codex needs to create a PR/MR body, apply a project PR/MR template, check for an existing change request on the current branch, decide draft vs ready state, or prepare the final link before CI/notification.
---

# Draft PR

Open or update a draft PR/MR. Do not create duplicates for the same branch.

## Read First

Read repo instructions and `~/.agent-workflow/projects/<project-id>/PROJECT.md`. Follow the project's PR/MR preference first.

Read current diff, recent commits, verification notes, review notes, and existing PR/MR if one already exists for the branch.

## Existing PR/MR

Probe the forge before creating anything:

- current branch
- existing open PR/MR for that branch
- current title/body/draft state, when found

If one exists, update it instead of opening another. Preserve useful human-written content unless it is stale or contradicted by the current diff.

## Body Source

Use body shape in this order:

1. Project PR/MR preference from `PROJECT.md`.
2. Template named by that preference, such as `.agent-workflow/PR_TEMPLATE.md`.
3. Existing PR/MR body, if updating and still useful.
4. Concise fallback body from actual diff and verification.

Do not globally search forge template conventions unless project lore or repo instructions point there.

## Body Rules

Write from facts, not intention.

Include:

- what changed
- verification actually run
- review notes or risks the human should know

Delete irrelevant template sections and empty checklist items. Keep checklists only when they mean something for this task.

Do not include secrets, logs, huge diffs, or confidential details. Link to safe evidence when useful.

## Draft State

Default to draft. Use ready-for-review only when the user or project explicitly asks and all required verification/review gates have passed.

## Title

Prefer the issue title or branch-derived task title. Keep it short. Preserve existing human-edited title unless it is clearly wrong.

## After Opening Or Updating

Record the PR/MR link in `scratch.md` or `handoff.md` only if it helps the next session. Do not store PR/MR status; status is derived by probing.

Then continue with CI snapshot/recovery if the execution mode calls for it.
