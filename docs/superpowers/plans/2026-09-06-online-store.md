# Online Store MVP Implementation Plan

> **For agentic workers:** Execute task-by-task in order. Every task ends in focused tests and an independent commit.

**Goal:** Ship a production-ready public storefront sharing catalog, inventory and order infrastructure with the existing POS, then add isolated customer identity/order access and persistent idempotent admin notifications.

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
- Keep customer auth/session completely separate from admin `pos_session`; never reinterpret the POS `Customer` record as a login principal.
- Persist notification events atomically with the business write and enforce idempotency with a database unique key.
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

---

## Task 11: Isolated customer identity and revocable sessions

**Depends on:** Tasks 1–10 are stable. This task must not modify admin auth semantics.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `src/server/customer-auth/password.ts`
- Create: `src/server/customer-auth/session.ts`
- Create: `src/types/customer-auth.ts`
- Create: `src/app/api/customer-auth/register/route.ts`
- Create: `src/app/api/customer-auth/login/route.ts`
- Create: `src/app/api/customer-auth/logout/route.ts`
- Modify: `src/lib/auth/public-paths.ts`
- Modify: `src/middleware.ts`
- Create focused tests under `tests/server/customer-auth/`, `tests/types/` and `tests/api/`

**Steps:**

- [ ] Add `CustomerAccount` and `CustomerSession` exactly as specified; create additive migration and prove existing POS `Customer`/Order rows remain valid.
- [ ] Write failing tests that admin cookie cannot authenticate customer routes, customer cookie cannot authenticate admin routes, expired/revoked/disabled sessions fail and valid sessions resolve account id.
- [ ] Implement versioned password hashing, normalized unique phone identity, opaque random customer token, SHA-256 token digest persistence, rotation on login and DB-backed revoke on logout.
- [ ] Define strict Zod request/response envelopes; rate-limit register/login, use generic credential errors and enforce Origin on cookie-authenticated mutations.
- [ ] Add route classification only where needed; authorization remains in `requireCustomerSession` at each server data boundary.
- [ ] Confirm cookies are distinct (`pos_session` versus `customer_session`) and customer code does not import admin signing/verification helpers.
- [ ] Run focused tests, `pnpm lint`, `pnpm typecheck` and migration smoke test.
- [ ] Commit: `feat(customer-auth): add isolated customer sessions`.

---

## Task 12: Order ownership, account history and guest capability links

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `src/server/orders/create-online-order.ts`
- Modify: `src/app/api/online/orders/route.ts`
- Create: `src/server/orders/order-access.ts`
- Create: `src/app/account/orders/page.tsx`
- Create: `src/app/account/orders/[id]/page.tsx`
- Create: `src/app/orders/guest/[token]/page.tsx`
- Create: `src/app/api/customer/orders/claim/route.ts` only when verified-phone claim is enabled
- Modify checkout/success UI only as required to carry the one-time guest capability
- Add focused domain, route, component and middleware tests

**Steps:**

- [ ] Add nullable indexed `Order.customerAccountId` and `GuestOrderAccess` with unique order/token digest, expiry and revoke fields; do not alter `Order.customerId`.
- [ ] Test ownership queries at the database predicate: account A cannot enumerate/read account B, unauthenticated requests fail, and order code alone grants no detailed access.
- [ ] If customer session exists at checkout, derive account id server-side and bind ownership; reject any client-supplied account identity.
- [ ] For guest checkout, generate a 256-bit token and persist only its hash in the same order transaction. Retry the same `clientId` without a second access row; explicitly test concurrent retries.
- [ ] Return token only in the successful guest capability URL, apply `private, no-store` and `Referrer-Policy: no-referrer`, and prevent logging/analytics from capturing it.
- [ ] Build Server Component history/detail pages using `requireCustomerSession` and ownership-scoped Prisma queries; add loading, empty, not-found and safe error states.
- [ ] Keep `/order-success/[code]` receipt minimal and move PII/detail behind account ownership or valid guest capability.
- [ ] Implement claim only after verified phone exists: atomically set ownership if null and revoke capability. Otherwise document claim as deferred and do not compare unverified phone strings.
- [ ] Run focused tests, `pnpm check`, and Playwright cross-account/guest-link authorization cases.
- [ ] Commit: `feat(customer-orders): secure order ownership and guest access`.

---

