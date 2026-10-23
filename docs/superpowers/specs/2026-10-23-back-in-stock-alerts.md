# Spec: "Báo khi có hàng" (back-in-stock alerts) — 2026-10-23

Yêu cầu chủ shop (2026-10-23): trên trang sản phẩm đang hết hàng, khách đã đăng nhập bấm
"Báo khi có hàng" (bấm lại thì hủy), khách chưa đăng nhập được mời đăng nhập; khi có hàng
trở lại mỗi khách đã đăng ký nhận đúng một thông báo trong mục thông báo tài khoản, bấm vào
mở trang sản phẩm, rồi đăng ký coi như xong; admin thấy mỗi sản phẩm có bao nhiêu khách chờ.

## Quyết định cho các câu hỏi mở (§10)

1. Giữ giới hạn 50 đăng ký đang chờ mỗi tài khoản và sweep định kỳ 15 phút (lưới an toàn khi gửi lỗi).
2. `softDeleteProduct` xóa luôn các `BackInStockSubscription` của sản phẩm đó trong transaction
   hiện có (chỉ dùng `tx`), để không còn đăng ký treo vĩnh viễn.
3. Tài khoản bị khóa (`disabledAt`) vẫn nhận thông báo như bình thường (vô hại, không cần nhánh riêng).
4. Thêm `BackInStockSubscription` vào `DATA_INVENTORY` trong `src/server/privacy/retention.ts`
   (tài liệu hóa; xóa theo cascade khi xóa tài khoản).

---

This is the design and contract for the server and UI workers. I only read code: I changed no files, ran no tests, and ran no Prisma commands.

## 1. Findings (verified by reading the code unless marked _inferred_)

**Product page stays static.**

- `src/app/shop/p/[slug]/page.tsx:16` sets `revalidate = 60`, and `:19-21` returns `[]` from `generateStaticParams`. Nothing in the page reads cookies.
- `ProductDetailView` is a client component. It computes `isOutOfStock = product.stock <= 0` at `product-detail-view.tsx:42`. The call-to-action row is at `:213-246`: a disabled "Tạm hết hàng" button at `:214-225` and `WishlistButton` at `:240-246`.
- The page learns login state only in the browser: `useStorefrontSession()` (`session-aware-actions.tsx:26-38`) calls `GET /api/storefront/session`. Until that loads it reports a guest. `ProductReviews` already works this way.

**Which products can be seen.** The product page loader only returns products with `isActive: true, isService: false, deletedAt: null` (`get-product-detail.ts:41-47`). Its select includes `slug`, and `slug` can be null.

**Customer APIs.**

- `src/proxy.ts:16-18` lets every `/api/customer/*` route through without the admin check, and `tests/api/route-auth-inventory.test.ts` also skips them. A new route there needs no `public-paths` change.
- The full route pattern to copy is `src/app/api/online/products/[id]/reviews/route.ts`: origin check, session, `readJsonBody`, Zod, rate limit, then `logger.error` in a catch. The 429 with `Retry-After` is at `:91-100`.
- Rate-limit policies live in `rate-limit-policy.ts:109-117` (the review one is the template). The limiter module template is `src/server/reviews/review-rate-limit.ts`.

**Login return path.** `src/lib/auth/customer-return-path.ts:1-12` only allows `/orders/guest/<token>` and `/account/orders[/<id>]`. It has to be extended so a guest can come back to the product page.

- Slug format is `^[a-z0-9]+(?:-[a-z0-9]+)*$` (`route-params.ts:11`), max 80 characters (`slugify.ts:6`). Product ids match `^[A-Za-z0-9_-]{1,64}$` (`route-params.ts:14`).
- `/shop/products/<id>` permanently redirects to `productHref(...)` (`shop/products/[id]/page.tsx:58`).

**Notification list has a naming trap.** `src/components/kit/notification-list.tsx:26` shows "Kiểm tra tồn kho" for any kind containing `"stock"`, and `:107` shows a warning icon for the same. A kind like `back_in_stock` would get the admin low-stock label and icon. The new kind needs its own branch, checked first.

