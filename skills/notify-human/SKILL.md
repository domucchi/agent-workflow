---
name: notify-human
description: Notify the human when agent work reaches a stop condition. Use when a task needs human judgment, draft MR/PR is ready, CI failed after the allowed recovery attempt, independent review needs a decision, or long-running agent work must get attention through configured notification tooling such as Pushover.
---

# Notify Human

Notify only when attention is needed. Do not send ordinary progress updates.

## Read First

Read `~/.agent-workflow/NOTIFY.md` if present. It defines the preferred provider and command shape.

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

Keep notification content short and low-sensitivity:

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

## Pushover

Pushover is the preferred first provider when configured.

Use environment variables for credentials:

- `PUSHOVER_APP_TOKEN`
- `PUSHOVER_USER_KEY`
- optional `PUSHOVER_DEVICE`

Send with `POST https://api.pushover.net/1/messages.json`.

Required fields:

- `token`
- `user`
- `message`

Useful optional fields:

- `title`
- `priority`
- `url`
- `url_title`
- `device`

Use priority `0` by default. Use priority `1` only for real blockers. Do not use emergency priority `2` unless the user explicitly configures it, because it requires retry/expire handling.

Example command shape:

```bash
curl -fsS https://api.pushover.net/1/messages.json \
  --data-urlencode "token=$PUSHOVER_APP_TOKEN" \
  --data-urlencode "user=$PUSHOVER_USER_KEY" \
  --data-urlencode "title=${AGENT_NOTIFY_TITLE:-Agent Workflow}" \
  --data-urlencode "message=$AGENT_NOTIFY_MESSAGE" \
  --data-urlencode "priority=${AGENT_NOTIFY_PRIORITY:-0}"
```

Check the API response. A successful response has `status: 1`. If notification fails, report the failure in the session without exposing credential values.
