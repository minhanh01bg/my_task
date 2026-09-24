# Thiết kế: Sẵn sàng sản xuất — sửa lỗi, SEO, chịu tải 10k, hoàn thiện WIP, UI chuẩn SaaS

Ngày: 2026-09-24. Nhánh: `feat/pos-core`. Người ra yêu cầu đã ủy quyền toàn bộ quyết định.

## 1. Bối cảnh và hiện trạng (đã kiểm chứng)

- `pnpm lint`: 0 lỗi, 4 cảnh báo biến không dùng.
- `pnpm typecheck`: 39 lỗi, tất cả do Prisma client và `node_modules` chưa đồng bộ sau khi pull. Sau `prisma generate` + `pnpm install --frozen-lockfile` (không thêm gói mới): sạch.
- Vitest lần 1: 74 fail / 460 pass, cùng nguyên nhân trên. Đang chạy lại để xác nhận.
- Bốn khảo sát (tính năng dở, DB/query, SEO, UI) cho ra danh sách cụ thể ở §3.

## 2. Ràng buộc bắt buộc

1. **Không cài đặt bất cứ thứ gì mới** (gói npm, dịch vụ, binary). Chỉ dùng thứ đã có trong `package.json` và lockfile. Redis chỉ dùng qua `@upstash/redis` đã có, không dựng server.
2. Giữ các bất biến trong `AGENTS.md`: một đường ghi đơn hàng, `saveProduct()`, logger, env fail-closed, copy tiếng Việt.
3. Mỗi bước nhỏ, kiểm chứng bằng `pnpm check` (+ test liên quan), commit riêng theo Conventional Commits.
4. Không đổi hành vi nghiệp vụ tiền tệ. Không xoá dữ liệu.

## 3. Phạm vi theo 6 luồng việc (workstream)

### WS-A: Nền tảng chất lượng (Foundation)

- Đồng bộ toolchain (đã làm), sửa 4 cảnh báo lint, cho phép `TEST_DATABASE_URL` override để test song song.
- Import server-side Sentry trong `instrumentation.ts` (hiện không chạy).

### WS-B: Chịu tải 10k người dùng (DB, cache, rate limit)

- SQLite: bật WAL, `busy_timeout`, `synchronous=NORMAL` một lần khi khởi tạo client; `transactionOptions { maxWait, timeout }`.
- Mã đơn hàng: thay `count()+1` bằng bộ đếm nguyên tử (bảng `Setting` khoá `order.sequence`, tăng bằng `UPDATE ... RETURNING` trong transaction) + retry P2002 theo `code`.
- Transaction tạo đơn: ghi trước, `stockMovement.createMany`, tối thiểu hoá công việc giữ khoá.
- Index bổ sung (migration mới): Product `[isActive, deletedAt, isService, soldCount]`, `[isActive, deletedAt, name]`, `[categoryId, isActive, soldCount]`; Order `[status, createdAt]`, `[channel, createdAt]`, `[customerAccountId, channel, createdAt]`; Payment `[orderId, method]`; các cột `expiresAt`/`createdAt` cho job retention.
- `getPublicStoreProfile`: 1 query `findMany in`, bọc React `cache()`; `getOnlineProductDetail`, `getOnlineCatalog`, `getActivePromotions` bọc `cache()` + `unstable_cache` với tag `catalog`, `settings`, `promotions`, `product:<id>`; `revalidateTag` từ mọi đường ghi (saveProduct, category, settings, promotions, create/cancel order cho soldCount).
- `/shop` và `/shop/products/[id]` bỏ `force-dynamic`: tách phần phụ thuộc cookie (nút Quản trị/Tài khoản/Thông báo) thành client island gọi 1 endpoint nhẹ `/api/session/summary` (hoặc đọc cookie trong Suspense boundary). Trang chính sách thành static.
- Payload: cắt lát trên server (flash sale 4, rail 8), bỏ `searchText` khỏi props client; catalog phân trang server (`take`) + tìm kiếm server dùng `searchText`.
- Rate limit: store Redis cấp module; `Promise.all` cho các bucket; `clearTimeout`; nâng ngưỡng global (checkout 500→5000/phút, auth 1000→10000/15 phút) và giữ per-IP/phone.
- Admin list: `Promise.all(count, findMany)`, `select` tối thiểu, phân trang cho products/customers/debts.
- Report: group theo ngày múi giờ +7.
- Thông báo khách: chỉ fetch khi `isCustomer`, thêm `select`.
- Bỏ `sharp.cache(false)` ngoài dev; ảnh upload qua `saveProductImage` (resize).

### WS-C: SEO lên top