**Creating a notification.** `createCustomerNotification(tx, …)` at `create-customer-notification.ts:74-91` is a plain `create`. A duplicate `eventKey` throws P2002 and rolls back the whole transaction.

**Two existing tests break when the shapes change:**

- `tests/app/admin-lists-pagination.test.ts:214-231` checks the exact key set of `listProducts` items, so `waitingCount` must be added to that list.
- `tests/server/orders/cancel-order.test.ts:284` does `toEqual({ cancelled: true, voucherCode: "GIAM10" })`.

**One test constrains how delivery runs.** `tests/server/cache/write-path-invalidation.test.ts:92,96` expects exactly `["tx:begin","tx:end","revalidate:catalog"]` for `cancelOrder`. Delivery therefore must **not open a `$transaction` when there are no subscriptions**.

**Background jobs.** The pattern to copy is `expire-stale-online-orders.ts:111-161`: a timer stored on `globalThis`, `unref`, a `running` guard, and an opt-out with `DISABLE_BACKGROUND_JOBS`. Jobs are registered in `src/instrumentation.ts` inside `if (isServing) { … }` (about lines 24-31).

**Admin product list.** `src/server/admin/list-products.ts:56-63` builds `AdminProductListItem` from `adminProductListSelect`, and `findMany` is at `:126-132`. The table is in `admin/products/page.tsx`: headers at `:183-189`, the "Tồn" cell at `:220-222`.

**No migration drift check.** Neither `scripts/agent/verify.sh` nor `.github/workflows` runs `migrate diff` or `migrate status`, so the SQL below is written by hand to match the repo's style (template: `20260908000000_customer_notifications`).

## 2. Data model and migration

Add a back-relation line `backInStockSubscriptions BackInStockSubscription[]` to **Product**, next to `reviews`, and to **CustomerAccount**, also next to `reviews`.

```prisma
/// Khach dang nhap cho san pham het hang. Gui thong bao xong thi XOA dong nay
/// (thong bao la ban ghi); dang ky lai sau khi het hang lan nua tao dong moi.
model BackInStockSubscription {
  id        String          @id @default(cuid())
  accountId String
  account   CustomerAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  productId String
  product   Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt DateTime        @default(now())

  @@unique([accountId, productId])
  @@index([productId, createdAt])
}
```

The row is deleted when the alert is sent rather than marked with `notifiedAt`:

- Re-subscribing after the product sells out again is a plain insert, with no reset logic.
- `waitingCount` is simply the row count.
- Each subscription id is used once, so `eventKey` stays unique.
- Less personal data is kept.

The `(accountId, productId)` unique index also covers the per-account count, because `accountId` is its leading column.

**Migration file:** `prisma/migrations/20261023100000_back_in_stock_subscriptions/migration.sql`

```sql
-- CreateTable
CREATE TABLE "BackInStockSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackInStockSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BackInStockSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockSubscription_accountId_productId_key" ON "BackInStockSubscription"("accountId", "productId");

-- CreateIndex
CREATE INDEX "BackInStockSubscription_productId_createdAt_idx" ON "BackInStockSubscription"("productId", "createdAt");
```

## 3. Server module

### Shared contract: `src/types/back-in-stock.ts`

The server worker owns this file. If the UI worker's branch doesn't have it yet, the UI worker creates it **byte-identical** to the text below and must not edit it.

```ts
import { z } from "zod";

/** Cung dang id voi route /shop/products/[id] (cuid; seed/test tu dat). */
export const backInStockProductIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/);

export const backInStockUpdateSchema = z
  .object({ productId: backInStockProductIdSchema, subscribed: z.boolean() })
  .strict();
export type BackInStockUpdate = z.infer<typeof backInStockUpdateSchema>;

export const backInStockStateSchema = z
  .object({ productId: z.string(), subscribed: z.boolean() })
  .strict();
export type BackInStockState = z.infer<typeof backInStockStateSchema>;

export const BACK_IN_STOCK_ENDPOINT = "/api/customer/back-in-stock";
export const BACK_IN_STOCK_NOTIFICATION_KIND = "back_in_stock";
```

