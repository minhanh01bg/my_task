# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands and test isolation

- Before building, check whether a live `next start` serves this checkout. Never overwrite its build directory. Use a fresh `NEXT_DIST_DIR=.next-release-<unique-id>` for verification; restart the service with the verified directory only after smoke checks pass. Fixture production E2E must use a separate build copy as well as a separate DB: Next persists Data/Full Route Cache under distDir. See README. Production-only regressions need production smoke/E2E, not only `next dev`.

- Use pnpm 10.28.2/Node 22. Full gate: `pnpm check && pnpm build`; E2E is separate: `pnpm test:e2e`.
- One Vitest file: `pnpm exec vitest run tests/lib/money.test.ts`; one case: append `-t "dung dau cham"`.
- One Playwright file: `pnpm test:e2e -- e2e/home.spec.ts`; do not call `pnpm exec playwright` because both `playwright` and `@playwright/test` are installed and direct invocation resolves the wrong runner.
- Vitest global setup always pushes Prisma schema to `prisma/test.db`; files are deliberately serial because they mutate that shared SQLite DB.
- Playwright global setup deletes transactional/catalog fixtures and reseeds; it preserves `Setting`. Override its occupied port with `PLAYWRIGHT_PORT`.

## Project invariants

- SQLite runs through ONE pooled connection (`connection_limit=1`, WAL, `busy_timeout` set in `src/server/db/prisma.ts`). Inside `prisma.$transaction(async (tx) => ...)` use only `tx`; touching the root `prisma` client there deadlocks until `maxWait`. Keep interactive transactions short: they block every other query in the process.
- `src/server/orders/create-order.ts` is the sole order-write path: it recalculates money server-side and uses `clientId` idempotency. POS stock may become negative; online stock must be atomically guarded.
- Write products through `saveProduct()` in `src/server/products/save-product.ts`; bypassing it leaves denormalized `searchText` stale. Category renames must rebuild affected product search text.
- Preserve offline queue failures in IndexedDB for manual recovery; never discard a paid order merely because syncing failed.
- Public/protected routing is centralized in `src/lib/auth/public-paths.ts` plus `src/proxy.ts` (Next.js proxy convention); customer APIs are intentionally exempt from admin-session middleware.
- Security-sensitive JSON endpoints should use `readJsonBody()` for streamed byte limits, then Zod `safeParse`; return discriminated `{ ok: true/false }` results from server actions.
- Use `logger` from `src/lib/logger.ts`, not direct console calls: it redacts secrets/PII and normalizes paths. Unexpected API errors expose a correlation ID, not raw error details.
- Public storefront data is tag-cached (`src/server/cache/public-cache.ts`, tags in `tags.ts`: `catalog`, `settings`, `promotions`, `vouchers`, `product:<id>`). Every write path must call `revalidatePublic(...)` AFTER its transaction commits; `/shop`, product, category and policy pages are static/ISR and must never read cookies or headers.
- Product and category slugs are generated once (in `saveProduct()` / the category action) and never change on rename; old `/shop/products/[id]` URLs 308 to `/shop/p/[slug]`.
- Vouchers are validated only on the server (`src/lib/vouchers/validate-voucher.ts` engine + `src/server/vouchers`); `usedCount` is incremented atomically inside the order transaction and restored on cancel. `Order.discount` includes `voucherDiscount`; `total = subtotal - discount + shippingFee`.
- Voucher codes referenced by order history cannot be renamed, deleted, or reused; deactivate them instead. Cancellation restores usage by the historical code, including after other voucher settings change.
- Order codes come from the atomic `order.sequence` counter in `Setting` (`src/server/orders/order-sequence.ts`), never from `count()`.
- Production env validation fails closed for Redis rate limiting, HMAC secret, proxy mode, canonical origin, and password hash; build-only dummy values in `src/config/env.ts` must never become runtime defaults.

## Local style and workflow

- Imports are grouped as Node/external, blank line, `@/` aliases, then relative imports; use `import type` for type-only symbols. Prettier uses double quotes/trailing commas and sorts Tailwind classes.
- Domain filenames are kebab-case; exported React components/types are PascalCase, functions/variables camelCase, constants UPPER_SNAKE_CASE. Monetary VND fields are integer numbers; stock/quantity may be fractional.
- Keep user-facing copy in Vietnamese. Preserve narrow domain error classes/codes and rethrow unknown errors after handling known Prisma/domain cases.
- Commit each verified subtask separately with scoped Conventional Commits and push the current branch when the whole task passes. Plans under `docs/superpowers/plans/` are test-first and dependency-ordered.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
