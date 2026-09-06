# Online Store MVP Implementation Plan

> **For agentic workers:** Execute task-by-task in order. Every task ends in focused tests and an independent commit.

**Goal:** Ship a production-ready public guest storefront sharing catalog, inventory and order infrastructure with the existing POS.

**Architecture:** Server Components own catalog and page composition. Interactive cart/search/form code is isolated in `src/features/online-store/` client leaves. A strict public Zod contract accepts only product ids, quantities and fulfillment/contact fields; `src/server/orders/create-online-order.ts` resolves authoritative product data before delegating persistence to the shared order core. Nullable online metadata preserves every POS record and behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Prisma 6 SQLite, Zod 4, Zustand 5, Vitest 4, Playwright 1.59.

**Spec:** `docs/superpowers/specs/2026-09-06-online-store-design.md`

## Global constraints

- Prefer Server Components; use `"use client"` only for search, persisted cart, form submission and error boundaries.
- Route/code names English; user copy Vietnamese.
- Money is integer VND; online quantity is finite and positive.
- Public client never supplies price, product name, discount, channel, status or payment amount.
- Validate every boundary with exported Zod schemas; use minimal Prisma selects.
- Preserve `/api/orders` and POS negative-stock policy unchanged.
- Tests live under `tests/**` and `e2e/**`; no secrets or real bank/customer data.

---

## Task 1: Online order data model and lifecycle primitives

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/server/orders/online-order-status.ts`
- Create: `tests/server/orders/online-order-status.test.ts`

**Steps:**

- [ ] Write transition-matrix tests for `new`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`; terminal states reject all transitions.
- [ ] Add nullable online fields to `Order`: fulfillment/payment/contact/address plus `shippingFee Int @default(0)`; index `channel` and `fulfillmentStatus`.
- [ ] Implement typed constants, Vietnamese labels, `canTransitionOnlineOrder(from,to)` and assertion helper.
- [ ] Run `pnpm db:generate` and `pnpm vitest run tests/server/orders/online-order-status.test.ts`.
- [ ] Verify an existing POS row can still be represented with all online fields null.
- [ ] Commit: `feat(orders): add online fulfillment lifecycle`.

---

## Task 2: Shared strict Zod API contract

**Files:**

- Create: `src/types/online-order.ts`
- Create: `tests/types/online-order.test.ts`

**Contract:**

- `onlineCartLineSchema`: strict `{ productId: cuid/string, quantity: finite positive <= 999 }`.
- `onlineCheckoutSchema`: strict; UUID clientId, 1–50 unique lines, trimmed contact fields, normalized Vietnamese phone, fulfillment enum, conditional delivery address, payment enum and bounded note.
- Export inferred request/response/error types and error codes.

**Steps:**

- [ ] Test valid delivery/COD and pickup/transfer payloads.
- [ ] Test missing delivery address, duplicate product id, unknown keys, client price/total/name fields, invalid phone, overlong note and non-finite quantity.
- [ ] Implement normalization/refinement and response schemas.
- [ ] Run `pnpm vitest run tests/types/online-order.test.ts` and `pnpm typecheck`.
- [ ] Commit: `feat(api): define online checkout contract`.

---

## Task 3: Authoritative online order creation

**Files:**

- Modify: `src/server/orders/create-order.ts`
- Create: `src/server/orders/create-online-order.ts`
- Create: `tests/server/orders/create-online-order.test.ts`

**Steps:**

- [ ] Add tests with mocked Prisma/shared create core: ignores all display cache, rejects inactive/deleted/service/missing products, aggregates duplicate defense, rejects insufficient stock, maps DB name/price/unit, maps COD/transfer and writes online metadata.
- [ ] Preserve idempotency: existing `clientId` returns the same order before stock validation.
- [ ] Extend shared input with optional trusted online metadata and explicit initial status/payment received behavior without altering POS defaults.
- [ ] Resolve products using one minimal query; calculate total from DB price; online payment amount equals server total; set `channel=online`, financial `pending`, fulfillment `new`.
- [ ] Keep validation and writes in a transaction boundary sufficient to avoid partial orders; map expected domain errors to stable codes.
- [ ] Run `pnpm vitest run tests/server/orders/create-online-order.test.ts tests/lib/pricing/calculate.test.ts`.
- [ ] Commit: `feat(orders): create authoritative online orders`.