## Task 13: Atomic persistent admin notification events

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `src/server/orders/create-order.ts` and/or transaction boundary selected during implementation
- Modify: `src/server/orders/create-online-order.ts`
- Create: `src/server/notifications/create-admin-notification.ts`
- Create focused tests under `tests/server/notifications/` and `tests/server/orders/`

**Steps:**

- [ ] Add `AdminNotification` with unique `eventKey`, kind/content/entity/href snapshots, timestamps and indexes `(readAt, createdAt)` plus `(createdAt, id)`.
- [ ] First write concurrency/idempotency tests: one online order yields event key `online-order:{orderId}:created`; same `clientId`, transaction retry and competing requests yield at most one event.
- [ ] Put Order, stock movements, optional guest access and notification insert in one Prisma transaction. Do not dispatch an in-memory/fire-and-forget event after commit.
- [ ] Treat duplicate deterministic event key as the same logical event while preserving unexpected database failures. A notification failure must roll back new online-order creation.
- [ ] Ensure title/body snapshots omit full phone/address and persisted `href` is an internal allowlisted path.
- [ ] Test POS orders do not emit the online-order event and existing order idempotency response remains unchanged.
- [ ] Run focused tests plus order regression suite, `pnpm lint` and `pnpm typecheck`.
- [ ] Commit: `feat(notifications): persist online order events atomically`.

---

## Task 14: Admin notification inbox, polling and read actions

**Files:**

- Create: `src/types/admin-notification.ts`
- Create: `src/app/api/admin/notifications/route.ts`
- Create: `src/app/api/admin/notifications/read/route.ts`
- Create: `src/features/admin-notifications/notification-provider.tsx`
- Create: `src/features/admin-notifications/notification-button.tsx`
- Create: `src/features/admin-notifications/notification-panel.tsx`
- Modify: admin layout/navigation composition, including `src/features/admin-navigation/admin-nav.tsx`
- Add focused API/component tests and E2E coverage

**Steps:**

- [ ] Define strict Zod contracts for cursor pagination and read union `{ id } | { allBefore }`; cap page size and reject arbitrary href/input fields.
- [ ] Implement admin-protected `GET` with `(createdAt,id)` cursor, minimal selects, total unread count and `private, no-store`.
- [ ] Implement idempotent mark-one and cutoff-based mark-all with Origin validation; test a notification arriving after cutoff stays unread.
- [ ] Mount one client provider in admin shell. Poll every 15 seconds only while visible, refetch on focus/online, deduplicate in-flight requests and reconcile optimistic unread state.
- [ ] Add accessible bell, `99+` badge and keyboard-operable loading/empty/error panel; click navigates even if best-effort mark-read must retry.
- [ ] Keep read state in SQLite, not localStorage; verify restart and a second browser observe the same state.
- [ ] Add Playwright coverage for new-order badge, deep link, mark-one, mark-all cutoff and anonymous 401/redirect behavior.
- [ ] Run focused tests, `pnpm check`, `pnpm build` and relevant Playwright suites.
- [ ] Commit: `feat(admin): add persistent notification inbox`.

---

## Task 15: Extended security and migration quality gate

**Steps:**

- [ ] Exercise migrations against a copy containing legacy POS Customer/debt/orders; verify rollback strategy before deployment.
- [ ] Run customer auth abuse tests (credential enumeration, rate limit, session fixation/revoke), cross-account IDOR tests, expired/revoked guest token tests and notification concurrency tests.
- [ ] Search logs, URLs, responses and tracked files for plaintext passwords/session tokens/guest tokens/full PII; verify customer capability pages disable caching/referrers.
- [ ] Run `pnpm exec prettier --check .`, `pnpm check`, `pnpm build` and full Playwright; document only infrastructure blockers.
- [ ] Inspect `git diff --check`, migration SQL and query indexes; confirm no source path treats admin and customer sessions as interchangeable.
- [ ] Commit fixes by concern; do not squash them into unrelated feature commits.

## Definition of done

All acceptance criteria in the spec pass; public routes need no admin session while internal routes remain protected; online price/stock is server authoritative; POS behavior regresses neither contract nor inventory policy; customer and admin security domains are isolated; account ownership and guest capabilities cannot expose another order; every online-order notification is atomic, persistent and idempotent; admin can complete the online lifecycle; tests/check/build are green; commits are scoped; branch is pushed without secrets.
