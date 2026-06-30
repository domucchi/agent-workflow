---
name: verifying-changes
description: Verify code changes before review, MR/PR, or handoff. Use after implementation, especially for frontend or user-facing UI changes requiring browser checks, Playwright MCP screenshots/snapshots, local tests, or project-specific verification commands.
---

# Verifying Changes

Verify the behavior that changed. Do not treat typecheck alone as enough for UI work.

## Read First

Read repo instructions and `~/agent-workspace/<project>/PROJECT.md` if present. Use project-specific verify commands and local app URLs from project lore when available.

## Command Checks

Run the narrowest meaningful checks first, then broader checks when risk or project lore calls for them:

- tests for touched code
- typecheck
- lint/format checks
- build
- project full gate when required

Record useful commands and results in `scratch.md` under `Verification notes`.

## Browser Checks

For frontend or user-facing UI changes, use Playwright MCP when available.

Check:

- changed route or screen at realistic desktop size
- relevant mobile viewport
- main interaction path
- loading, empty, error, and disabled states when touched
- visual overlap, clipped text, broken assets, console/runtime errors when inspectable

Use accessibility snapshots for structure and screenshots for visual proof. Save important screenshots under `screenshots/`.

If Playwright MCP is unavailable, use the project's browser verification fallback from `PROJECT.md` or ask the user for the correct preview path.

## Freshness

Any implementation change after verification makes prior verification stale. Refresh the relevant checks before independent review or draft MR/PR.
