---
name: independent-review
description: Request a fresh read-only peer review before opening a draft MR/PR or asking the human to review. Use after implementation and verification when an independent agent, subagent, or peer CLI should inspect the task diff, artifacts, and verification evidence.
---

# Independent Review

Independent review means a fresh reviewer. Do not satisfy it by reviewing your own diff in the same context.

## Read First

Read repo instructions, project lore, task `context.md` if present, task `spec.md` if present, verification notes, and current diff.

## Reviewer Choice

Match reviewer strength to risk.

For tiny mechanical changes, skip independent review only when project lore allows it and local verification passed.

For normal changes, use one fresh read-only subagent before draft PR/MR.

If the first review finds medium or high severity findings, fix valid findings and request one re-review. Do not keep looping without a human turn.

Risky changes require review. Consider a second reviewer when risk remains after the first pass.

Prefer a different tool/vendor through peer CLI for:

- large diffs
- architecture changes
- auth, payments, permissions, migrations, security, or data-loss risk
- broad refactors
- hard-to-test behavior
- changes where the implementer is uncertain
- project lore explicitly prefers peer CLI for this class of work

Peer CLI paths:

- From Codex, call `peer_cli.call_claude`.
- From Claude Code, call `peer_cli.call_codex`.
- Use the task worktree as `cwd`.
- Use read-only mode: `sandbox: "read-only"` for Codex, `tool_mode: "read-only"` for Claude.

If the stronger reviewer is warranted but peer CLI MCP is unavailable, use the best fresh read-only reviewer available and state the limitation in the review notes.

If no independent reviewer is available, stop and ask the user. Do not mark review passed yourself.

## Double Review

Use both a fresh read-only subagent and peer CLI only when the extra review cost is justified:

- security, auth, payments, permissions, migrations, or data-loss risk
- large architectural changes
- broad refactors across ownership boundaries
- fragile frontend flows where visual or runtime behavior matters
- previous reviewer found substantial issues
- implementer is uncertain
- task had repeated failed attempts
- project lore asks for double review on this kind of change

Preferred order:

1. Fresh read-only subagent for a quick local/codebase pass.
2. Peer CLI/different-tool review for stronger independent judgment.

Do not double review narrow mechanical changes.

If reviews disagree, resolve concrete findings first. Ask the user when disagreement is product or architecture judgment.

## Handoff Prompt

Give the reviewer enough raw material to judge the work:

- task request and relevant conversation constraints
- `context.md`, if present
- `spec.md`, if present
- verification evidence
- changed files list
- full diff, including untracked files
- repo instructions and project lore relevant to review

Ask for this output shape:

```text
Outcome: passed | changes_requested | needs_user_decision | failed_to_run
Findings:
- severity, file/line, issue, suggested fix
Residual risk:
```

Reviewer must not edit files. Reviewer judges code, spec fit, regressions, missing tests, and verification evidence.

## Consume Result

Interpret the peer result yourself. If findings are valid, fix them or ask the user when product/architecture judgment is needed.

Save useful reviewer output under `reviews/` when worth keeping. Record a short summary in `scratch.md` under `Independent review notes`.

Open or update a draft MR/PR only after review findings are addressed or explicitly accepted by the user.