### `src/server/back-in-stock/subscriptions.ts`

```ts
export const MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT = 50;
/** San pham ban online duoc (trang san pham khong 404). */
export const ONLINE_SELLABLE_PRODUCT_WHERE = {
  isActive: true,
  isService: false,
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

export type BackInStockFailureCode =
  | "product_not_found"
  | "product_in_stock"
  | "too_many_subscriptions";
export type BackInStockResult =
  | { ok: true }
  | { ok: false; code: BackInStockFailureCode };

export async function subscribeBackInStock(
  accountId: string,
  productId: string,
): Promise<BackInStockResult>;
export async function unsubscribeBackInStock(
  accountId: string,
  productId: string,
): Promise<{ ok: true }>;
export async function isSubscribedBackInStock(
  accountId: string,
  productId: string,
): Promise<boolean>;
```

`subscribe` runs in one short `prisma.$transaction(async (tx) => …)` and uses only `tx` inside it:

1. Find the product with `ONLINE_SELLABLE_PRODUCT_WHERE`. If none, return `product_not_found`.
2. If `stock > 0`, return `product_in_stock`.
3. If the account is already subscribed to this product (`findUnique` on `accountId_productId`), return `{ ok: true }`. This makes it idempotent.
4. If the account already has `MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT` or more subscriptions, return `too_many_subscriptions`.
5. Otherwise create the row and return `{ ok: true }`.

`unsubscribe` is a `deleteMany({ where: { accountId, productId } })` with no transaction. It always succeeds, even if the product is now in stock or deleted.

### `src/server/back-in-stock/deliver-alerts.ts`

```ts
export const BACK_IN_STOCK_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/** Never throws; call ONLY after the stock-changing transaction has committed. */
export async function deliverBackInStockAlerts(
  productIds: Iterable<string>,
): Promise<{ delivered: number }>;
export async function sweepBackInStockAlerts(): Promise<{ delivered: number }>;
export function scheduleBackInStockSweep(options?: {
  run?: () => Promise<unknown>;
  intervalMs?: number;
}): NodeJS.Timeout | null;
export function stopBackInStockSweep(): void;
```

How `deliverBackInStockAlerts` works:

1. Remove duplicate ids. If the list is empty, return `{ delivered: 0 }`.
2. Run **one read with no transaction**: `prisma.product.findMany({ where: { id: { in }, stock: { gt: 0 }, ...ONLINE_SELLABLE_PRODUCT_WHERE, backInStockSubscriptions: { some: {} } }, select: { id: true } })`. If it finds nothing, return. This is what keeps the write-path-invalidation test passing.
3. For each product, loop over batches of 50. Each batch is one `prisma.$transaction(async (tx) => …)`:
   - Re-read the product inside the transaction with the same "ready" filter. If it is no longer ready, stop.
   - `findMany` subscriptions for the product, ordered by `[{ createdAt: "asc" }, { id: "asc" }]`, `take: 50`.
   - For each subscription: `deleteMany({ where: { id } })`. If the count is 0, skip it. If it is 1, call `createBackInStockNotification(tx, …)`.
   - Stop looping when a batch has fewer than 50 subscriptions.
4. Each product has its own `try/catch` that logs `logger.error("back_in_stock_delivery_failed", { productId, ...errorLogFields(error) })`.
5. If anything was sent, log `logger.info("back_in_stock_alerts_delivered", { delivered, productIds })`.

Deleting the subscription and creating the notification in the same transaction is what guarantees exactly one notification per subscription.

