# Báo khi có hàng (phía server) Implementation Plan

> **For agentic workers:** Thực hiện từng task theo thứ tự; tick checkbox khi xong. Mỗi task: test RED → code GREEN → `scripts/agent/verify.sh --test <file>` + lint file đổi → `scripts/agent/ship.sh --no-push`.

**Goal:** Khách đăng nhập bật/tắt "Báo khi có hàng" cho sản phẩm hết hàng; khi có hàng lại mỗi đăng ký nhận đúng một `CustomerNotification` (href tới trang sản phẩm) rồi bị xóa; admin thấy số khách chờ mỗi sản phẩm.

**Architecture:** Bảng mới `BackInStockSubscription` (xóa dòng khi đã gửi). Module `src/server/back-in-stock/*` (đăng ký, gửi, rate limit), route `src/app/api/customer/back-in-stock`. Năm đường tăng tồn kho gọi `deliverBackInStockAlerts` SAU commit và SAU `revalidatePublic(...)`; không mở `$transaction` khi không ai chờ. Xóa đăng ký + tạo thông báo cùng một transaction (chỉ `tx`) nên mỗi đăng ký ra đúng một thông báo (`eventKey back-in-stock:<id>`). Sweep 15 phút là lưới an toàn.

**Tech Stack:** Next.js 16, React 19, Prisma SQLite, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-back-in-stock-alerts.md` (mục "Quyết định" là bắt buộc). Phần UI do worker khác làm, không nằm trong plan này.

## Global Constraints

- Tuân thủ `AGENTS.md`; copy tiếng Việt; một kết nối SQLite: trong transaction chỉ dùng `tx`, transaction ngắn.
- `deliverBackInStockAlerts` không bao giờ ném lỗi, log bằng `logger`; không mở transaction khi không có đăng ký (`write-path-invalidation.test.ts` ghim thứ tự sự kiện).
- `src/types/back-in-stock.ts` đúng từng byte như spec (worker UI có thể tạo file giống hệt).
- Không chạy `prisma migrate dev/deploy`, `db push`; migration viết tay, kiểm bằng `prisma migrate diff`.
- Máy thiếu RAM: chỉ chạy `verify.sh --test <file>` từng file và `verify.sh --fast --only lint`; full gate (tsc, toàn bộ vitest) chạy ở bước sau khi gộp nhánh UI.

## Task 1: Schema, migration, types, module đăng ký

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20261023100000_back_in_stock_subscriptions/migration.sql`, `src/types/back-in-stock.ts`, `src/server/back-in-stock/subscriptions.ts`; Test `tests/server/back-in-stock/subscriptions.test.ts`.

- [x] RED: test đăng ký sản phẩm hết hàng (lặp lại vô hại), còn hàng → `product_in_stock`, ẩn/xóa mềm/dịch vụ/không có → `product_not_found`, đăng ký thứ 51 → `too_many_subscriptions`, hủy idempotent, `isSubscribedBackInStock`.
- [x] GREEN: model + migration (`migrate diff` rỗng), types, `subscribeBackInStock` (một transaction ngắn), `unsubscribeBackInStock`, `isSubscribedBackInStock`.
- [x] Verify + commit `feat(back-in-stock): add subscriptions table and module`.

## Task 2: Gửi thông báo, sweep, instrumentation

**Files:** Create `src/server/back-in-stock/deliver-alerts.ts`; Modify `src/server/customer-notifications/create-customer-notification.ts`, `src/instrumentation.ts`; Test `tests/server/back-in-stock/deliver-alerts.test.ts`.

- [x] RED: mỗi khách đúng một thông báo (kind/title/eventKey/href slug và `/shop/products/<id>`), xóa dòng; gọi hai lần không trùng; còn hết hàng/ẩn thì không gửi; đăng ký lại → thông báo thứ hai khác eventKey; lỗi tạo thông báo không ném, giữ đăng ký, ghi log; không đăng ký thì không mở transaction; sweep gửi phần còn treo; `scheduleBackInStockSweep` (null khi `DISABLE_BACKGROUND_JOBS=1`, gọi hai lần cùng timer, `stop` xóa).
- [x] GREEN: `createBackInStockNotification`, `deliverBackInStockAlerts` (đọc không transaction, lô 50 mỗi transaction), `sweepBackInStockAlerts`, `schedule/stopBackInStockSweep`, đăng ký trong `instrumentation.ts`.
- [x] Verify + commit `feat(back-in-stock): deliver alerts and sweep pending subscriptions`.

