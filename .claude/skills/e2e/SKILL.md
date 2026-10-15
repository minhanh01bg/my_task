---
name: e2e
description: Run Playwright E2E specs in an isolated, token-cheap way. Use whenever you need to run, re-run or debug any e2e/*.spec.ts test (dev or production build), verify a UI change end-to-end, smoke-test a .next-release-* build with fixtures, or clean up leftover fixture DBs / .next-e2e-* dirs. Use this instead of calling `pnpm test:e2e` by hand.
---

# E2E (isolated Playwright)

```bash
scripts/agent/e2e.sh e2e/home.spec.ts                       # dev server (next dev)
scripts/agent/e2e.sh e2e/a.spec.ts e2e/b.spec.ts -g "tên test"   # filter by title
scripts/agent/e2e.sh e2e/x.spec.ts --prod .next-release-<id>     # production build (copied)
scripts/agent/e2e.sh                                         # whole suite (slow, ~minutes)
scripts/agent/e2e.sh --clean-stale        # dry-run list of stale fixture DBs/.next-e2e-*; add --yes to delete
```

Extra Playwright flags: put them after `--` (e.g. `-- --retries=1`) or as unknown `--flags`.

Every run is isolated automatically: own SQLite DB `prisma/agent-e2e/<id>.db` (schema pushed,
then global-setup reseeds it), free port from 3120, own distDir `.next-e2e-<id>`, own
`test-results` under `.agent-logs/<id>/`. It never touches `.next`, `prisma/dev.db`,
`prisma/test.db` or the live `my-task` service. Safe alongside other runs.

## Reading output

- Header line, `✓ prisma-db-push`, then `N passed, M failed, K skipped (Ts)`.
- Each failure: `✗ file:line › describe › test` + first 8 lines of the error + paths to
  `error-context` / `screenshot` / `trace` (open the error-context .md first — it is the
  page snapshot; cheaper than the trace).
- `✗ (global) ...` = setup/webServer problem, not a test failure.
- Last line is always `E2E PASS` or `E2E FAIL`. Exit code = Playwright's.
- Full log: `.agent-logs/<id>/playwright.log`; JSON: `report.json` there. Only read them if
  the summary is not enough (grep, don't cat).

## On failure

- Assertion failure: read the error-context file, fix code or test, re-run only that spec
  with `-g` for speed.
- `Timed out waiting 60000ms from config.webServer`: machine overloaded (another
  `next build`/dev compile, low RAM — the script warns when <1GB free). Wait and retry;
  do not edit playwright.config.ts to raise timeouts.
- DB and build copy are KEPT on failure; the printed `dọn: rm -rf ...` line removes them. Or
  `--keep` to keep them after a pass too. Periodically `--clean-stale` (dry-run first).

## Invariants

- Never run fixture E2E against a deploy artifact: `--prod` always `cp -a`s the release dir.
- Always go through this script / `pnpm test:e2e`; never `pnpm exec playwright`.
- Production-only regressions need a `--prod` run, not just dev mode.