---

## Task 4: Public checkout route and access policy

**Files:**

- Create: `src/app/api/online/orders/route.ts`
- Modify: `src/middleware.ts`
- Create: `src/lib/auth/public-paths.ts`
- Create: `tests/api/online-orders-route.test.ts`
- Create: `tests/lib/auth/public-paths.test.ts`

**Steps:**

- [ ] Extract pure request-path classifier and test `/shop`, `/checkout`, `/order-success/*`, exact `/api/online/orders` public while `/api/orders`, `/admin`, `/pos` stay private.
- [ ] Handler rejects invalid JSON/body with 400, domain conflicts with 409, returns minimal 201/200 envelope, catches/logs unexpected errors without PII.
- [ ] Add safe no-store/security response headers where relevant; enforce JSON content and body limits supported by the route.
- [ ] Update middleware matcher/allowlist; never make `/api/online/*` broadly public.
- [ ] Run focused route/path tests and `pnpm typecheck`.
- [ ] Commit: `feat(api): expose secure guest checkout`.

---

## Task 5: Public catalog server module and storefront shell

**Files:**

- Create: `src/server/catalog/get-online-catalog.ts`
- Create: `src/features/online-store/types.ts`
- Create: `src/features/online-store/store-header.tsx`
- Create: `src/features/online-store/product-card.tsx`
- Create: `src/features/online-store/catalog-browser.tsx`
- Create: `src/app/shop/page.tsx`
- Create: `src/app/shop/loading.tsx`
- Create: `src/app/shop/error.tsx`
- Modify: `src/app/page.tsx`
- Create: `tests/server/catalog/get-online-catalog.test.ts`
- Create: `tests/components/online-store/catalog-browser.test.tsx`

**Steps:**

- [ ] Test server select excludes cost/internal/deleted/inactive/service products and sorts categories/products predictably.
- [ ] Render semantic public shell on server; catalog browser is a leaf client using existing normalized multi-token search.
- [ ] Product cards show image fallback, name, unit, VND, stock state and disabled add button when unavailable.
- [ ] Implement responsive grid, category/query empty states, accessible labels/focus and public home CTA.
- [ ] Add route loading skeleton and retryable error boundary.
- [ ] Run focused tests, `pnpm lint`, then inspect `/shop` at mobile and desktop.
- [ ] Commit: `feat(storefront): add public searchable catalog`.

---

## Task 6: Persisted online cart

**Files:**

- Create: `src/features/online-store/cart-store.ts`
- Create: `src/features/online-store/cart-provider.tsx`
- Create: `src/features/online-store/cart-button.tsx`
- Create: `src/features/online-store/cart-panel.tsx`
- Modify: `src/features/online-store/product-card.tsx`
- Modify: `src/features/online-store/store-header.tsx`
- Create: `tests/features/online-store/cart-store.test.ts`
- Create: `tests/components/online-store/cart-panel.test.tsx`

**Steps:**

- [ ] Test add/coalesce, bounded quantity, remove, clear, integer VND displayed subtotal and versioned localStorage hydration.
- [ ] Avoid hydration mismatch: server emits empty affordance; provider marks hydrated before persisted count/detail.
- [ ] Add cart drawer/panel with quantity controls, remove action, subtotal disclaimer and checkout link.
- [ ] Announce cart changes via `aria-live`; all controls have names and 44px targets.
- [ ] Run focused store/component tests and `pnpm typecheck`.
- [ ] Commit: `feat(cart): add persisted guest shopping cart`.

---

## Task 7: Guest checkout and success experience

**Files:**

- Create: `src/app/checkout/page.tsx`
- Create: `src/app/checkout/loading.tsx`
- Create: `src/app/checkout/error.tsx`
- Create: `src/features/online-store/checkout-form.tsx`
- Create: `src/features/online-store/order-summary.tsx`
- Create: `src/app/order-success/[code]/page.tsx`
- Create: `tests/components/online-store/checkout-form.test.tsx`

