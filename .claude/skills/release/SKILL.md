---
name: release
description: Build, smoke-test and deploy the production server (systemd my-task.service on port 3001) safely. Use when the user asks to release/deploy/ship/publish to production, rebuild or restart the live site, check which build is live, roll back production, or clean up old .next-release-* / .next-e2e-* build dirs. Do not use for dev servers or for running Vitest/Playwright.
---

# Release production (my-task.service)

One script does the whole workflow and prints only a short summary; full logs go to
`.agent-logs/<run-id>/` (path printed on failure). Never run `pnpm build` / `next start`
by hand against the live dist dir.

## Workflow

1. `scripts/agent/release.sh status --smoke` — live dir, service state, release dirs
   (`[LIVE]`, `[PREVIOUS]`, `smoke-ok@<sha>` marker), prod smoke result.
2. `scripts/agent/release.sh build --label <short-topic>` (5–10 min, run in background
   if needed). Creates a NEW `.next-release-<label>-<utc ts>`, builds with the service's
   env (NEXT*PUBLIC*\* are inlined at build time), starts it on a free port ≥3110, runs
   `scripts/smoke-storefront.mjs`, always kills the temp server. Success = last line
   `READY <dir>`; anything else = failure.
3. **STOP and ASK THE USER** before promoting: give the dir, commit (note if the tree was
   dirty — uncommitted WIP is in the build) and the smoke summary. Restarting the live
   service needs explicit approval EVERY time; a previous approval does not carry over.
4. After approval: `scripts/agent/release.sh promote <dir>`. It rewrites the drop-in
   `~/.config/systemd/user/my-task.service.d/release.conf`, daemon-reload, restart, waits
   for :3001, smokes it. On failure it auto-rolls back to the previous dir.
   Use `--dry-run` to show what would happen.
5. Report: `OK live=… previous=…` (or the failure + rollback result) and the rollback
   command.

Other commands:

- `rollback [dir]` — back to the recorded previous dir (or the given one) + smoke. Also
  a live-service restart: ask the user first unless production is already broken and they
  asked you to fix it.
- `prune [--keep N]` — dry-run by default (keeps live, previous and N newest releases,
  removes all `.next-e2e-*`). Only add `--yes` after the user confirms the list.

## On failure

- `build` failure prints filtered compile/type/env errors; fix the code, rebuild into a
  new dir (the failed dir is left behind; delete only that dir if not needed).
- Smoke failure prints failing paths (`/path: HTTP 500`); check
  `.agent-logs/<run-id>/server.log`.
- `promote` stops with a schema warning when `prisma/schema.prisma`/migrations differ from
  the live build: tell the user `prisma migrate deploy` on the production DB is needed
  first; only rerun with `--schema-ok` after they confirm it was done.
- `✗✗ ROLLBACK CŨNG FAIL` = production may be down: tell the user immediately with
  `systemctl --user status my-task.service` output.

## Invariants

- Never build into, overwrite, or delete the live or previous dist dir; never reuse a dir.
- Never run fixture E2E against a release dir that will be promoted (copy it to
  `.next-e2e-*` instead — Next caches data in the dist dir).
- Never print env values/secrets; don't edit `domain.conf` or `.env*`.
- Test promote/rollback logic only with overrides (`RELEASE_DROPIN=/tmp/x.conf
RELEASE_SYSTEMCTL="echo systemctl"`), never against the real unit without approval.
