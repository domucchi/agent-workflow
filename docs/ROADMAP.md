# Control Plane Roadmap

Evolving `agent-workflow` from a stateless skill library into a small control plane for concurrent agents: a leased dev stack, an always-available operator preview, a phone-accessible dashboard, and conservative auto-cleanup.

## Core principles (do not weaken)

- **One project = one leased dev stack.** Mutual exclusion, not parallel isolation. (Shared Postgres/RabbitMQ/MinIO make two live stacks unsafe regardless of ports.)
- **`~/.agent-workflow` is the contract/bus.** No parallel store, no cached/derived tables — every consumer re-derives from filesystem + git + forge state.
- **Reap-by-liveness is the correctness property.** Leases are annotation; `kill -0` / `lsof` are truth; `release` is best-effort.
- **Worktree invariant.** Agents never mutate the main checkout (read-only inspection excepted); all work happens in a per-task worktree off the base branch. Work outside a worktree is invisible to the lease/dashboard/cleanup layers.
- **Skills stay pure bash + markdown, portable to Codex.** New runtime code is additive and preserves `bin/apply | init-local | init-project`.

## Phases

Build in dependency order. Each phase is usable on its own — **no hard gate between them**; later phases just shell out to earlier CLIs.

- [x] **Phase 0 — State contract** — #1
  `~/.agent-workflow` bus, `docs/STATE.md`, and the `PROJECT.md` dev-stack block (incl. the preview profile). Foundation every later phase reads/writes.
- [x] **Phase 1 — `agent-lease`** — #2
  Single dev-stack lease with reap-by-liveness and a jittered-backoff `claim --wait` (no queue). New `managing-resources` skill. *Depends on Phase 0.*
- [x] **Phase 2 — dev / preview / cleanup CLIs** — #3
  `agent-dev` (lease-coupled lifecycle, seeds `.env`, no orphans), `agent-preview` (operator lane on a second fixed port set over the same shared data, never leased), `agent-cleanup` (conservative dry-run-first reaper). *Depends on Phase 1.*
- [ ] **Phase 3 — Control-plane web UI** — #4
  Bun + Hono daemon: read-model + actuator over the contract. Local token + confirm-on-dangerous + Tailscale. Holds no state; every button shells the same CLI. *Depends on Phase 2.*
- [ ] **Phase 4 — Cleanup automation + hardening** — #5
  launchd cron running `agent-cleanup` on the conservative matrix; stale-lease reaping; orphan detection; optional Pushover notify. *Depends on Phase 2 (UI surfacing via Phase 3).*
- [ ] **Phase 5 — Life-agent** — #6
  Named only, separate repo, out of scope here. Reads the same shared state + forge; adds Slack digest / daily brief. Scope TBD after Phases 1–4.

## Two runtime lanes (same shared data plane)

- **Agent lane** — canonical ports (Axterio `4100`/`4101`), the single contended dev-stack lease, ephemeral.
- **Operator preview lane** — a second fixed port set (Axterio `4200`/`4201`) reserved for the human, never claimed or reaped. Shares the agents' Postgres/RabbitMQ/MinIO (accepted tradeoff: an agent e2e run may churn what you're browsing; browsing doesn't corrupt anything).

## Reference

Full design lives in the plan file used to generate this roadmap. Update the checkboxes as phases land; close the linked issue when a phase's acceptance criteria pass.