**Sweep.** `sweepBackInStockAlerts` finds up to 100 "ready" products that still have subscriptions and passes them to `deliverBackInStockAlerts`. `scheduleBackInStockSweep` and `stopBackInStockSweep` copy `scheduleStaleOnlineOrderExpiry` and `stopStaleOnlineOrderExpiry` exactly:

- Timer key `Symbol.for("backInStock.sweepTimer")`.
- Returns `null` when `DISABLE_BACKGROUND_JOBS === "1"`.
- On error logs `back_in_stock_sweep_failed`.

Register it in `src/instrumentation.ts` inside the existing `if (isServing) { … }` block with a dynamic import, the same way as the stale-order sweep.

### Notification helper

Add `createBackInStockNotification(tx, { subscriptionId, accountId, product: { id, name, slug } })` to `src/server/customer-notifications/create-customer-notification.ts`. The details are in §6.

### Rate limiting

**`src/server/back-in-stock/back-in-stock-rate-limit.ts`** copies `review-rate-limit.ts`:

```ts
export function setBackInStockRateLimiter(next: RateLimiter | null): void;
/** Seconds to wait when blocked, `null` when allowed. Targets: account-burst (accountId), ip-burst (trusted IP if resolvable). */
export async function checkBackInStockRateLimit(
  request: Request,
  accountId: string,
): Promise<number | null>;
```

Add this policy to `POLICIES` in `rate-limit-policy.ts`:

```ts
  /** Bat/tat bao co hang: chan bam lien tuc / quet hang loat. Fail-open: da bat buoc dang nhap. */
  backInStock: {
    name: "back-in-stock",
    failClosed: false,
    timeoutMs: 1000,
    buckets: [
      { name: "account-burst", limit: 20, windowSeconds: 60 },
      { name: "ip-burst", limit: 30, windowSeconds: 60 },
    ],
  },
```

### Vietnamese error copy, by failure code

| code                     | HTTP | message                                                              |
| ------------------------ | ---- | -------------------------------------------------------------------- |
| `product_not_found`      | 404  | "Không tìm thấy sản phẩm"                                            |
| `product_in_stock`       | 409  | "Sản phẩm đã có hàng trở lại, bạn có thể đặt mua ngay"               |
| `too_many_subscriptions` | 409  | "Bạn đang chờ quá nhiều sản phẩm. Hãy bỏ bớt trước khi đăng ký thêm" |

Put this map in the route file with `satisfies Record<BackInStockFailureCode, { status: number; message: string }>`, the way the reviews route does.

## 4. API contract: `src/app/api/customer/back-in-stock/route.ts`

All responses carry `Cache-Control: private, no-store`. Error bodies are `{ message }`, plus `code` for business failures.

**`GET /api/customer/back-in-stock?productId=<id>`** (no origin check and no rate limit, the same as notifications GET):

| Case                                           | Status | Body                                                                                                    |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| No valid `customer_session`                    | 401    | `{ "message": "Vui lòng đăng nhập để nhận thông báo khi có hàng" }`                                     |
| `productId` fails `backInStockProductIdSchema` | 400    | `{ "message": "Dữ liệu không hợp lệ" }`                                                                 |
| OK                                             | 200    | `{ "productId": "<id>", "subscribed": true \| false }`                                                  |
| Unexpected error                               | 500    | `{ "message": "Không tải được trạng thái. Vui lòng thử lại." }`, logged as `back_in_stock_state_failed` |

**`POST /api/customer/back-in-stock`** sets the desired state, so repeating a request is harmless. Request body: `{ "productId": string, "subscribed": boolean }`, strict. Checks run in this order:

