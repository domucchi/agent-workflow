---
name: independent-review
description: Request a fresh read-only peer review before opening a draft MR/PR or asking the human to review. Use after implementation and verification when an independent agent, subagent, or peer CLI should inspect the task diff, artifacts, and verification evidence.
---

# Independent Review

Independent review means a fresh reviewer. Do not satisfy it by reviewing your own diff in the same context.

## Read First

Read repo instructions, project lore, task `context.md`, task `spec.md` if present, verification notes, and current diff.

## Reviewer Choice

Match reviewer strength to risk.

Use a fresh read-only subagent for small or medium changes when the diff is narrow, behavior is clear, and the touched area is low risk.

Prefer a different tool/vendor through peer CLI for:

- large diffs
- architecture changes
- auth, payments, permissions, migrations, security, or data-loss risk
- broad refactors
- hard-to-test behavior
- changes where the implementer is uncertain

Peer CLI paths:

- From Codex, call `peer_cli.call_claude`.
- From Claude Code, call `peer_cli.call_codex`.
- Use the task worktree as `cwd`.
- Use read-only mode: `sandbox: "read-only"` for Codex, `tool_mode: "read-only"` for Claude.

If the stronger reviewer is warranted but peer CLI MCP is unavailable, use the best fresh read-only reviewer available and state the limitation in the review notes.

If no independent reviewer is available, stop and ask the user. Do not mark review passed yourself.

## Handoff Prompt

Give the reviewer enough raw material to judge the work:

- task request and relevant conversation constraints
- `context.md`
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