## Task 3: Gắn vào các đường tăng tồn kho, dọn khi xóa mềm

**Files:** Modify `src/server/products/save-product.ts`, `src/server/orders/cancel-order.ts`, `src/server/orders/update-online-order.ts`, `src/server/orders/expire-stale-online-orders.ts`; Test `tests/server/back-in-stock/deliver-alerts.test.ts`, `tests/server/orders/cancel-order.test.ts`, `tests/server/products/save-product.test.ts`.

- [x] RED: `quickUpdateProduct`, sửa qua `saveProduct`, `cancelOrder` độc lập, `transitionOnlineOrder(…, "cancelled")`, `expireStaleOnlineOrders` đều gửi thông báo; thứ tự sự kiện `tx:begin, tx:end, revalidate:catalog, tx:begin, tx:end`; `cancelOrder` trả `restockedProductIds`; `softDeleteProduct` xóa đăng ký của sản phẩm.
- [x] GREEN: gọi `deliverBackInStockAlerts` sau commit + revalidate ở 5 chỗ; `CancelOrderResult.restockedProductIds`; `softDeleteProduct` gói update + `deleteMany` đăng ký trong một transaction (chỉ `tx`).
- [x] Verify (`cancel-order`, `write-path-invalidation`, `save-product`, `update-online-order`, `expire-stale-online-orders`, `product-stock-edit`) + commit `feat(back-in-stock): send alerts after every stock increase`.

## Task 4: API khách + rate limit

**Files:** Create `src/app/api/customer/back-in-stock/route.ts`, `src/server/back-in-stock/back-in-stock-rate-limit.ts`; Modify `src/server/security/rate-limit-policy.ts`; Test `tests/api/back-in-stock-route.test.ts`.

- [x] RED: GET 401/400/200 (hai trạng thái); POST 403 origin lạ, 401, 415, 400 (thừa key, thiếu `subscribed`), 404, 409 có `code`, 200 bật rồi tắt, 429 + `Retry-After`; mọi response `private, no-store`.
- [x] GREEN: policy `backInStock`, limiter, route theo thứ tự kiểm tra của spec §4.
- [x] Verify + commit `feat(back-in-stock): add customer subscription API`.

## Task 5: Số khách chờ trong danh sách sản phẩm admin

**Files:** Modify `src/server/admin/list-products.ts`; Test `tests/app/admin-lists-pagination.test.ts`.

- [x] RED: thêm `waitingCount` vào bộ key; sản phẩm A có 2 đăng ký, B có 0.
- [x] GREEN: `_count.backInStockSubscriptions` → `waitingCount`.
- [x] Verify + commit `feat(admin): show back-in-stock waiting count per product`.

## Task 6: Kiểm kê dữ liệu cá nhân

**Files:** Modify `src/server/privacy/retention.ts`; Test `tests/server/privacy/retention.test.ts`.

- [x] GREEN: thêm `BackInStockSubscription.*` vào `DATA_INVENTORY` (xóa khi gửi thông báo, cascade khi xóa tài khoản/sản phẩm).
- [x] Verify + commit `docs(privacy): inventory back-in-stock subscriptions`.

## Task 7: Kiểm chứng cuối (bước sau, trên nhánh tích hợp)

- [ ] `scripts/agent/verify.sh` (full, gồm tsc) sau khi gộp nhánh UI — không chạy ở worker này vì máy thiếu RAM.
- [ ] Không push/merge từ worker; ghi sha vào Execution status.

## Execution status (2026-10-23)

Task 1–6 đã làm và commit trên `ccg/worker-4fad71ab` (không push, không merge):

| Task | Commit                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| 1    | `81d1c1e` feat(back-in-stock): add subscriptions table and module             |
| 2    | `2617cb9` feat(back-in-stock): deliver alerts and sweep pending subscriptions |
| 3    | `1932220` feat(back-in-stock): send alerts after every stock increase         |
| —    | `915c60c` style(back-in-stock): apply prettier to alert hooks and tests       |
| 4    | `97d4a23` feat(back-in-stock): add customer subscription API                  |
| 5    | `e3ae164` feat(admin): show back-in-stock waiting count per product           |
| 6    | `d9aee25` docs(privacy): inventory back-in-stock subscriptions                |