| Step                                                            | Failure               | Status                      | Body                                                                                                                        |
| --------------------------------------------------------------- | --------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1. `hasSafeMutationOrigin(request)`                             | bad origin            | 403                         | `{ "message": "Nguồn gốc yêu cầu không hợp lệ" }`                                                                           |
| 2. Session                                                      | not logged in         | 401                         | same message as GET                                                                                                         |
| 3. `readJsonBody(request, { maxBytes: 1_000 })`                 | body error            | `body.status` (400/413/415) | `{ "message": body.message }`                                                                                               |
| 4. `backInStockUpdateSchema.safeParse`                          | invalid               | 400                         | `{ "message": "Dữ liệu không hợp lệ" }`                                                                                     |
| 5. `checkBackInStockRateLimit`                                  | limited               | 429 + `Retry-After`         | `{ "message": "Bạn thao tác quá nhanh. Vui lòng thử lại sau." }`                                                            |
| 6. `subscribed ? subscribeBackInStock : unsubscribeBackInStock` | throws                | 500                         | `{ "message": "Không cập nhật được đăng ký. Vui lòng thử lại." }`, logged as `back_in_stock_update_failed` with `productId` |
| 6. (same call)                                                  | `{ ok: false, code }` | status from §3 table        | `{ "code", "message" }`                                                                                                     |
| Success                                                         | —                     | 200                         | `{ "productId", "subscribed" }`, the same shape as GET                                                                      |

## 5. Every place that raises `Product.stock`, and where delivery goes

I grepped all `product.update|updateMany|upsert|createMany` and `UPDATE "Product"` calls in `src/`, `scripts/` and `prisma/`. In every case, call `await deliverBackInStockAlerts(...)` **after** the transaction commits and after the existing `revalidatePublic`, never inside a transaction.

1. **`saveProduct` edit path.**
   - Where stock or active state changes: the transaction at `save-product.ts:126-138`, where `applyStockAdjustment` runs at `:136`, and `isActive` can turn on at `:93`.
   - Hook: after `:141`, add `if (id) await deliverBackInStockAlerts([saved.id]);`.
   - Run it on every edit. Delivery is one indexed read when nobody is waiting, and this also covers `isActive` switching back on.
2. **`quickUpdateProduct`.**
   - Where stock changes: the transaction at `save-product.ts:155-164`, with `applyStockAdjustment` at `:163`.
   - Hook: after `:166`, add `if (stockChange && stockChange.stock > 0) await deliverBackInStockAlerts([input.id]);`.
3. **`cancelOrder`.**
   - Where stock goes up: `cancel-order.ts:63-66`, as `stock: { increment }`.
   - Add `restockedProductIds: string[]` to `CancelOrderResult` (`:10-15`). It is `[]` at `:40`. Collect `item.productId` in the loop at `:60-83` and return it at `:96`.
   - On the path with no `txClient`: after `:104-109`, call `await deliverBackInStockAlerts(result.restockedProductIds)` before returning.
   - Update the doc comment at `:22-25`: callers that pass a `txClient` must also deliver after their commit.
   - This path also covers the admin `cancelOrderAction` at `admin/orders/actions.ts:48`.
4. **`transitionOnlineOrder` → `cancelOrder(orderId, tx)`** at `update-online-order.ts:51`.
   - Add `let restockedProductIds: string[] = []` next to `:21` and fill it from `cancelled.restockedProductIds` at `:52`.
   - Inside the `if (next === "cancelled")` block at `:69-75`, after the revalidate, add `await deliverBackInStockAlerts(restockedProductIds)`.
5. **`expireStaleOnlineOrders` → `cancelOrder(candidate.id, tx)`** at `expire-stale-online-orders.ts:63`.
   - Add `const restocked = new Set<string>()` near `:51-52`, and add `result.restockedProductIds` to it inside `if (result)` at `:84-87`.
   - Inside the block at `:97-107`, after the revalidate, add `await deliverBackInStockAlerts(restocked)`.

Checked and found **not** to raise stock:

- `create-order.ts:536-547` and `:551-557` only decrease it, and quantities must be positive.
- `softDeleteProduct` (`save-product.ts:173-179`).
- Category actions (`:74`, `:123`), `product-rating.ts:34` and `backfill-slugs.ts:88`.
- New products are created at `save-product.ts:113` and cannot have subscribers yet.

There is no way to restore a soft-deleted product and no import script.

## 6. Notification

