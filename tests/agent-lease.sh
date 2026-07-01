#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/agent-lease-test.XXXXXX")"
cleanup_pids=()

cleanup() {
  local pid
  for pid in ${cleanup_pids[@]+"${cleanup_pids[@]}"}; do
    kill "$pid" 2>/dev/null || true
  done
  for pid in ${cleanup_pids[@]+"${cleanup_pids[@]}"}; do
    wait "$pid" 2>/dev/null || true
  done
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

start_holder() {
  sleep 30 &
  last_holder="$!"
  cleanup_pids+=("$last_holder")
}

assert_no_waiter_files() {
  local project_home="$1"
  if find "$project_home" -type f \( -name '*waiter*' -o -name '*queue*' \) | grep -q .; then
    fail "waiter or queue files were created"
  fi
}

unused_port() {
  local port
  port=$((49152 + RANDOM % 10000))
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; do
    port=$((49152 + RANDOM % 10000))
  done
  printf '%s\n' "$port"
}

export AGENT_WORKFLOW_HOME="$tmp_dir/home"
project_id="test-project"
task_id="TASK-agent-lease"
worktree="$AGENT_WORKFLOW_HOME/projects/$project_id/tasks/$task_id/worktree"
project_home="$AGENT_WORKFLOW_HOME/projects/$project_id"
mkdir -p "$worktree" "$project_home"
cat > "$project_home/PROJECT.md" <<'PROJECT'
# Project Lore

## Dev Stack

Lease resource: test-dev
Canonical ports:
Max wait seconds: 2
Port grace seconds: 2
PROJECT

start_holder
holder="$last_holder"
start_holder
next_holder="$last_holder"
"$repo_root/bin/agent-lease" claim race-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" >"$tmp_dir/race-a.out" 2>"$tmp_dir/race-a.err" &
race_a="$!"
"$repo_root/bin/agent-lease" claim race-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" >"$tmp_dir/race-b.out" 2>"$tmp_dir/race-b.err" &
race_b="$!"
race_success=0
if wait "$race_a"; then
  race_success=$((race_success + 1))
fi
if wait "$race_b"; then
  race_success=$((race_success + 1))
fi
[ "$race_success" -eq 1 ] || fail "concurrent claim allowed $race_success winners"
"$repo_root/bin/agent-lease" release race-dev --project-id "$project_id" --force

start_holder
holder="$last_holder"
"$repo_root/bin/agent-lease" claim test-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" >/dev/null
"$repo_root/bin/agent-lease" list --project-id "$project_id" test-dev | grep -q "test-dev[[:space:]]live" || fail "claim was not listed live"
"$repo_root/bin/agent-lease" release test-dev --project-id "$project_id" --pid "$holder"
[ ! -e "$project_home/leases/test-dev.json" ] || fail "release did not remove lease"

start_holder
holder="$last_holder"
start_holder
next_holder="$last_holder"
"$repo_root/bin/agent-lease" claim wait-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" >/dev/null
(
  sleep 1
  "$repo_root/bin/agent-lease" release wait-dev --project-id "$project_id" --pid "$holder"
) &
"$repo_root/bin/agent-lease" claim wait-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" --wait --max-wait 5 >/dev/null
grep -q "\"holder_pid\": $next_holder" "$project_home/leases/wait-dev.json" || fail "wait claim did not acquire after release"
"$repo_root/bin/agent-lease" release wait-dev --project-id "$project_id" --pid "$next_holder"

start_holder
holder="$last_holder"
"$repo_root/bin/agent-lease" claim stale-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" >/dev/null
kill -9 "$holder" 2>/dev/null || true
wait "$holder" 2>/dev/null || true
start_holder
next_holder="$last_holder"
"$repo_root/bin/agent-lease" claim stale-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" >/dev/null
grep -q "\"holder_pid\": $next_holder" "$project_home/leases/stale-dev.json" || fail "dead holder was not reaped"
"$repo_root/bin/agent-lease" release stale-dev --project-id "$project_id" --pid "$next_holder"

start_holder
holder="$last_holder"
"$repo_root/bin/agent-lease" claim timeout-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" >/dev/null
start_holder
next_holder="$last_holder"
if "$repo_root/bin/agent-lease" claim timeout-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" --wait --max-wait 1 >/dev/null 2>&1; then
  fail "claim --wait succeeded despite max wait"
fi
assert_no_waiter_files "$project_home"
if "$repo_root/bin/agent-lease" release timeout-dev --project-id "$project_id" --pid "$next_holder" >/dev/null 2>&1; then
  fail "wrong holder released live lease"
fi
"$repo_root/bin/agent-lease" release timeout-dev --project-id "$project_id" --pid "$holder"

start_holder
holder="$last_holder"
port="$(unused_port)"
"$repo_root/bin/agent-lease" claim grace-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" --port "$port" >/dev/null
start_holder
next_holder="$last_holder"
if "$repo_root/bin/agent-lease" claim grace-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" >/dev/null 2>&1; then
  fail "unbound port was reaped before grace elapsed"
fi
"$repo_root/bin/agent-lease" release grace-dev --project-id "$project_id" --pid "$holder"

start_holder
holder="$last_holder"
"$repo_root/bin/agent-lease" claim port-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$holder" --port "$port" >/dev/null
start_holder
next_holder="$last_holder"
"$repo_root/bin/agent-lease" reap port-dev --project-id "$project_id" --port-grace 0 | grep -q "reaped port-dev" || fail "reap did not remove unbound port lease"
"$repo_root/bin/agent-lease" claim port-dev --project-id "$project_id" --task-id "$task_id" --worktree "$worktree" --pid "$next_holder" --port-grace 0 >/dev/null
grep -q "\"holder_pid\": $next_holder" "$project_home/leases/port-dev.json" || fail "unbound port lease was not reaped"

printf 'agent-lease tests passed\n'
