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

- [ ] RED: `quickUpdateProduct`, sửa qua `saveProduct`, `cancelOrder` độc lập, `transitionOnlineOrder(…, "cancelled")`, `expireStaleOnlineOrders` đều gửi thông báo; thứ tự sự kiện `tx:begin, tx:end, revalidate:catalog, tx:begin, tx:end`; `cancelOrder` trả `restockedProductIds`; `softDeleteProduct` xóa đăng ký của sản phẩm.
- [ ] GREEN: gọi `deliverBackInStockAlerts` sau commit + revalidate ở 5 chỗ; `CancelOrderResult.restockedProductIds`; `softDeleteProduct` gói update + `deleteMany` đăng ký trong một transaction (chỉ `tx`).
- [ ] Verify (`cancel-order`, `write-path-invalidation`, `save-product`, `update-online-order`, `expire-stale-online-orders`, `product-stock-edit`) + commit `feat(back-in-stock): send alerts after every stock increase`.

## Task 4: API khách + rate limit

**Files:** Create `src/app/api/customer/back-in-stock/route.ts`, `src/server/back-in-stock/back-in-stock-rate-limit.ts`; Modify `src/server/security/rate-limit-policy.ts`; Test `tests/api/back-in-stock-route.test.ts`.

- [ ] RED: GET 401/400/200 (hai trạng thái); POST 403 origin lạ, 401, 415, 400 (thừa key, thiếu `subscribed`), 404, 409 có `code`, 200 bật rồi tắt, 429 + `Retry-After`; mọi response `private, no-store`.
- [ ] GREEN: policy `backInStock`, limiter, route theo thứ tự kiểm tra của spec §4.
- [ ] Verify + commit `feat(back-in-stock): add customer subscription API`.

## Task 5: Số khách chờ trong danh sách sản phẩm admin

**Files:** Modify `src/server/admin/list-products.ts`; Test `tests/app/admin-lists-pagination.test.ts`.

- [ ] RED: thêm `waitingCount` vào bộ key; sản phẩm A có 2 đăng ký, B có 0.
- [ ] GREEN: `_count.backInStockSubscriptions` → `waitingCount`.
- [ ] Verify + commit `feat(admin): show back-in-stock waiting count per product`.

## Task 6: Kiểm kê dữ liệu cá nhân

**Files:** Modify `src/server/privacy/retention.ts`; Test `tests/server/privacy/retention.test.ts`.

- [ ] GREEN: thêm `BackInStockSubscription.*` vào `DATA_INVENTORY` (xóa khi gửi thông báo, cascade khi xóa tài khoản/sản phẩm).
- [ ] Verify + commit `docs(privacy): inventory back-in-stock subscriptions`.

## Task 7: Kiểm chứng cuối (bước sau, trên nhánh tích hợp)

- [ ] `scripts/agent/verify.sh` (full, gồm tsc) sau khi gộp nhánh UI — không chạy ở worker này vì máy thiếu RAM.
- [ ] Không push/merge từ worker; ghi sha vào Execution status.

## Execution status

<điền khi xong>