| Field      | Value                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `kind`     | `"back_in_stock"`                                                                                                      |
| `title`    | `"Sản phẩm bạn chờ đã có hàng"`                                                                                        |
| `body`     | `` `${product.name} đã có hàng trở lại. Đặt mua ngay trước khi hết nhé.` `` (goes through `sanitizeNotificationBody`)  |
| `href`     | `productHref({ id: product.id, slug: product.slug })`, i.e. `/shop/p/<slug>`, or `/shop/products/<id>` which redirects |
| `eventKey` | `` `back-in-stock:${subscription.id}` ``                                                                               |
| `orderId`  | `null`                                                                                                                 |

**Changes to the notification list UI:**

- In `src/components/kit/notification-list.tsx`, make the first line of `notificationAction` (`:25`) `if (kind === "back_in_stock") return "Xem sản phẩm";`.
- At `:107`, use `item.kind === "back_in_stock" ? BellRinging : item.kind.includes("stock") ? TriangleAlert : Package`, adding `IconBellRinging as BellRinging` to the `@tabler/icons-react` import.
- In `notification-button.tsx`, change `:110` `aria-label` to "Hộp thư thông báo" and `:163` `emptyDescription` to "Cập nhật đơn hàng và tin báo có hàng sẽ hiển thị tại đây." I grepped `tests/` and `e2e/`, and neither string is used there.

## 7. Admin: number of customers waiting

**Server, in `src/server/admin/list-products.ts`:**

```ts
const adminProductListSelect = {
  ...adminProductSelect,
  category: { select: { name: true } },
  _count: { select: { backInStockSubscriptions: true } },
} satisfies Prisma.ProductSelect;

type AdminProductListRow = Prisma.ProductGetPayload<{
  select: typeof adminProductListSelect;
}>;

export type AdminProductListItem = Omit<AdminProductListRow, "_count"> & {
  /** Khach dang cho bao co hang (dang ky chua gui). */
  waitingCount: number;
};

function toAdminProductListItem({
  _count,
  ...product
}: AdminProductListRow): AdminProductListItem {
  return { ...product, waitingCount: _count.backInStockSubscriptions };
}
```

In the `find` callback at `:126-132`, add `.then((rows) => rows.map(toAdminProductListItem))`. Then add `"waitingCount"` to the key list in `tests/app/admin-lists-pagination.test.ts:217-230`.

**UI, in `src/app/(management)/admin/products/page.tsx`:**

- After `:186`, add `<TableHead className="text-right">Khách chờ</TableHead>`.
- After the cell at `:220-222`, add a `<TableCell className="text-right tabular-nums">`:
  - When `waitingCount > 0`: Phosphor `Bell` (from `@phosphor-icons/react/dist/ssr`) plus the number, with `title="Khách đang chờ báo khi có hàng"` and `<span className="sr-only"> khách chờ báo có hàng</span>`.
  - Otherwise: `<span className="text-muted-foreground">—</span>`.

## 8. Product page button (the page stays static)

**New file: `src/features/online-store/back-in-stock-button.tsx`** (`"use client"`), exporting `BackInStockButton({ product }: { product: { id: string; slug?: string | null } })`.

- **Session:** `const { isCustomer } = useStorefrontSession()`, from `./session-aware-actions`.
- **Guest:** a `<Link>` with the text "Đăng nhập để nhận thông báo khi có hàng" and the lucide `Bell` icon. `href = \`/account/login?next=${encodeURIComponent(productHref(product))}\``. Style it with `cn(buttonVariants({ variant: "outline" }), …)`, sized to match the CTA row.
- **Customer, loading state:** fetch `GET ${BACK_IN_STOCK_ENDPOINT}?productId=…` with `credentials: "same-origin"` and `cache: "no-store"`, and parse with `backInStockStateSchema`.
  - On 401, call `invalidateStorefrontSession()` then `void loadStorefrontSession()`, so the guest link appears.
  - While loading, the button is `disabled` and `aria-busy`.
