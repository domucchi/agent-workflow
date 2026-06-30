# Notify: Pushover

Provider: pushover

Credentials are environment variables, not file contents:

- `PUSHOVER_APP_TOKEN`
- `PUSHOVER_USER_KEY`
- optional `PUSHOVER_DEVICE`

Use only for human stop conditions. `execution-mode` owns the canonical stop-condition list for autonomous runs.

Message policy:

- attention-worthy but low-detail
- include repo/project id, task id, reason, and safe link if available
- no secrets, logs, diffs, code, customer data, or confidential context
- omit links if company policy treats external notification URLs as sensitive

Priority:

- `0` for ready-for-review notifications
- `1` for blocked / human decision needed
- never use `2` unless explicitly configured with retry/expire handling

Pushover command shape:

```bash
curl -fsS https://api.pushover.net/1/messages.json \
  --data-urlencode "token=$PUSHOVER_APP_TOKEN" \
  --data-urlencode "user=$PUSHOVER_USER_KEY" \
  --data-urlencode "title=${AGENT_NOTIFY_TITLE:-Agent Workflow}" \
  --data-urlencode "message=$AGENT_NOTIFY_MESSAGE" \
  --data-urlencode "priority=${AGENT_NOTIFY_PRIORITY:-0}"
```

Optional safe URL fields:

```bash
--data-urlencode "url=$AGENT_NOTIFY_URL"
--data-urlencode "url_title=${AGENT_NOTIFY_URL_TITLE:-Open task}"
```

Check the API response. A successful Pushover response has `status: 1`.
