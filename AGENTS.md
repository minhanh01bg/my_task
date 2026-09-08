# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands and test isolation

- Use pnpm 10.28.2/Node 22. Full gate: `pnpm check && pnpm build`; E2E is separate: `pnpm test:e2e`.
- One Vitest file: `pnpm exec vitest run tests/lib/money.test.ts`; one case: append `-t "dung dau cham"`.
- One Playwright file: `pnpm test:e2e -- e2e/home.spec.ts`; do not call `pnpm exec playwright` because both `playwright` and `@playwright/test` are installed and direct invocation resolves the wrong runner.
- Vitest global setup always pushes Prisma schema to `prisma/test.db`; files are deliberately serial because they mutate that shared SQLite DB.
- Playwright global setup deletes transactional/catalog fixtures and reseeds; it preserves `Setting`. Override its occupied port with `PLAYWRIGHT_PORT`.

## Project invariants

- `src/server/orders/create-order.ts` is the sole order-write path: it recalculates money server-side and uses `clientId` idempotency. POS stock may become negative; online stock must be atomically guarded.
- Write products through `saveProduct()` in `src/server/products/save-product.ts`; bypassing it leaves denormalized `searchText` stale. Category renames must rebuild affected product search text.
- Preserve offline queue failures in IndexedDB for manual recovery; never discard a paid order merely because syncing failed.
- Public/protected routing is centralized in `src/lib/auth/public-paths.ts` plus `src/middleware.ts`; customer APIs are intentionally exempt from admin-session middleware.
- Security-sensitive JSON endpoints should use `readJsonBody()` for streamed byte limits, then Zod `safeParse`; return discriminated `{ ok: true/false }` results from server actions.
- Use `logger` from `src/lib/logger.ts`, not direct console calls: it redacts secrets/PII and normalizes paths. Unexpected API errors expose a correlation ID, not raw error details.
- Production env validation fails closed for Redis rate limiting, HMAC secret, proxy mode, canonical origin, and password hash; build-only dummy values in `src/config/env.ts` must never become runtime defaults.

## Local style and workflow

- Imports are grouped as Node/external, blank line, `@/` aliases, then relative imports; use `import type` for type-only symbols. Prettier uses double quotes/trailing commas and sorts Tailwind classes.
- Domain filenames are kebab-case; exported React components/types are PascalCase, functions/variables camelCase, constants UPPER_SNAKE_CASE. Monetary VND fields are integer numbers; stock/quantity may be fractional.
- Keep user-facing copy in Vietnamese. Preserve narrow domain error classes/codes and rethrow unknown errors after handling known Prisma/domain cases.
- Commit each verified subtask separately with scoped Conventional Commits and push the current branch when the whole task passes. Plans under `docs/superpowers/plans/` are test-first and dependency-ordered.
