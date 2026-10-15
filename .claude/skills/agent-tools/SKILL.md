---
name: agent-tools
description: Index of token-saving workflow scripts for this repo. Read at the start of any coding, testing, committing, or release task in /home/ccgram/my_task, before running pnpm/vitest/playwright/git commit directly.
---

# Agent tools (scripts/agent/)

Prefer these scripts over raw pnpm/git commands: they print a short summary; full logs
are in `.agent-logs/<run-id>/`. Each supports `-h`.

- **verify** — `scripts/agent/verify.sh [--fast | --test <file> [-t name]]`: lint + typecheck + vitest; ends `VERIFY PASS/FAIL`.
- **e2e** — `scripts/agent/e2e.sh [spec...] [-g grep] [--prod <dir>]`: isolated Playwright run (own DB, port, distDir).
- **release** — `scripts/agent/release.sh status|build|promote|rollback`: fresh `.next-release-*` build + smoke; `promote` (restart live service) only with user approval.
- **ship** — `scripts/agent/ship.sh -m "type(scope): subject" -- <paths>`: commit only those paths, trailer, push; `--status` for dirty summary.
- **plan-task** — `/plan-task` skill: write `docs/superpowers/plans/YYYY-MM-DD-<slug>.md`, then test-first task loop with verify + ship.

Loop: write failing test → implement → `verify.sh --fast` → `ship.sh` per subtask → push when all pass.