- **Customer, the button itself:** a toggle `<Button aria-pressed={subscribed}>` with a fixed label "Báo khi có hàng". The icon is `BellRing` when on and `Bell` when off.
  - When subscribed, show `<p role="status">Đã bật: bạn sẽ nhận thông báo trong hộp thư khi sản phẩm có hàng.</p>`.
- **Customer, clicking:** `POST` `{ productId, subscribed: !subscribed }` with `Content-Type: application/json`.
  - 200: update state from the response.
  - 409 with `code === "product_in_stock"`: show the server message and call `router.refresh()`.
  - Any other error: show `message` from the body, or the fallback "Không cập nhật được đăng ký. Vui lòng thử lại."
  - Network failure: "Mất kết nối. Vui lòng thử lại."
  - Errors appear in `<p role="alert">`. You can copy the `readMessage` helper from `product-reviews.tsx:49-64`.
- **Placement:** in `product-detail-view.tsx`, inside the CTA row at `:213`, after the disabled add-to-cart button at `:214-225`, add `{isOutOfStock ? <BackInStockButton product={product} /> : null}`.
- **Login return path (UI owns this):** in `src/lib/auth/customer-return-path.ts`, add `|shop\/p\/[a-z0-9]+(?:-[a-z0-9]+)*|shop\/products\/[A-Za-z0-9_-]{1,64}` to the alternation, and add a length check (`value.length <= 100`). `auth-form.tsx` already sends the user to that path after login and calls `invalidateStorefrontSession()`.
- **Page stays static:** `shop/p/[slug]/page.tsx` and `shop/products/[id]/page.tsx` are not touched. Nothing reads cookies or headers on the server, and the subscription state is fetched only in the browser, only when `isCustomer && isOutOfStock`.

**File ownership, so the two workers don't overlap:**

- **Server:**
  - `prisma/schema.prisma` and the migration
  - `src/types/back-in-stock.ts`
  - `src/server/back-in-stock/*`
  - `rate-limit-policy.ts`
  - `create-customer-notification.ts`
  - the API route
  - `save-product.ts`, `cancel-order.ts`, `update-online-order.ts`, `expire-stale-online-orders.ts`
  - `instrumentation.ts`
  - `list-products.ts`
  - their tests
- **UI:**
  - `back-in-stock-button.tsx` and `product-detail-view.tsx`
  - `customer-return-path.ts`
  - `notification-list.tsx` and `notification-button.tsx`
  - admin `products/page.tsx`
  - their tests

`tsc` passes only once both branches are merged, because the UI uses `waitingCount` and the types file.

## 9. Tests

Follow the repo conventions: Vietnamese test names, a real `prisma/test.db`, `createCustomerSession`, and `Request` objects with a `cookie: customer_session=<token>` header. Each new file's `beforeEach` should clear `backInStockSubscription`, `customerNotification`, `customerSession` and `customerAccount`.

**Server:**

- `tests/server/back-in-stock/subscriptions.test.ts`:
  - subscribing to an out-of-stock product works, and repeating it is harmless
  - an in-stock product returns `product_in_stock`
  - inactive, soft-deleted, service or missing products return `product_not_found`
  - the 51st subscription returns `too_many_subscriptions`
  - unsubscribe is idempotent
  - `isSubscribedBackInStock`
- `tests/server/back-in-stock/deliver-alerts.test.ts`:
  - restocking with `quickUpdateProduct` gives each subscriber exactly one notification with the right kind, title, eventKey and href (both the slug form and `/shop/products/<id>`), and deletes the rows
  - calling delivery twice creates no duplicates
  - nothing is sent while the product is still out of stock or inactive
  - re-subscribing after a second sell-out gives a second notification with a different eventKey
  - delivery is triggered by the `saveProduct` edit, standalone `cancelOrder`, `transitionOnlineOrder(…, "cancelled")` and `expireStaleOnlineOrders`
  - a delivery failure (for example a mocked `createCustomerNotification` that rejects) does not throw, keeps the stock change, keeps the subscription, and logs the error
  - with `$transaction` spied, the event order is `tx:begin, tx:end, revalidate:catalog, tx:begin, tx:end`
  - the sweep sends pending alerts
  - `scheduleBackInStockSweep` returns `null` when `DISABLE_BACKGROUND_JOBS=1`, returns the same timer when called twice, and `stop` clears it
