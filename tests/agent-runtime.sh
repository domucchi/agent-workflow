#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/agent-runtime-test.XXXXXX")"

cleanup() {
  AGENT_WORKFLOW_HOME="$tmp_dir/home" "$repo_root/bin/agent-preview" --project-id test-project down >/dev/null 2>&1 || true
  AGENT_WORKFLOW_HOME="$tmp_dir/home" "$repo_root/bin/agent-dev" --project-id test-project down TASK-runtime >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

cleanup_output() {
  "$repo_root/bin/agent-cleanup" --project-id "$project_id" --dry-run "$1" 2>/dev/null || true
}

make_worktree() {
  local task="$1"
  local branch="$2"
  local id path
  id="$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  path="$project_home/tasks/$task/worktrees/$id"
  mkdir -p "$(dirname "$path")"
  git -C "$repo" worktree add -q -b "$branch" "$path" main
  git -C "$path" push -u origin "$branch" >/dev/null 2>&1
  printf '%s\n' "$path"
}

export AGENT_WORKFLOW_HOME="$tmp_dir/home"
export XDG_CONFIG_HOME="$tmp_dir/config"
project_id="test-project"
project_home="$AGENT_WORKFLOW_HOME/projects/$project_id"
remote="$tmp_dir/remote.git"
repo="$tmp_dir/repo"

"$repo_root/bin/init-local" >/dev/null
for installed in agent-dev agent-preview agent-cleanup; do
  "$AGENT_WORKFLOW_HOME/bin/$installed" --help >/dev/null 2>&1
done
"$AGENT_WORKFLOW_HOME/bin/agent-lease" claim --help >/dev/null 2>&1

git init -q --bare "$remote"
git init -q -b main "$repo"
git -C "$repo" config user.name "Agent Test"
git -C "$repo" config user.email "agent@example.invalid"
git -C "$repo" remote add origin "$remote"
cat > "$repo/.gitignore" <<'GITIGNORE'
.env
GITIGNORE
cat > "$repo/.env.example" <<'ENV'
AGENT_RUNTIME_TEST=1
ENV
git -C "$repo" add .gitignore .env.example
git -C "$repo" commit -q -m "seed"
git -C "$repo" push -u origin main >/dev/null 2>&1

mkdir -p "$project_home"
cat > "$project_home/PROJECT.md" <<'PROJECT'
# Project Lore

## Dev Stack

Lease resource: runtime-dev
Canonical ports:
Max wait seconds: 2
Port grace seconds: 2
Up command: while true; do sleep 1; done
Down command:
Env seed rule: .env.example
Shared infra: test

## Preview Profile

Preview ports:
Preview up command: while true; do sleep 1; done
Preview down command:
Shared infra (same as dev stack): test
Lease policy: never claimed or reaped
PROJECT

runtime_worktree="$(make_worktree TASK-runtime runtime-task)"
make_worktree TASK-wrong runtime-wrong >/dev/null
if "$repo_root/bin/agent-dev" --project-id "$project_id" --worktree "$repo" up TASK-wrong >"$tmp_dir/wrong-worktree.out" 2>"$tmp_dir/wrong-worktree.err"; then
  fail "agent-dev accepted a non-task worktree"
fi
grep -q "leased dev workflows must use a task worktree" "$tmp_dir/wrong-worktree.err" || fail "agent-dev did not explain task worktree requirement"

"$repo_root/bin/agent-dev" --project-id "$project_id" up TASK-runtime >/tmp/agent-runtime-dev-up.out
sleep 0.5
"$repo_root/bin/agent-dev" --project-id "$project_id" status TASK-runtime | grep -q "state=running" || fail "dev did not report running"
[ -f "$runtime_worktree/.env" ] || fail ".env was not seeded"
[ -f "$project_home/leases/runtime-dev.json" ] || fail "dev lease was not created"

"$repo_root/bin/agent-preview" --project-id "$project_id" --worktree "$runtime_worktree" up >/tmp/agent-runtime-preview-up.out
sleep 0.5
"$repo_root/bin/agent-preview" --project-id "$project_id" status | grep -q "state=running" || fail "preview did not report running"
runtime_worktree_physical="$(cd "$runtime_worktree" && pwd -P)"
"$repo_root/bin/agent-preview" --project-id "$project_id" status | grep -q "worktree=$runtime_worktree_physical" || fail "preview did not report worktree"
[ -f "$project_home/run/preview.json" ] || fail "preview metadata was not created"
[ -f "$project_home/leases/runtime-dev.json" ] || fail "preview touched dev lease"
"$repo_root/bin/agent-preview" --project-id "$project_id" down >/dev/null
[ ! -e "$project_home/run/preview.json" ] || fail "preview metadata survived down"

wait_worktree="$(make_worktree TASK-wait runtime-wait)"
"$repo_root/bin/agent-dev" --project-id "$project_id" up TASK-wait >/tmp/agent-runtime-wait-up.out
sleep 0.5
"$repo_root/bin/agent-dev" --project-id "$project_id" down TASK-wait >/dev/null
grep -q '"task_id": "TASK-runtime"' "$project_home/leases/runtime-dev.json" || fail "cross-task down released active lease"

dev_pid="$(cat "$project_home/tasks/TASK-runtime/run/dev.pid")"
"$repo_root/bin/agent-dev" --project-id "$project_id" down TASK-runtime >/dev/null
if kill -0 "$dev_pid" 2>/dev/null; then
  fail "dev supervisor survived down"
fi
[ ! -e "$project_home/leases/runtime-dev.json" ] || fail "dev lease survived down"

touch "$project_home/tasks/TASK-runtime/DISPOSABLE"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --execute TASK-runtime | grep -q "archived TASK-runtime" || fail "runtime task with ignored .env was not archived"
[ ! -e "$runtime_worktree" ] || fail "runtime worktree survived cleanup"

eligible_worktree="$(make_worktree TASK-eligible cleanup-eligible)"
touch "$project_home/tasks/TASK-eligible/DISPOSABLE"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --dry-run TASK-eligible | grep -q "eligible TASK-eligible" || fail "eligible task was not listed"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --execute TASK-eligible | grep -q "archived TASK-eligible" || fail "eligible task was not archived"
[ ! -e "$eligible_worktree" ] || fail "eligible worktree survived execute cleanup"
if git -C "$repo" show-ref --verify --quiet refs/heads/cleanup-eligible; then
  fail "eligible branch survived execute cleanup"
fi
find "$project_home/archive" -maxdepth 1 -type d -name 'TASK-eligible-*' | grep -q . || fail "eligible task was not archived under project"

dirty_worktree="$(make_worktree TASK-dirty cleanup-dirty)"
touch "$project_home/tasks/TASK-dirty/DISPOSABLE"
printf 'dirty\n' > "$dirty_worktree/dirty.txt"
cleanup_output TASK-dirty | grep -q "dirty worktree" || fail "dirty task was not refused"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --force --dry-run TASK-dirty | grep -q "eligible TASK-dirty" || fail "force archive did not allow dirty task"

notes_worktree="$(make_worktree TASK-notes cleanup-notes)"
touch "$project_home/tasks/TASK-notes/DISPOSABLE"
printf 'notes\n' > "$project_home/tasks/TASK-notes/context.md"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --execute TASK-notes | grep -q "archived TASK-notes" || fail "notes task was not archived"
[ ! -e "$notes_worktree" ] || fail "notes worktree survived cleanup"
find "$project_home/archive" -maxdepth 1 -type d -name 'TASK-notes-*' | grep -q . || fail "notes task metadata was not archived"

multi_a="$(make_worktree TASK-multi cleanup-multi-a)"
multi_b="$(make_worktree TASK-multi cleanup-multi-b)"
touch "$project_home/tasks/TASK-multi/DISPOSABLE"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --dry-run --worktree-id cleanup-multi-a TASK-multi | grep -q "eligible-worktree TASK-multi cleanup-multi-a" || fail "worktree cleanup was not eligible"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --execute --worktree-id cleanup-multi-a TASK-multi | grep -q "removed-worktree TASK-multi cleanup-multi-a" || fail "worktree cleanup did not remove selected worktree"
[ ! -e "$multi_a" ] || fail "selected worktree survived worktree cleanup"
[ -e "$multi_b" ] || fail "worktree cleanup removed sibling worktree"
if git -C "$repo" show-ref --verify --quiet refs/heads/cleanup-multi-a; then
  fail "selected worktree branch survived worktree cleanup"
fi
git -C "$repo" show-ref --verify --quiet refs/heads/cleanup-multi-b || fail "worktree cleanup removed sibling branch"

mkdir -p "$project_home/tasks/TASK-empty"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --force --execute TASK-empty | grep -q "archived TASK-empty" || fail "force archive did not archive empty task metadata"

mkdir -p "$project_home/tasks/TASK-nongit/worktrees/not-a-git-worktree"
"$repo_root/bin/agent-cleanup" --project-id "$project_id" --force --execute TASK-nongit | grep -q "archived TASK-nongit" || fail "force archive did not archive task with non-git worktree dir"
find "$project_home/archive" -maxdepth 1 -type d -name 'TASK-nongit-*' | grep -q . || fail "non-git worktree task was not archived"

unpushed_path="$project_home/tasks/TASK-unpushed/worktrees/cleanup-unpushed"
mkdir -p "$(dirname "$unpushed_path")"
git -C "$repo" worktree add -q -b cleanup-unpushed "$unpushed_path" main
touch "$project_home/tasks/TASK-unpushed/DISPOSABLE"
printf 'unpushed\n' > "$unpushed_path/unpushed.txt"
git -C "$unpushed_path" add unpushed.txt
git -C "$unpushed_path" commit -q -m "unpushed"
cleanup_output TASK-unpushed | grep -q "unpushed commits" || fail "unpushed task was not refused"

develop_worktree="$(make_worktree TASK-develop develop)"
touch "$project_home/tasks/TASK-develop/DISPOSABLE"
cleanup_output TASK-develop | grep -q "base/integration branch" || fail "base branch task was not refused"

printf 'agent-runtime tests passed\n'
