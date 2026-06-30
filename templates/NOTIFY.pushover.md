# Notify: Pushover

Provider: pushover

Credentials live in `~/.config/agent-workflow/pushover.env`:

- `PUSHOVER_APP_TOKEN`
- `PUSHOVER_USER_KEY`
- optional `PUSHOVER_DEVICE`

Do not source that file from shell startup. Use the wrapper; it sources credentials only for the send process.

Use only for human stop conditions. `execution-mode` owns the canonical stop-condition list for autonomous runs.

Message policy:

- attention-worthy but low-detail
- include repo/project id, task id, reason, and safe link if available
- no secrets, logs, diffs, code, customer data, or confidential context
- omit links if company policy treats external notification URLs as sensitive

Priority:

- `0` for ready-for-review notifications
- `1` for blocked / human decision needed
- the bundled wrapper does not support priority `2`

Pushover command shape:

```bash
AGENT_NOTIFY_TITLE="${AGENT_NOTIFY_TITLE:-Agent Workflow}" \
AGENT_NOTIFY_MESSAGE="<safe one-line message>" \
AGENT_NOTIFY_PRIORITY="${AGENT_NOTIFY_PRIORITY:-0}" \
~/.agent-workflow/bin/agent-notify
```

Optional safe URL fields:

```bash
AGENT_NOTIFY_URL="<safe-url>"
AGENT_NOTIFY_URL_TITLE="${AGENT_NOTIFY_URL_TITLE:-Open task}"
```

Check the API response. A successful Pushover response has `status: 1`.