- Update `tests/server/orders/cancel-order.test.ts:284` to also expect `restockedProductIds`.
- Update `tests/app/admin-lists-pagination.test.ts:217-230` to include `"waitingCount"`, and add a case where product A has 2 subscriptions and product B has 0.
- `tests/api/back-in-stock-route.test.ts`:
  - GET returns 401, 400 and 200 for both states
  - POST returns 403 when `origin: https://evil.example`, 401, 415, 400 for an extra key or missing `subscribed`, 404, 409 with `code`, and 200 for subscribe then unsubscribe
  - 429 with `Retry-After` using `setBackInStockRateLimiter(deny)`; reset it in `afterEach` with `setBackInStockRateLimiter(null)`
  - every response has `private, no-store`

**UI:**

- `tests/components/online-store/back-in-stock-button.test.tsx` (copy `mockFetch` and `invalidateStorefrontSession()` from `product-reviews.test.tsx:39-60`, and mock `next/navigation` with `{ refresh, push }`):
  - a guest sees the link with `next=%2Fshop%2Fp%2F<slug>` and no state request is made
  - a customer clicks to subscribe and `aria-pressed` turns true
  - unsubscribing sends `subscribed:false`
  - a 409 `product_in_stock` shows the message and calls `refresh`
  - a 401 falls back to the guest link
  - a network error shows the alert and re-enables the button
- `tests/components/online-store/product-detail.test.tsx`: an out-of-stock product shows the control, an in-stock product does not. Re-run its existing out-of-stock case at `:165`.
- `tests/components/kit/notification-list-actions.test.tsx`: kind `back_in_stock` shows "Xem sản phẩm" and not "Kiểm tra tồn kho".
- `tests/lib/auth/customer-return-path.test.ts`:
  - accepts `/shop/p/sua-chua-uong` and `/shop/products/prod_01`
  - rejects `/shop/p/Sua`, `/shop/p/a--b`, `/shop/p/x?y=1`, `//shop/p/x`, `/shop/p/x/../admin` and a slug longer than 80 characters

## 10. Risks and open questions

**Race between subscribing and restocking** (_inferred_ from the single pooled connection rule in AGENTS.md). Transactions run one at a time.

- If the restock commits first, the subscribe sees `stock > 0` and returns 409.
- If the subscribe commits first, the delivery that runs after the restock picks it up.

If a second process were ever pointed at the same SQLite file, its write could fail with BUSY, but deleting the row before creating the notification still prevents duplicates. Any alert that slips through is picked up by the next sweep.

**First click on the alert may show the old page** (_inferred_ from how `revalidateTag(…,"max")` serves stale content). A customer who opens the alert right away might see the out-of-stock page once. If they then click subscribe, they get a 409 and `router.refresh()` loads the fresh page.

**Delivery adds time to the admin save.** It runs in batches of 50 per transaction. With thousands of waiting customers it holds up the single connection for a while.

**Customers briefly see the guest link.** Until the session loads, logged-in customers see the login link for a moment. Product reviews already behave the same way.

**Open questions:**

1. Is a cap of 50 waiting products per account, and a 15-minute sweep, acceptable? The sweep could be dropped, but then an alert whose delivery failed is never retried.
2. Subscriptions on soft-deleted products stay in the table. They are harmless and hidden from admin, but should `softDeleteProduct` remove them?
3. Disabled accounts still receive the notification. Fine?
4. Should `BackInStockSubscription` get an entry in the `DATA_INVENTORY` list in `retention.ts` (documentation only)? Nothing requires it.
