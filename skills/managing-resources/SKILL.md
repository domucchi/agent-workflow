---
name: managing-resources
description: Claim and release shared local dev-stack resources before browser, e2e, or app-runtime work that touches a project's shared services.
---

# Managing Resources

Use a lease only for shared runtime resources. Unit tests, type checks, lint,
formatting, static analysis, and docs edits do not need a dev-stack lease.

## Read First

Read repo instructions and `~/.agent-workflow/projects/<project-id>/PROJECT.md`.
The dev-stack block names the lease resource, canonical ports, lifecycle commands,
env seed rule, shared infra, max wait, port grace, and preview profile. Keep
numeric defaults inline after their labels so CLIs can read them.

## Worktree Invariant

Agents run app work from task worktrees:

```text
~/.agent-workflow/projects/<project-id>/tasks/<task-id>/worktree/
```

Do not run leased app workflows from the main checkout unless the human explicitly
asks for it. Work outside a task worktree is invisible to lease, dashboard, and
cleanup tooling.

## When To Claim

Claim before commands that start or drive the shared dev stack, including:

- browser verification against the app
- e2e tests
- local app servers that use shared Postgres, RabbitMQ, MinIO, or similar services

Do not claim for:

- unit tests
- type checks
- lint or formatting
- code generation that does not start the app
- read-only investigation

## Pattern

Use the resource and ports from `PROJECT.md` unless the task explicitly overrides
them.

```bash
holder_pid="$$"
agent-lease claim --wait --pid "$holder_pid" <resource>
trap 'agent-lease release --pid "$holder_pid" <resource>' EXIT

# run app/e2e/browser work
```

If `claim --wait` times out, stop and notify the human. Do not create queue files,
waiter files, or side-channel state.

## Preview Lane

The operator preview profile is never claimed or reaped. It uses separate fixed
ports over the same shared infra so the human can inspect the app while agents
coordinate through the leased agent lane.
