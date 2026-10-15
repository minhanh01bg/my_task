---
name: ship
description: Commit and push verified work in this repo. Use whenever a subtask's tests pass and it should be committed, when the user says commit/push/ship, or to see what is dirty before committing (`--status`). Commits only the listed paths, validates Conventional Commit format, adds the Co-Authored-By trailer and git identity, pushes the current branch.
---

# /ship — scoped commit + push

The working tree often holds other people's/agents' uncommitted WIP. Never `git add -A`
or `git commit -a`; commit only the files your subtask changed.

## Workflow

1. Verify first: `scripts/agent/verify.sh --fast` (or `--test <file>` for the touched
   tests). Only ship on `VERIFY PASS`. E2E-relevant changes: `scripts/agent/e2e.sh`.
2. See what is dirty: `scripts/agent/ship.sh --status` (grouped by area, ahead/behind).
3. Commit each verified subtask separately, with only its files:
   ```
   scripts/agent/ship.sh -m "fix(checkout): reject empty ward" -- src/features/checkout/address-fields.tsx tests/components/checkout/address-fields.test.tsx
   ```

   - Type ∈ feat fix test refactor chore docs perf style build ci; scope required.
   - `--body "why…"` for detail; `--dry-run` previews; `--no-push` commits only.
   - While a multi-subtask task is still in progress use `--no-push`; push (plain
     `ship.sh` or the last commit without `--no-push`) once the whole task passes.
4. Output is `<sha> <subject>` + `pushed → <upstream>`. Report the sha to the user.

## Rules

- The user wants verified work pushed without asking. Do NOT restart services,
  deploy, or overwrite a live `.next*` build without asking — that is `scripts/agent/release.sh promote`, only on request.
- Refused because "files outside the given paths are already staged": someone else
  staged them. Do not unstage/include them silently; ask, or include only if they are yours.
- Hook (lint-staged) failure prints a short tail; full log path is printed
  (`.agent-logs/…/commit.log`). Fix, then rerun the same command (files stay staged).
- Never `--no-verify`, never amend/force-push pushed commits.