**Steps:**

- [ ] Test empty cart guard, delivery conditional required fields, pickup clearing hidden address, payment selection, double-submit lock, 400/409/500 messages, cart retained on failure and cleared only on success.
- [ ] Generate and persist one UUID clientId per pending checkout so retries are idempotent.
- [ ] Submit only contract fields; parse response with Zod; navigate to encoded success code after success.
- [ ] Render server checkout shell with client form leaf and sticky summary; focus first invalid field and expose status in `aria-live`.
- [ ] Success page queries only code/total/method/status/store bank data, contains no URL PII, shows manual instructions and return-to-shop action.
- [ ] Add loading/error/empty states and responsive verification.
- [ ] Run focused tests, `pnpm lint`, `pnpm typecheck`.
- [ ] Commit: `feat(checkout): add guest fulfillment checkout`.

---

## Task 8: Admin online order workflow

**Files:**

- Create: `src/server/orders/update-online-order.ts`
- Create: `tests/server/orders/update-online-order.test.ts`
- Modify: `src/app/admin/orders/actions.ts`
- Modify: `src/app/admin/orders/page.tsx`
- Modify: `src/app/admin/orders/[id]/page.tsx`

**Steps:**

- [ ] Unit-test channel guard, transition matrix, atomic transition conflict, mark-paid behavior and cancel delegation/idempotency.
- [ ] Add Zod-validated server actions for transition and mark paid; revalidate list/detail/store catalog.
- [ ] Add channel filter preserving pagination/date/query; channel and fulfillment badges in list.
- [ ] Detail renders contact, phone, fulfillment type/full address, payment, note and only legal next actions.
- [ ] Ensure POS detail remains unchanged/meaningful when metadata is null.
- [ ] Run focused tests, `pnpm lint`, `pnpm typecheck`.
- [ ] Commit: `feat(admin): manage online order fulfillment`.

---

## Task 9: End-to-end coverage and regression hardening

**Files:**

- Create: `e2e/online-store.spec.ts`
- Modify: `e2e/global-setup.ts` or `prisma/seed.ts` only if deterministic fixtures are required
- Modify focused unit tests discovered during integration

**Steps:**

- [ ] E2E asserts anonymous `/shop` access, search, add, persisted cart reload, delivery COD checkout and success.
- [ ] E2E covers pickup transfer and conditional address.
- [ ] Login as admin, filter online, inspect contact/fulfillment and advance one legal transition.
- [ ] Assert anonymous `/admin` and `/api/orders` remain protected.
- [ ] Run `pnpm test:e2e -- e2e/online-store.spec.ts` and relevant POS smoke (`e2e/pos-cash-sale.spec.ts`).
- [ ] Run full `pnpm test:e2e` when environment permits.
- [ ] Commit: `test(storefront): cover guest order workflow`.

---

## Task 10: Production quality gate and delivery

**Files:** only fixes required by verification; each unrelated fix gets its own commit.

**Steps:**

- [ ] Run `pnpm exec prettier --check .` and format only affected files.
- [ ] Run `pnpm check` (lint + typecheck + all Vitest) until green.
- [ ] Run `pnpm build` until green.
- [ ] Run `pnpm test:e2e` or document infrastructure-only blockers; no functional failures accepted.
- [ ] Inspect `git diff --check`, `git status --short`, `git log --oneline` and confirm every independent feature has a commit.
- [ ] Search tracked changes for tokens, passwords, real phone/address/bank data; verify `.env.example` contains placeholders only and no SQLite database is tracked.
- [ ] Confirm current branch exactly `feat/pos-core`; do not force push.
- [ ] Push with `git push origin feat/pos-core`.
- [ ] Record final check/build/E2E results and commit hashes in completion report.

## Definition of done

All acceptance criteria in the spec pass; public routes need no session while internal routes remain protected; online price/stock is server authoritative; POS behavior regresses neither contract nor inventory policy; admin can complete the online lifecycle; tests/check/build are green; commits are scoped; branch is pushed without secrets.