- `/` → `/shop` (redirect 308 trong `next.config` hoặc render storefront); cập nhật sitemap, e2e `home.spec`.
- Tiêu đề: template gốc từ tên cửa hàng, trang con dùng `title.absolute`; mô tả site tiếng Việt; `NEXT_PUBLIC_APP_URL` suy từ `CANONICAL_ORIGIN` khi thiếu.
- Sitemap động: sản phẩm active với `updatedAt`; bỏ `lastModified: now` cho trang tĩnh.
- JSON-LD: `Organization` + `WebSite/SearchAction` ở `/shop`; `LocalBusiness` với `PostalAddress`; `Product` với image tuyệt đối, brand, availability; `BreadcrumbList` ở trang sản phẩm và chính sách. Không phát `aggregateRating` từ dữ liệu giả.
- OG image mặc định (`opengraph-image.tsx`), `twitter.card`, canonical cho 4 trang chính sách, `viewport`/`theme-color`.
- `noindex` cho checkout/account/login; robots disallow `/login`, `/pos`, `/dev/`.
- 404 tiếng Việt trỏ về `/shop`; `priority` → `preload`; slug thân thiện cho sản phẩm (`/shop/products/[id]` giữ tương thích, thêm `slug` trên Product, URL `/shop/p/[slug]-[shortId]` canonical) và trang danh mục `/shop/c/[slug]`.
- Service worker và manifest chỉ cho POS/admin; storefront có manifest riêng `start_url: /shop`.
- Bỏ `QueryProvider` khỏi storefront; analytics chỉ khi `VERCEL`.
- `images.formats avif/webp`, `Cache-Control immutable` cho `/uploads/*`.

### WS-D: Hoàn thiện tính năng dở (từ plan 2026-09-11)

- Voucher: model `Voucher` (code, loại percent/fixed/freeship, giá trị, minOrder, maxUses, usedCount, startsAt, endsAt, isActive), validate server-side, áp dụng đúng loại (freeship giảm phí ship), trang admin `/admin/promotions/vouchers` CRUD + audit; bỏ danh sách mã khỏi bundle client. Đơn hàng lưu `voucherCode`, `deliverySlot` thành cột riêng.
- Đánh giá: model `ProductReview` (productId, accountId?, rating, content, verified nếu có đơn đã giao), API tạo/đọc có rate limit, hiển thị thật; rating tổng hợp tính thật; xoá dữ liệu giả.
- Hoá đơn K80: nút in trên `/admin/orders/[id]` và sau thanh toán POS; thêm VietQR khi có tài khoản.
- Báo cáo: toggle 7/14/30 ngày, tách POS/online, top 5.
- Badge tồn kho thấp trên menu admin; quick view trong `ProductTile`/catalog; xác nhận xoá dòng giỏ; dùng skeleton đã có; `soldCount` giảm khi huỷ đơn; wishlist drawer.

### WS-E: Giao diện chuẩn SaaS

- Token: dark palette cùng thương hiệu (ấm, primary xanh lá); `--touch-target` vào `@theme`; định nghĩa `--destructive-foreground`; sửa trùng `.animate-in`.
- Route states: `loading.tsx`/`error.tsx` cho `admin`, `pos`, `login`, `order-success`; root `loading/not-found/global-error` tiếng Việt dùng token.
- Primitives còn thiếu bằng `@base-ui/react` đã có: Sheet/Drawer, Tooltip, Popover, DropdownMenu, Switch/Checkbox, Alert, Toast nhẹ; đổi 3 modal POS tự chế sang Dialog (focus trap, Esc, scroll lock, tắt phím tắt khi mở).
- Áp `EmptyState`, `PageHeader`, `Skeleton` thống nhất; bỏ emoji làm icon; thống nhất focus-visible; `aria-pressed`, `aria-activedescendant` cho combobox POS.
- Theme toggle ở POS/login; screenshot dark chạy đúng (set `theme` trong localStorage).
- Giảm `transition-all`, throttle drag carousel bằng rAF, bỏ `will-change` cố định.

### WS-F: Tính năng đề xuất (chọn lọc, giá trị cao, ít rủi ro)

1. Dashboard admin `/admin` (hôm nay: doanh thu, đơn, tồn thấp, đơn online chờ xử lý).
2. Timeline trạng thái đơn online cho khách (`pending → confirmed → shipping → delivered`).
3. Tìm kiếm toàn cục admin (Ctrl+K) trên sản phẩm/đơn/khách bằng primitives sẵn có.
4. Trang danh mục và slug SEO (đã gộp vào WS-C).

## 4. Thứ tự và cách thực thi

1. WS-A (ngay) → 2. WS-B phần DB (WAL, counter, index, cache) → 3. WS-C (SEO) song song với WS-E (UI tokens/route states) vì ít đụng file → 4. WS-D → 5. WS-F → 6. Vòng cuối: `pnpm check && pnpm build && pnpm test:e2e`, chụp screenshot hai theme, cập nhật plan status.

Song song hoá: mỗi luồng chạy test với `TEST_DATABASE_URL` riêng; chỉ một tiến trình `pnpm build`/`test:e2e` tại một thời điểm.

## 5. Kiểm thử và tiêu chí hoàn thành

- `pnpm check` xanh sau mỗi commit; `pnpm build` xanh cuối mỗi luồng; e2e xanh cuối cùng.
- Test mới: order-code concurrency (2 đơn đồng thời không lỗi), voucher validate/expiry/usage, review create/list, sitemap chứa sản phẩm, metadata `/shop` không lặp suffix, `/` chuyển tới `/shop`, cache invalidation sau `saveProduct`.
- Không còn `force-dynamic` trên trang storefront công khai; `/shop` có `Cache-Control` từ ISR/tag.

## 6. Ngoài phạm vi

- Chuyển DB khỏi SQLite, dựng Redis/CDN, cài Lighthouse CI: vi phạm ràng buộc 1.