**Đã chạy thật** (`verify.sh --test`, từng file): `back-in-stock/subscriptions` 7/7, `back-in-stock/deliver-alerts` 18/18, `api/back-in-stock-route` 19/19, `orders/cancel-order` 12/12, `cache/write-path-invalidation` 4/4, `products/save-product` 18/18, `products/product-stock-edit` 10/10, `orders/update-online-order` 4/4, `orders/expire-stale-online-orders` 6/6, `customer-notifications` 7/7, `app/admin-lists-pagination` 17/17, `privacy/retention` 3/3. ESLint (`verify.sh --fast --only lint`) và `prettier --check` sạch trên mọi file đổi. `prisma migrate diff` (migrations → schema) rỗng.

**Chưa chạy**: `tsc` toàn dự án, toàn bộ vitest, build, e2e — để Task 7 trên nhánh tích hợp.

### Lệch so với spec

- `softDeleteProduct` trước đây không có transaction; nay gói `update` + `backInStockSubscription.deleteMany` trong một `prisma.$transaction` mới (chỉ `tx`), rồi mới revalidate.
- `DATA_INVENTORY`: `retentionDays: 0` kèm chú thích "event-driven" — đăng ký không có hạn theo ngày, job retention không xóa theo tuổi (spec §10 nói chỉ là tài liệu).
- Sandbox không cho ghi vào `node_modules` dùng chung (EROFS) nên `prisma generate` chạy vào một `node_modules/@prisma/client` cục bộ trong worktree (gitignored). Nhánh tích hợp cần chạy lại `prisma generate`.

## Review fixes (2026-10-23)

Làm trên `ccg/worker-71f56648` (từ `7eaba1b`), test trước rồi mới sửa, mỗi mục một commit, không push/merge:

- [x] Trần 50 đăng ký chỉ đếm sản phẩm còn bán online (khách còn hủy được) — `282d3fa`.
- [x] Đủ hàng = tồn kho ≥ 1 (`MIN_BACK_IN_STOCK_READY_STOCK`, dùng chung cho đăng ký và gửi): tồn 0.5 vẫn đăng ký được, giữ đăng ký, không gửi — `b0bb99e`.
- [x] Sweep ưu tiên sản phẩm có đăng ký chờ lâu nhất (`groupBy` + `_min.createdAt`, LIMIT trong SQL) thay vì theo id — `5df2ae4`.
- [x] Test hai lượt gửi + sweep chạy song song: mỗi đăng ký đúng một thông báo — `a553967`.
- [x] Sắp lại import `@/` trong `update-online-order.ts` — `7e41169`.
- [x] `notification-list.tsx` dùng `BACK_IN_STOCK_NOTIFICATION_KIND` — `cf34962`.
- [x] Chữ hộp thư theo spec §6 ("Hộp thư thông báo", "Cập nhật đơn hàng và tin báo có hàng sẽ hiển thị tại đây.") — `c732cde`.
- [x] Test return path với token đơn khách 43 ký tự — `cbb7c61`.
- [x] `debt-filters.test.ts` dọn đơn trong `afterAll` (làm `debt-history-pagination` lệch 24/23 khi chạy cả bộ) — `44945c5`.

Đã chạy (`verify.sh --test`, từng file): `back-in-stock/subscriptions` 10/10, `back-in-stock/deliver-alerts` 21/21, `kit/notification-list-actions`, `customer-notifications/notification-button` 15/15, `lib/auth/customer-return-path`, `debts/debt-filters` rồi `admin/debt-history-pagination` (trước khi sửa: fail 24/23; sau khi sửa: pass). `verify.sh --only lint` và `--only types` pass.

Còn lại: storefront vẫn coi hết hàng là `stock <= 0` (`product-detail-view.tsx`, `product-card.tsx`, `stock-badge.tsx`, …) nên tồn 0.5 hiện "Thêm vào giỏ" thay vì nút báo có hàng; chưa đổi vì không phải sửa một dòng. Nit `retention.ts` (`retentionDays: 0`) chưa làm trong lượt này.
