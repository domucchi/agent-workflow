---
name: notify-human
description: Notify the human when agent work reaches a stop condition. Use when a task needs human judgment, draft MR/PR is ready, CI failed after the allowed recovery attempt, independent review needs a decision, or long-running agent work must get attention through configured notification tooling.
---

# Notify Human

Notify only when attention is needed. Do not send ordinary progress updates.

## Read First

Read `~/.agent-workflow/NOTIFY.md` if present. It defines the preferred provider and command shape.

Set these environment variables for the configured command when useful:

- `AGENT_NOTIFY_TITLE`
- `AGENT_NOTIFY_MESSAGE`
- `AGENT_NOTIFY_PRIORITY`
- `AGENT_NOTIFY_URL`
- `AGENT_NOTIFY_URL_TITLE`

If no notification config exists, fall back to a local macOS notification when available:

```bash
osascript -e 'display notification "Agent needs input" with title "Agent Workflow"'
```

If that is unavailable, use the session message only.

## Stop Conditions

Notify when:

- draft MR/PR is ready for human review
- product, architecture, security, auth, permissions, payments, migration, or data-loss judgment is needed
- independent review finding is not an obvious fix
- CI failed and no obvious fix exists
- the one allowed CI recovery attempt was already used
- the spec appears wrong or incomplete during execution
- the agent is blocked and cannot choose the next action safely

Do not notify for routine step completion.

## Message Rules

Keep notification content attention-worthy but low-detail:

- repo/project id
- task id
- reason human is needed
- draft MR/PR link when safe to share
- instruction to return to the session

Never include:

- secrets, tokens, env values
- code snippets or diffs
- logs or stack traces
- customer data
- confidential business context
- long review findings

If company policy may treat URLs as sensitive, omit URLs and send only a generic return-to-session message.

## Provider Config

Provider-specific details belong in `~/.agent-workflow/NOTIFY.md`, not this skill.

If a configured command fails, report the failure in the session without exposing credential values.
