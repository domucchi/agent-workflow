#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/agent-cp-test.XXXXXX")"
server_pid=""

cleanup() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  AGENT_WORKFLOW_HOME="$AGENT_WORKFLOW_HOME" "$repo_root/bin/agent-preview" --project-id "$project_id" down >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

unused_port() {
  local port
  port=$((49152 + RANDOM % 10000))
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; do
    port=$((49152 + RANDOM % 10000))
  done
  printf '%s\n' "$port"
}

command -v bun >/dev/null 2>&1 || {
  printf 'SKIP: bun not installed\n'
  exit 0
}
command -v curl >/dev/null 2>&1 || fail "curl is required"

export AGENT_WORKFLOW_HOME="$tmp_dir/home"
export XDG_CONFIG_HOME="$tmp_dir/config"
project_id="test-project"
task_id="TASK-cp"
project_home="$AGENT_WORKFLOW_HOME/projects/$project_id"
worktree="$project_home/tasks/$task_id/worktrees/cp-task"
second_worktree="$project_home/tasks/$task_id/worktrees/cp-task-alt"
canonical_only_task="TASK-canonical"
canonical_only_worktree="$project_home/tasks/$canonical_only_task/worktrees/canonical-only"
repo="$tmp_dir/repo"
repo_real=""
port="$(unused_port)"

git init -q -b main "$repo"
git -C "$repo" config user.name "Agent Test"
git -C "$repo" config user.email "agent@example.invalid"
touch "$repo/README.md"
git -C "$repo" add README.md
git -C "$repo" commit -q -m "seed"
repo_real="$(cd "$repo" && pwd -P)"

mkdir -p "$project_home/tasks/$task_id"
git -C "$repo" worktree add -q -b cp-task "$worktree" main
mkdir -p "$project_home/tasks/$canonical_only_task"
git -C "$repo" worktree add -q -b canonical-only "$canonical_only_worktree" main
cat > "$project_home/PROJECT.md" <<'PROJECT'
# Project Lore

## Dev Stack

Lease resource: cp-dev
Canonical ports:
Max wait seconds: 1
Port grace seconds: 1
Up command: while true; do sleep 1; done
Down command:
Env seed rule: none
Shared infra: test

## Preview Profile

Preview ports: 45200 45201
Preview up command: while true; do sleep 1; done
Preview down command:
Shared infra (same as dev stack): test
Lease policy: never claimed or reaped
PROJECT

(
  cd "$repo_root/packages/control-plane"
  bun install >/dev/null
  bun run build >/dev/null
)

AGENT_CP_TOKEN="test-token" \
AGENT_CP_HOST="127.0.0.1" \
AGENT_CP_PORT="$port" \
  bun run "$repo_root/packages/control-plane/src/server.ts" >"$tmp_dir/server.out" 2>"$tmp_dir/server.err" &
server_pid="$!"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

curl -fsS "http://127.0.0.1:$port/health" | grep -q '"ok":true' || fail "health endpoint failed"
if curl -fsS "http://127.0.0.1:$port/api/worktrees" >/dev/null 2>&1; then
  fail "worktrees API allowed missing token"
fi
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q "\"task\":\"$task_id\"" || fail "worktrees API did not derive task"
canonical_response="$(curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id")"
printf '%s' "$canonical_response" | grep -q "\"task\":\"$canonical_only_task\"" || fail "worktrees API did not derive canonical-only task"
if printf '%s' "$canonical_response" | grep -q "\"task\":\"$canonical_only_task\",\"worktreeId\":\"default\""; then
  fail "worktrees API emitted phantom default row for canonical-only task"
fi
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"worktreeCleanup":' || fail "worktrees API did not derive worktree cleanup status"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q "\"repoRoot\":\"$repo_real\"" || fail "worktrees API did not derive main repo"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/editors" |
  grep -q '"editors":' || fail "editors API failed"
if curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"editor\":\"missing-editor\",\"path\":\"$repo\"}" \
  "http://127.0.0.1:$port/api/open" >/dev/null 2>&1; then
  fail "open API accepted unavailable editor"
fi

start_response="$(curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"action\":\"up\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/dev")"
printf '%s' "$start_response" | grep -q '"ok":true' || fail "dev start failed"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"pid":"' || fail "worktrees API did not expose dev pid"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"leases":\[{"resource":"cp-dev"' || fail "worktrees API did not expose task lease"

if curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"action\":\"down\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/dev" >/dev/null 2>&1; then
  fail "dev stop did not require confirmation"
fi
curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"action\":\"down\",\"confirm\":\"stop dev\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/dev" |
  grep -q '"ok":true' || fail "dev stop failed"

git -C "$repo" worktree add -q -b cp-task-alt "$second_worktree" main
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"worktreeId":"cp-task-alt"' || fail "worktrees API did not derive secondary worktree"
if curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/worktrees/cp-task-alt/cleanup" >/dev/null 2>&1; then
  fail "worktree cleanup did not require confirmation"
fi
if curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"force\":true,\"confirm\":\"wrong\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/cleanup" >/dev/null 2>&1; then
  fail "force task cleanup accepted wrong task confirmation"
fi
if curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"force\":true,\"confirm\":\"wrong\"}" \
  "http://127.0.0.1:$port/api/worktrees/$task_id/worktrees/cp-task-alt/cleanup" >/dev/null 2>&1; then
  fail "force worktree cleanup accepted wrong worktree confirmation"
fi

preview_response="$(curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"action\":\"up\",\"worktree\":\"$worktree\"}" \
  "http://127.0.0.1:$port/api/preview")"
printf '%s' "$preview_response" | grep -q '"previewUrl":"http://127.0.0.1:45201"' || fail "preview start did not return link"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"active":true' || fail "worktrees API did not mark active preview row"
curl -fsS -H "Authorization: Bearer test-token" "http://127.0.0.1:$port/api/worktrees?projectId=$project_id" |
  grep -q '"pid":"' || fail "worktrees API did not expose preview pid"
curl -fsS -H "Authorization: Bearer test-token" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$project_id\",\"action\":\"down\",\"confirm\":\"stop preview\"}" \
  "http://127.0.0.1:$port/api/preview" |
  grep -q '"ok":true' || fail "preview stop failed"

printf 'control-plane tests passed\n'
