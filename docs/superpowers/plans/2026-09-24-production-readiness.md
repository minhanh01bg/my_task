# Kế hoạch triển khai: Sẵn sàng sản xuất (2026-09-24)

Spec: `docs/superpowers/specs/2026-09-24-production-readiness-design.md`. Nhánh `feat/pos-core`.

## Global Constraints (áp dụng cho MỌI task)

1. **KHÔNG cài đặt gì mới**: không `pnpm add`, không sửa `package.json`/`pnpm-lock.yaml`, không cài binary/dịch vụ. Chỉ dùng gói đã có: next 16.2.4, react 19, prisma 6 (SQLite), zod, @base-ui/react, @tanstack/react-query, @upstash/redis, idb, sharp, qrcode, lucide-react, @phosphor-icons/react, tw-animate-css, class-variance-authority, vitest, @testing-library/\*, playwright.
2. Tuân thủ `AGENTS.md`: `src/server/orders/create-order.ts` là đường ghi đơn duy nhất; ghi sản phẩm qua `saveProduct()`; dùng `logger` từ `src/lib/logger.ts`; endpoint JSON dùng `readJsonBody()` + Zod `safeParse`; server action trả `{ ok: true/false }`; copy tiếng Việt; tiền VND là số nguyên; import group Node/external, dòng trống, `@/`, relative; `import type`.
3. Kiểm chứng: `pnpm lint && pnpm typecheck` sạch; chạy test liên quan; chạy `pnpm test` đầy đủ 1 lần trước commit cuối của task. Chạy test với `TEST_DATABASE_URL=file:./prisma/test-<task>.db` để không đụng tiến trình khác. KHÔNG chạy `pnpm test:e2e` và KHÔNG chạy `pnpm build` (controller chạy ở cuối).
4. Commit riêng theo Conventional Commits có scope, kết thúc bằng dòng `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Chỉ `git add` các file của task mình. Không push.
5. Migration Prisma: tạo thư mục `prisma/migrations/2026MMDDHHMMSS_<name>/migration.sql` viết tay đúng SQL SQLite, đồng bộ với `schema.prisma`; không chạy `prisma migrate dev` (cần interactive). Kiểm tra bằng `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url file:./prisma/shadow.db --script` phải ra rỗng (hoặc chỉ khác biệt không đáng kể) rồi xoá `prisma/shadow.db`. Chạy `pnpm db:generate` sau khi đổi schema.
6. Không đổi hành vi tính tiền. Không xoá dữ liệu người dùng. Không đổi tên/route hiện có trừ khi task nói rõ; giữ tương thích URL cũ bằng redirect.
7. Không dùng `any`; không `console.*` ngoài `logger`. Không dùng emoji làm icon. Không hard-code màu Tailwind (`text-amber-500`...) trong component mới; dùng token (`text-warning`, `bg-primary`...).

---

## Task 1: SQLite runtime pragmas và transaction options

**Mục tiêu:** tránh "database is locked" và P2028 khi nhiều request ghi cùng lúc.

**Files:** Modify `src/server/db/prisma.ts`; Create `tests/server/db/prisma-runtime.test.ts`.

**Yêu cầu:**

- Khởi tạo `new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 15_000 } })`.
- Khi client được tạo lần đầu (không phải mỗi request), chạy một lần qua `$queryRawUnsafe`: `PRAGMA journal_mode=WAL;`, `PRAGMA busy_timeout=5000;`, `PRAGMA synchronous=NORMAL;`, `PRAGMA foreign_keys=ON;`. Chỉ khi `DATABASE_URL` bắt đầu bằng `file:`. Gói trong hàm `applySqlitePragmas(client)` export để test; lỗi pragma phải được `logger.warn` chứ không làm sập app.
- Cách kích hoạt: export `prisma` như cũ; thêm `export const prismaReady: Promise<void>` do `applySqlitePragmas` trả về; **không** chặn import. Trong `src/instrumentation.ts` `register()` (nodejs runtime) `await import("@/server/db/prisma").then(m => m.prismaReady)` để pragma chạy lúc boot.
- Test: dùng `prisma` thật với `TEST_DATABASE_URL`; sau `await prismaReady`, `PRAGMA journal_mode` trả về `wal`, `PRAGMA busy_timeout` trả về `5000`.

## Task 2: Mã đơn hàng nguyên tử và transaction ghi-trước

**Mục tiêu:** hai đơn đồng thời không bao giờ đụng unique `Order.code`; giảm thời gian giữ khoá ghi.

**Files:** Modify `src/server/orders/create-order.ts`; Create `src/server/orders/order-sequence.ts`; Create `tests/server/orders/order-sequence.test.ts`; Modify `tests/server/orders/create-order.test.ts` (hoặc file test create-order hiện có) thêm test đồng thời.

**Yêu cầu:**

- `order-sequence.ts`: `nextOrderSequence(tx)` dùng hàng `Setting` khoá `"order.sequence"`. Thực hiện bằng raw SQL nguyên tử trong transaction: `INSERT INTO "Setting"("key","value") VALUES ('order.sequence','1') ON CONFLICT("key") DO UPDATE SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT) RETURNING CAST("value" AS INTEGER) AS seq` (`tx.$queryRaw`). Lần đầu chạy trên DB đã có đơn: nếu hàng chưa tồn tại, seed từ `max(sequence trong code hiện có)`: parse số từ các `code` dạng `DH0001` bằng `SELECT MAX(CAST(SUBSTR(code, 3) AS INTEGER))` với điều kiện code khớp `DH%`, rồi insert `max+1`. Viết rõ ràng, có test cho cả hai nhánh.
- `create-order.ts`: thay `tx.order.count() + 1` bằng `nextOrderSequence(tx)` làm **câu lệnh đầu tiên** của transaction (ghi trước → giữ RESERVED lock ngay, tránh nâng cấp khoá). Giữ `preferredCode` như cũ nhưng nếu `preferredCode` bị trùng thì dùng code từ sequence. `stockMovement.create` trong vòng lặp → gom `createMany`. Giữ nguyên toàn bộ tính toán tiền, cảnh báo tồn kho, thông báo.
- Retry: nếu P2002 trên `code` (không phải `clientId`) → thử lại toàn bộ transaction tối đa 3 lần với sequence mới; nếu P2002 trên `clientId` → trả về đơn đã tồn tại (như hiện tại).
- Test đồng thời: `Promise.all` tạo 10 đơn với `clientId` khác nhau song song trên SQLite thật; tất cả thành công, 10 `code` khác nhau, liên tiếp. Test `preferredCode` trùng vẫn tạo được đơn với code khác.
- `generateOrderCode` giữ nguyên định dạng.

## Task 3: Index bổ sung

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260924100000_performance_indexes/migration.sql`.

**Yêu cầu (chính xác):**

- Product: `@@index([isActive, deletedAt, isService, soldCount])`, `@@index([isActive, deletedAt, name])`, `@@index([categoryId, isActive, soldCount])`, `@@index([deletedAt, isService, stock])`.
- Order: `@@index([status, createdAt])`, `@@index([channel, createdAt])`, `@@index([customerAccountId, channel, createdAt])`, `@@index([anonymizedAt, legalHold, createdAt])`.
- Payment: `@@index([orderId, method])`.
- GuestOrderAccess: `@@index([expiresAt])`; CustomerSession: `@@index([expiresAt])`; AdminSession: `@@index([expiresAt])`; CustomerNotification: `@@index([createdAt])`.
- Kiểm tra bằng `prisma migrate diff` (Global Constraint 5). Chạy `pnpm db:generate`. Chạy `pnpm test` toàn bộ (global setup `db push` phải thành công).

## Task 4: Cache dữ liệu công khai theo tag và gom query Setting

**Mục tiêu:** trang công khai không đọc DB lặp lại; ghi dữ liệu làm mất hiệu lực cache đúng chỗ.

**Files:** Modify `src/server/settings/store-settings.ts`, `src/server/catalog/get-online-catalog.ts`, `src/server/catalog/get-product-detail.ts`, `src/server/storefront/promotions.ts`; Create `src/server/cache/tags.ts`, `src/server/cache/public-cache.ts`; Modify các đường ghi: `src/server/products/save-product.ts`, `src/app/admin/products/actions.ts`, `src/app/admin/categories/actions.ts` (hoặc nơi ghi category), `src/app/admin/settings/actions.ts` (hoặc nơi gọi `saveStoreProfile/saveStoreBankAccount/saveStoreName`), `src/app/admin/promotions/actions.ts`, `src/server/orders/create-order.ts` và `cancel-order.ts` (soldCount/stock đổi → tag catalog); Tests: `tests/server/settings/store-settings.test.ts` (sửa/thêm), `tests/server/cache/public-cache.test.ts`.

**Yêu cầu:**

- `tags.ts`: `export const CACHE_TAGS = { catalog: "catalog", settings: "settings", promotions: "promotions", product: (id: string) => \`product:${id}\` } as const`.
- `public-cache.ts`: helper `cachedPublic<T>(fn, keyParts, { tags, revalidate })` bọc `unstable_cache` từ `next/cache`; và `revalidatePublic(...tags)` gọi `revalidateTag(tag, "max")` cho từng tag (API Next 16: `revalidateTag(tag, profile)`); mọi lỗi được `logger.warn`, không ném. Trong môi trường test (`process.env.VITEST`) `cachedPublic` gọi thẳng `fn` (unstable_cache cần request store).
- `getPublicStoreProfile()`: một query `prisma.setting.findMany({ where: { key: { in: [...] } } })`; bọc React `cache()` (dedupe trong 1 request) và `cachedPublic` tag `settings`, `revalidate: 300`. Tương tự `getStoreName()`, `getStoreBankAccount()` dùng cùng loader nội bộ. Các hàm save\* gọi `revalidatePublic("settings")`.
- `getOnlineCatalog()`: bọc `cache()` + `cachedPublic` tag `catalog`, `revalidate: 60`. Bỏ `searchText` khỏi kiểu trả về nếu client không dùng để tìm kiếm server-side (kiểm tra `filter-products.ts`; nếu client đang dùng `searchText` để lọc thì GIỮ nhưng ghi nhận trong report).
- `getOnlineProductDetail(id)`: `cache()` + `cachedPublic` tags `[product(id), catalog]`, `revalidate: 60`.
- `getActivePromotions(opts)`: `cachedPublic` tag `promotions`, `revalidate: 60`, key gồm placement/limit.
- Đường ghi: `saveProduct()` → `revalidatePublic("catalog", product(id))`; xoá/ẩn sản phẩm, đổi category → `catalog`; promotions CRUD → `promotions`; `createOrder`/`cancelOrder` (đổi stock/soldCount) → `catalog` (gọi sau transaction thành công, không trong transaction).
- Test: `store-settings` chỉ phát 1 query (spy `prisma.setting.findMany`); `public-cache` test `revalidatePublic` không ném khi `revalidateTag` lỗi (mock `next/cache`).

## Task 5: Storefront tĩnh hoá — tách session ra client island, cắt payload

**Mục tiêu:** `/shop`, `/shop/products/[id]`, 4 trang chính sách không còn `force-dynamic`; HTML không phụ thuộc cookie.

**Files:** Create `src/features/online-store/session-aware-actions.tsx` (client), Create `src/app/api/storefront/session/route.ts`; Modify `src/features/online-store/store-header.tsx`, `src/features/customer-notifications/notification-button.tsx`, `src/app/shop/page.tsx`, `src/app/shop/products/[id]/page.tsx`, 4 trang `src/app/shop/*-policy/page.tsx` + `src/app/shop/privacy/page.tsx`, `src/features/online-store/landing/flash-sale-section.tsx`, `src/features/online-store/landing/product-rail.tsx`; Tests: `tests/api/storefront-session.test.ts`, cập nhật test header/shop hiện có.

**Yêu cầu:**

- `GET /api/storefront/session`: đọc cookie admin + customer session (dùng `hasAdminSession`, `getOptionalCustomerSession`), trả `{ isAdmin: boolean, isCustomer: boolean }` với header `Cache-Control: private, no-store`. Không rate-limit đặc biệt; không lộ thông tin khác.
- `StoreHeader` không nhận `isAdmin/isCustomer` từ server nữa; render mặc định trạng thái khách (nút Tài khoản), sau hydrate gọi `/api/storefront/session` một lần (React Query đã có hoặc `useEffect` + `fetch`, `staleTime` 60s) và đổi nút Quản trị/Thông báo. Không gây layout shift: giữ cùng kích thước nút.
- `CustomerNotificationButton` nhận prop `enabled: boolean`; chỉ fetch khi `enabled`.
- Bỏ `export const dynamic = "force-dynamic"` ở 6 trang trên; bỏ mọi `cookies()`/`headers()` khỏi đường render của chúng. Thêm `export const revalidate = 60` cho `/shop` và product page; policy pages không cần (static). Cache tag từ Task 4 lo phần invalidation.
- Payload: `/shop` truyền `products.slice(0, 4)` cho `FlashSaleSection`, 8 cho `ProductRail` (đã có), `CatalogBrowser` giữ danh sách nhưng map về DTO tối thiểu `{ id, name, price, originalPrice?, unit, stock, imageUrl, categoryId, soldCount, searchText }` (bỏ field thừa). Nếu `searchText` đang dùng để lọc client thì giữ.
- Trang product: `generateMetadata` và page dùng cùng loader đã `cache()` (Task 4) → chỉ 1 lần query mỗi request.
- Kiểm tra: `grep -rn "force-dynamic" src/app/shop` chỉ còn 0 kết quả; `pnpm typecheck` sạch; test header vượt.

## Task 6: Rate limiter hiệu quả và ngưỡng thực tế

**Files:** Modify `src/server/security/rate-limit.ts`, `src/server/security/rate-limit-policy.ts`, `src/server/security/checkout-abuse.ts`; Tests hiện có trong `tests/server/security/*` cập nhật.

**Yêu cầu:**

- Store Redis khởi tạo một lần ở cấp module (lazy singleton), không tạo mỗi `check()`.
- Các bucket trong một `check()` và trong `checkout-abuse` tăng song song bằng `Promise.all`; kết quả từ chối nếu bất kỳ bucket nào vượt.
- `clearTimeout` timer trong `withTimeout` (dùng `finally`).
- Ngưỡng: checkout `global-burst` 500/phút → 6000/phút; `product-velocity` 100/phút → 600/phút; customer-auth `global-attempts` 1000/15 phút → 10000/15 phút. Giữ per-IP/subnet/phone như cũ. Cập nhật test số liệu tương ứng.
- Không đổi hành vi fail-closed/fail-open hiện có.

## Task 7: Query admin có phân trang, select tối thiểu, báo cáo theo giờ Việt Nam

**Files:** Modify `src/app/admin/orders/page.tsx`, `src/app/admin/products/page.tsx`, `src/app/admin/customers/page.tsx`, `src/app/admin/debts/page.tsx`, `src/server/reports/daily-revenue.ts`, `src/app/api/customer/notifications/route.ts`, `src/server/orders/order-access.ts`; Tests: `tests/server/reports/daily-revenue.test.ts` (sửa/thêm), test phân trang mới `tests/app/admin-lists-pagination.test.ts` (test hàm loader tách ra, không render page).

**Yêu cầu:**

- Tách logic truy vấn của mỗi trang admin ra hàm server trong `src/server/admin/list-*.ts` (ví dụ `list-products.ts`, `list-customers.ts`, `list-debts.ts`, `list-orders.ts`) nhận `{ page, pageSize, q, filters }` và trả `{ items, total, page, pageSize }`. Page chỉ gọi hàm và render.
- `Promise.all([count, findMany])`; `select` đúng cột cần; **không bao giờ** select `passwordHash`.
- Products: phân trang 50/trang, đếm theo filter bằng `count`/`groupBy`; tìm kiếm bằng `searchText contains normalize(q)` (dùng `normalizeSearchText` trong `src/lib/search/search-text.ts`).
- Customers: 50/trang, `_count` giữ nhưng có `take`. Debts: 50/trang.
- Orders: `Promise.all`; search: nếu `q` khớp `^DH\d+$` → tìm `code` chính xác; nếu toàn số → `contactPhone startsWith`; còn lại → `contains` trên `contactName` và `code`.
- UI phân trang: dùng component `Pagination` đơn giản (Create `src/components/kit/pagination.tsx` nếu chưa có) với link `?page=`.
- Báo cáo: bucket theo ngày múi giờ `Asia/Ho_Chi_Minh` (+7): tính key ngày bằng `new Date(createdAt.getTime() + 7*3600*1000).toISOString().slice(0,10)`; thêm tham số `days: 7 | 14 | 30` (mặc định 14) và trả thêm `byChannel: { pos: number; online: number }` cho mỗi ngày. Test có ca đơn lúc 02:00 UTC ngày N phải thuộc ngày N theo giờ VN (09:00), đơn lúc 18:00 UTC ngày N phải thuộc ngày N+1.
- Customer notifications route: `select` cột cần.
- `order-access.ts` lịch sử đơn khách: `take: 50`, sắp xếp `createdAt desc`.

## Task 8: SEO nền tảng — điểm vào, tiêu đề, robots, cấu hình

**Files:** Modify `next.config.ts`, `src/app/page.tsx` (xoá, thay bằng redirect trong config hoặc giữ file redirect tới `/shop`), `src/app/layout.tsx`, `src/config/site.ts`, `src/config/env.ts`, `src/app/robots.ts`, `src/app/not-found.tsx`, `src/app/loading.tsx`, `src/app/global-error.tsx`, `src/app/shop/page.tsx` (title absolute), `src/app/shop/products/[id]/page.tsx` (title absolute), `src/app/checkout/page.tsx`, `src/app/account/**/page.tsx`, `src/app/login/page.tsx`, `src/features/online-store/product-detail-view.tsx` (`priority`→`preload`), `src/providers/index.tsx`, `src/app/admin/layout.tsx`, `src/app/pos/layout.tsx` (tạo nếu chưa có) để đặt `QueryProvider` + `ServiceWorkerRegistrar`, `src/components/providers/observability-provider.tsx`, `public/manifest.webmanifest`, Create `public/shop.webmanifest`; Tests: `tests/config/storefront-metadata.test.ts` cập nhật; `e2e/home.spec.ts` cập nhật kỳ vọng `/` → `/shop` (không chạy e2e, chỉ sửa).

**Yêu cầu:**

- `/` → `/shop` bằng `redirects()` trong `next.config.ts` với `permanent: true`; xoá `src/app/page.tsx` (hoặc để `redirect("/shop")` nếu cần giữ loading). Sitemap sẽ do Task 9 sửa.
- `site.ts`: `name` = `NEXT_PUBLIC_STORE_NAME ?? STORE_NAME ?? "Cửa hàng"`; `description` tiếng Việt: "Cửa hàng tạp hoá trực tuyến: nhu yếu phẩm, thực phẩm, đồ tiêu dùng chính hãng. Đặt nhanh, giao tận nơi."; `url`: `NEXT_PUBLIC_APP_URL` nếu đặt, nếu không dùng `CANONICAL_ORIGIN`, cuối cùng `http://localhost:3000`. Trong `env.ts` production: nếu cả hai đều thiếu hoặc là localhost → lỗi fail-closed (thêm issue).
- `layout.tsx`: `title: { default: siteConfig.name, template: \`%s | ${siteConfig.name}\` }`; thêm `openGraph: { siteName, locale: "vi_VN", type: "website" }`, `twitter: { card: "summary_large_image" }`, `robots`mặc định index; export`viewport`với`themeColor` light/dark từ token (`#ffffff`/`#0a0a0a` hoặc màu nền thực tế của globals.css).
- Trang `/shop` và product: `title` không lặp tên cửa hàng (dùng template gốc; bỏ `| ${storeProfile.name}`). Nếu tên cửa hàng trong DB khác `siteConfig.name`, dùng `title: { absolute: ... }`.
- `robots: { index: false, follow: false }` trong metadata cho `/checkout`, `/account/*`, `/login`. `robots.ts` disallow thêm `/login`, `/pos`, `/dev/`.
- `not-found.tsx`, `loading.tsx`, `global-error.tsx`: tiếng Việt, dùng token màu, link về `/shop`, nút dùng `Button`.
- `product-detail-view.tsx`: `priority` → `preload` trên ảnh LCP.
- `next.config.ts`: `images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 2592000 }`; headers `Cache-Control: public, max-age=31536000, immutable` cho `/uploads/:path*` và `/products/:path*` (chỉ nếu tên file là UUID — xác nhận trong `save-image.ts`).
- Providers: `QueryProvider` chuyển vào layout admin và POS (tạo `src/app/pos/layout.tsx` nếu chưa có) — storefront không còn React Query trừ khi Task 5 đã dùng React Query trong header (kiểm tra: nếu Task 5 dùng `useQuery` trong header thì giữ `QueryProvider` ở root và ghi nhận). `ServiceWorkerRegistrar` chỉ trong layout POS/admin. `public/manifest.webmanifest` giữ cho POS; `public/shop.webmanifest` với `start_url: "/shop"`, tên cửa hàng; root layout không đặt `manifest`, layout POS đặt `/manifest.webmanifest`, `/shop` layout (tạo `src/app/shop/layout.tsx` nếu chưa có) đặt `/shop.webmanifest`.
- `ObservabilityProvider`: chỉ render `Analytics`/`SpeedInsights` khi `process.env.NEXT_PUBLIC_VERCEL_ENV` hoặc `process.env.VERCEL` có giá trị.
- Font: bỏ weight `800` nếu `grep -rn "font-extrabold\|font-\[800\]" src` không có kết quả; `Geist_Mono` thêm `preload: false`.

## Task 9: Dữ liệu có cấu trúc, sitemap động, ảnh OG

**Files:** Modify `src/app/sitemap.ts`, `src/app/shop/page.tsx`, `src/app/shop/products/[id]/page.tsx`, 4 trang chính sách + `src/features/online-store/policy-layout.tsx`, `src/features/online-store/product-detail-view.tsx` (breadcrumb markup); Create `src/app/opengraph-image.tsx`, `src/lib/seo/json-ld.ts`; Tests: `tests/lib/seo/json-ld.test.ts`, cập nhật `tests/config/storefront-metadata.test.ts`.

**Yêu cầu:**

- `json-ld.ts`: builder thuần (không DB) `organizationJsonLd(profile, url)`, `webSiteJsonLd(url)` với `potentialAction: SearchAction` target `${url}/shop?q={search_term_string}`, `localBusinessJsonLd(profile, url)` (`@type: "Store"`, `address` là `PostalAddress` với `streetAddress` = profile.address, `addressCountry: "VN"`, `openingHours` chuỗi giữ nguyên nếu có, `telephone`), `productJsonLd(product, url, profile)` (image URL tuyệt đối, `brand: { "@type": "Brand", name: profile.name }`, `offers` với `price`, `priceCurrency: "VND"`, `availability` `InStock`/`OutOfStock`, `url` canonical; **không** `aggregateRating`), `breadcrumbJsonLd(items)`. Tất cả có test snapshot-lite (kiểm tra field bắt buộc).
- `/shop`: phát `Organization`, `WebSite`, `Store`. Product page: `Product` + `BreadcrumbList` (Trang chủ → Cửa hàng → Danh mục → Sản phẩm). Policy pages: `BreadcrumbList` + `alternates.canonical` + `openGraph`.
- `sitemap.ts` async: trang tĩnh (`/shop`, 4 chính sách) không `lastModified` giả; thêm mọi sản phẩm `isActive && !deletedAt` (`/shop/products/${id}`, `lastModified: updatedAt` — nếu Product chưa có `updatedAt` thì thêm cột `updatedAt DateTime @updatedAt` kèm migration `20260924110000_product_updated_at`, default `CURRENT_TIMESTAMP`). Bỏ entry `/`.
- `opengraph-image.tsx` (runtime nodejs, `ImageResponse` từ `next/og`): nền màu thương hiệu, tên cửa hàng từ `getPublicStoreProfile()`, dòng mô tả. Root `metadata.openGraph.images` tự nhận. Product page dùng ảnh sản phẩm nếu có, không thì ảnh OG mặc định.
- Test metadata: `/shop` title không chứa "Next.js with Agent" và không lặp tên cửa hàng; sitemap chứa product URL khi DB có sản phẩm.

## Task 10: Slug SEO cho sản phẩm và trang danh mục

**Files:** Modify `prisma/schema.prisma` (Product `slug String? @unique`, Category `slug String? @unique`), Create migration `20260924120000_seo_slugs`, Modify `src/server/products/save-product.ts` (sinh slug từ tên, bảo đảm unique bằng hậu tố `-2`, `-3`), category save path tương tự, Create `src/lib/seo/slugify.ts` + test, Create `src/app/shop/p/[slug]/page.tsx` (trang sản phẩm canonical mới, dùng lại `product-detail-view`), Create `src/app/shop/c/[slug]/page.tsx` (trang danh mục: header, mô tả, lưới sản phẩm của danh mục, phân trang 24/trang, metadata + BreadcrumbList + canonical), Modify `src/app/shop/products/[id]/page.tsx` → nếu sản phẩm có slug thì `permanentRedirect` tới `/shop/p/[slug]`, Modify mọi `href` tới `/shop/products/${id}` trong `src/features/online-store/**` và `src/components/kit/product-tile.tsx` dùng helper `productHref(product)` (Create `src/lib/seo/product-href.ts`) trả slug URL khi có, id URL khi không; `category-section.tsx` link tới `/shop/c/[slug]`; sitemap (Task 9) dùng slug URL và thêm category URL. Create script backfill `scripts/backfill-slugs.ts` (chạy bằng `pnpm tsx`) và gọi backfill tự động trong `prisma/seed.ts`.

**Yêu cầu:**

- `slugify`: bỏ dấu tiếng Việt (đ→d), lowercase, `[^a-z0-9]+`→`-`, cắt 80 ký tự. Test: "Cà phê Robusta 500g" → "ca-phe-robusta-500g"; "Đường Biên Hoà" → "duong-bien-hoa".
- Trang danh mục dùng query server có `take/skip`, index `[categoryId, isActive, soldCount]` (Task 3). Cache tag `catalog`.
- Không phá test hiện có về `/shop/products/[id]` (giữ route, redirect khi có slug; test cập nhật).

## Task 11: Token giao diện, trạng thái route, dark mode nhất quán

**Files:** Modify `src/app/globals.css`; Create `src/app/admin/loading.tsx`, `src/app/admin/error.tsx`, `src/app/pos/loading.tsx`, `src/app/pos/error.tsx`, `src/app/login/loading.tsx`, `src/app/order-success/[receipt]/loading.tsx`; Modify các `loading.tsx` hiện có dùng kit `Skeleton`; Modify `src/components/shared/theme-toggle.tsx`, `src/components/pos/pos-screen.tsx` (thêm ThemeToggle vào header POS), `src/app/login/page.tsx` hoặc `login-form.tsx` (ThemeToggle góc trên), `e2e/screens.spec.ts` + `e2e/kit-gallery.spec.ts` (set `localStorage.theme = "dark"` qua `addInitScript` thay vì `emulateMedia`; ghi ảnh vào `e2e/screenshots/` thay vì `test-results/`; thêm `.gitignore` entry nếu cần — KHÔNG chạy e2e); Tests: `tests/config/design-tokens.test.ts` (đọc globals.css và assert các token tồn tại trong cả `:root` và `.dark`).

**Yêu cầu:**

- `.dark`: palette cùng thương hiệu với light (oklch nền ấm tối `oklch(0.17 0.01 60)`, card `0.21`, primary xanh lá cùng hue với light nhưng sáng hơn ~0.7 L, accent amber, `--ring` = primary, sidebar-primary = primary, chart tokens 5 màu phân biệt cả 2 theme, `--success/--warning/--info` dark variants). Giữ tên biến hiện có.
- Thêm `--destructive-foreground` ở cả 2 theme; đưa `--touch-target` vào `@theme inline` dưới dạng `--spacing-touch: 2.75rem` để `min-h-touch`/`size-touch` sinh class (kiểm tra `TouchButton` và `ResultRow` render đúng chiều cao ≥ 44px trong test hiện có).
- Bỏ định nghĩa `.animate-in` trùng với tw-animate-css (giữ keyframe riêng nếu có tên khác).
- `theme-toggle.tsx`: dùng token (`text-warning`, `text-foreground`) thay `amber-400/slate-700`.
- Body gradient: chỉ áp dụng ở light; dark dùng nền phẳng.
- `loading.tsx` mới: dùng `Skeleton`, `ProductCardSkeleton`, `TableSkeleton` từ `src/components/kit`. `error.tsx`: tiếng Việt, nút `Button` "Thử lại" gọi `reset()`, log qua `logger` phía client? (client không có logger → dùng `console.error` được phép trong error boundary; ghi chú rõ).
- Test tokens: `tests/config/design-tokens.test.ts` assert `.dark` chứa `--destructive-foreground`, `--ring`, `--chart-1..5`; `@theme inline` chứa `--spacing-touch`.

## Task 12: Primitives còn thiếu và hộp thoại POS đạt chuẩn truy cập

**Files:** Create `src/components/ui/sheet.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/dropdown-menu.tsx` (Base UI `Menu`), `src/components/ui/switch.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/toast.tsx` (Base UI `Toast` nếu có trong @base-ui/react 1.8; nếu không, viết provider nhỏ với `aria-live`); Modify `src/components/ui/dialog.tsx` (nhãn đóng "Đóng"; bỏ double animation: giữ Base UI starting-style, bỏ class tw-animate), `src/app/globals.css` (bỏ `will-change` cố định cho select/tabs; sửa starting style cho bottom sheet admin-nav), `src/components/pos/payment-dialog.tsx`, `src/components/pos/service-line-dialog.tsx`, `src/components/pos/pos-screen.tsx` (confirm inline → `Dialog`), `src/components/pos/use-pos-shortcuts.ts` (không bắt F2/F4/F8 khi có dialog mở: kiểm tra `document.querySelector('[role="dialog"][data-open], [data-slot="dialog-content"]')`), `src/components/pos/product-search.tsx` (`aria-activedescendant`, `id` cho option, `scrollIntoView({ block: "nearest" })`), `src/components/pos/category-grid.tsx` (`aria-pressed`), `src/features/online-store/quick-view-modal.tsx` và `cart-drawer.tsx` (chuyển sang `Dialog`/`Sheet` để có focus trap + scroll lock), `src/features/admin-notifications/notification-button.tsx` (Escape + click-outside), `src/app/dev/kit/page.tsx` (thêm gallery cho primitives mới); Xoá emoji icon trong `settings-form.tsx`, `promotion-form.tsx`, `cart-drawer.tsx`, `flash-sale-section.tsx`, `hero-carousel.tsx`, `revoke-guest-button.tsx` (thay bằng lucide icon `Check`, `X`, `PartyPopper`, `Flame`, `Truck`, `Leaf`); Tests: `tests/components/ui/*.test.tsx` cho từng primitive mới (render, mở/đóng, Escape), cập nhật test POS dialog (Escape đóng, focus quay lại nút mở).

**Yêu cầu:**

- API primitives theo phong cách shadcn base-nova hiện có (`data-slot`, `cn`, cva). Sheet có `side: "right" | "bottom"`.
- Payment dialog: Escape đóng (khi không đang submit), focus trap, trả focus, scroll lock — có test.
- Phím tắt POS không kích hoạt khi dialog mở — có test.
- Không đổi luồng thanh toán/tính tiền.

## Task 13: Thống nhất EmptyState, PageHeader, Skeleton và làm mượt chuyển động

**Files:** Modify các trang admin `orders`, `customers`, `debts`, `products`, `promotions`, `reports`, `categories` (thêm empty state), POS `cart-panel.tsx`, `product-search.tsx`, hai notification panel, `product-rail.tsx`, `offline-queue-manager.tsx` → dùng `EmptyState`; `admin/products/page.tsx`, `admin/categories/page.tsx`, `admin/orders/[id]/page.tsx` → `PageHeader`; `admin/customers` → `ui/table` + `DataTableShell`; thêm layout thẻ cho màn hình hẹp (`sm:hidden` card list) ở orders/customers/debts; `hero-carousel.tsx`: throttle `handleMove` bằng `requestAnimationFrame`, thay `transition-all` bằng thuộc tính cụ thể; thay `transition-all` trong `category-section.tsx`, `tabs.tsx`, `number-stepper.tsx`; bỏ `hover:-translate-y` trên lưới sản phẩm (giữ shadow/border thay đổi); `card-interactive` chỉ đổi shadow/border; gộp 2 `ProductImage` (giữ `src/components/kit/product-image.tsx`, `shared/product-image.tsx` re-export); Tests: cập nhật test render các trang/kit bị ảnh hưởng; `tests/components/kit/empty-state.test.tsx` nếu chưa có.

**Yêu cầu:**

- Không đổi hành vi dữ liệu. Snapshot/text test cũ vẫn vượt (cập nhật text nếu EmptyState đổi copy, giữ tiếng Việt).
- `grep -rn "transition-all" src` giảm ≥ 80% so với trước (ghi số trước/sau trong report).

## Task 14: Voucher thật — model, engine, admin, checkout

**Files:** Modify `prisma/schema.prisma` (Create model `Voucher { id, code @unique (UPPER), type: "percent"|"fixed"|"freeship", value Int, maxDiscount Int?, minOrderTotal Int @default(0), maxUses Int?, usedCount Int @default(0), startsAt DateTime?, endsAt DateTime?, isActive Boolean @default(true), createdAt, updatedAt }`; Order thêm `voucherCode String?`, `voucherDiscount Int @default(0)`, `deliverySlot String?`), Create migration `20260924130000_vouchers`; Rewrite `src/lib/vouchers/validate-voucher.ts` thành pure engine `applyVoucher(voucher, { subtotal, shippingFee, now })` → `{ ok, discount, shippingDiscount, reason? }` (không còn danh sách mã tĩnh); Create `src/server/vouchers/get-voucher.ts` (tìm theo code, cache tag `vouchers`), `src/server/vouchers/admin-vouchers.ts` (list/create/update/toggle/delete + audit event như promotions), `src/app/api/online/vouchers/validate/route.ts` (POST `{ code, subtotal }` → kết quả, rate limit theo IP dùng policy có sẵn), `src/app/admin/promotions/vouchers/page.tsx` + `actions.ts` + `src/features/admin-vouchers/voucher-form.tsx` (dùng `DropdownField`, `DateField`, `NumberStepper`, `Switch`), link trong admin nav dưới Khuyến mãi; Modify `src/server/orders/create-online-order.ts` (validate voucher server-side, tính `voucherDiscount`/`shippingFee` sau giảm, tăng `usedCount` nguyên tử trong transaction với điều kiện `usedCount < maxUses`, lưu `voucherCode`, `deliverySlot` vào cột riêng thay vì `note`), `src/features/online-store/checkout-form.tsx` (gọi API validate, hiển thị giảm giá; không import danh sách mã), `cart-drawer.tsx` (ô nhập mã dùng cùng API); Tests: `tests/lib/vouchers/apply-voucher.test.ts` (percent có maxDiscount, fixed, freeship, hết hạn, chưa bắt đầu, hết lượt, dưới minOrder), `tests/server/vouchers/admin-vouchers.test.ts`, `tests/server/orders/create-online-order-voucher.test.ts` (usedCount tăng, vượt maxUses bị từ chối, 2 đơn đồng thời với voucher còn 1 lượt → đúng 1 thành công), cập nhật test checkout.

**Yêu cầu:**

- Mã voucher chuẩn hoá `trim().toUpperCase()`. Freeship giảm `shippingFee` (không giảm hàng). Đơn hàng lưu tổng đúng: `total = subtotal - discount - voucherDiscount + shippingFee`. `create-order.ts` nhận `voucherDiscount` như một phần `orderDiscount`? KHÔNG — giữ `orderDiscount` cho giảm giá thủ công; thêm trường input `voucher?: { code, discount, shippingDiscount }` và cộng vào `discount` khi lưu, đồng thời ghi `voucherCode/voucherDiscount`. Giữ bất biến "tiền tính lại phía server".
- Seed: thêm 2 voucher mẫu (`GIAM10` percent 10% max 30k, `FREESHIP` freeship min 200k).

## Task 15: Đánh giá sản phẩm thật

**Files:** Modify `prisma/schema.prisma` (Create `ProductReview { id, productId (FK cascade), accountId String? (FK CustomerAccount SetNull), authorName String, rating Int (1..5), content String, isVerifiedPurchase Boolean @default(false), status "published"|"hidden" @default("published"), createdAt }` + `@@index([productId, status, createdAt])`; Product thêm `ratingAvg Float @default(0)`, `ratingCount Int @default(0)`), Create migration `20260924140000_product_reviews`; Create `src/server/reviews/list-reviews.ts`, `src/server/reviews/create-review.ts` (validate Zod, xác định `isVerifiedPurchase` = tồn tại Order của account có item productId với `fulfillmentStatus` = delivered hoặc status paid; cập nhật `ratingAvg/ratingCount` trong cùng transaction; revalidate tag `product(id)`), `src/app/api/online/products/[id]/reviews/route.ts` (GET phân trang 10, POST yêu cầu customer session, rate limit theo account 5/ngày dùng policy sẵn có), `src/app/admin/reviews/page.tsx` + actions (ẩn/hiện, xoá) + nav link; Rewrite `src/features/online-store/product-reviews.tsx` (xoá `DEFAULT_REVIEWS`; nhận `initialReviews`, `summary { avg, count }` từ server; form gửi khi đăng nhập, ngược lại CTA đăng nhập; trạng thái rỗng dùng `EmptyState`), `product-detail-view.tsx` (hiển thị `StarRating` thật; ẩn khi `ratingCount === 0`), `product-rail.tsx`/`product-tile.tsx` (rating thật hoặc ẩn), `hero-constants.ts` (bỏ "4.9★ 2.800+ đánh giá" → copy không số liệu giả); Task 9 `productJsonLd`: thêm `aggregateRating` CHỈ khi `ratingCount > 0`; Tests: `tests/server/reviews/*.test.ts`, `tests/api/product-reviews.test.ts`, cập nhật test component.

## Task 16: Hoàn thiện các mảnh dở còn lại

**Files & yêu cầu (mỗi mục một commit):**

1. Hoá đơn K80: thêm `PrintReceiptButton` dùng `receipt-k80.tsx` trên `src/app/admin/orders/[id]/page.tsx` và sau khi thanh toán POS thành công (`payment-dialog.tsx` màn hình xong → nút "In hoá đơn"); `receipt-k80` nhận `bankAccount?` và hiển thị VietQR (dùng `qrcode` + `src/lib/vietqr` sẵn có) khi đơn chưa thanh toán đủ hoặc là chuyển khoản. Test render có/không QR.
2. `cancel-order.ts`: giảm `soldCount` theo số lượng dòng khi huỷ (không âm); test.
3. Badge tồn kho thấp trên `admin-nav.tsx` (số sản phẩm `stock <= lowStockThreshold`; lấy từ hàm `countLowStock()` trong `src/server/reports/daily-revenue.ts` hoặc tách `src/server/products/low-stock.ts`), cập nhật khi vào trang; test.
4. Báo cáo: toggle 7/14/30 ngày (searchParam `days`), biểu đồ tách POS/online (2 series trong `ChartSvg`), top 5; dùng dữ liệu Task 7.
5. Quick view trong `ProductTile` (nút "Xem nhanh" hiện khi hover/focus, mở `QuickViewModal`) và trong `catalog-browser.tsx`.
6. Cart drawer: xác nhận trước khi xoá dòng (dùng `Dialog` nhỏ hoặc undo toast 5s — chọn undo toast với `Toast` từ Task 12); ngưỡng freeship đọc từ setting `store.freeShippingThreshold` (mặc định 200000) và `create-online-order.ts` tính `shippingFee` = setting `store.shippingFee` (mặc định 0) khi dưới ngưỡng; thêm hai ô này vào `settings-form.tsx`.
7. Skeleton: `CatalogBrowser` hiển thị `ProductCardSkeleton` khi đang lọc (`useTransition`), `admin/products/loading.tsx` dùng `TableSkeleton`.
8. Wishlist drawer: Create `src/features/online-store/wishlist-drawer.tsx` (Sheet phải, danh sách từ `useWishlist`, nút thêm vào giỏ); header mở drawer thay vì link `?wishlist=true`.

## Task 17: Bảng điều khiển admin `/admin`

**Files:** Create `src/app/admin/page.tsx`, `src/server/admin/dashboard.ts` (+ test), `src/features/admin-dashboard/*`; Modify `admin-nav.tsx` (mục "Tổng quan" đầu tiên), `src/app/login` redirect sau đăng nhập → `/admin` (kiểm tra nơi redirect hiện tại), `src/lib/auth/public-paths.ts` nếu cần.

**Yêu cầu:** 4 `StatTile` (doanh thu hôm nay theo giờ VN, số đơn hôm nay, đơn online chờ xử lý `fulfillmentStatus in (new, confirmed)`, sản phẩm sắp hết); biểu đồ 7 ngày (dùng `daily-revenue` với `days=7`); danh sách 5 đơn online mới nhất với link; danh sách 5 sản phẩm tồn thấp với quick edit link. Tất cả query dùng `select` tối thiểu và `Promise.all`. Skeleton `loading.tsx`. Test hàm `getDashboardSummary()`.

## Task 18: Dòng thời gian trạng thái đơn online cho khách

**Files:** Create `src/features/customer-account/order-timeline.tsx` (+ test), Modify `src/app/account/orders/[id]/page.tsx`, `src/app/orders/guest/[token]/page.tsx`, `src/app/order-success/[receipt]/page.tsx` để hiển thị timeline; dùng `fulfillmentStatus` hiện có (xem `src/server/orders/update-online-order.ts` để lấy danh sách trạng thái và thứ tự); Modify `src/app/admin/orders/[id]/page.tsx` nếu chưa có nút chuyển trạng thái đầy đủ (kiểm tra và bổ sung nút còn thiếu, dùng action có sẵn).

**Yêu cầu:** timeline dọc, bước hiện tại nổi bật bằng token primary, bước huỷ dùng destructive; có `aria-current="step"`; hiển thị thời gian nếu có (nếu Order chưa lưu mốc thời gian từng bước thì chỉ hiển thị trạng thái, KHÔNG thêm bảng mới).

## Task 19: Tìm kiếm toàn cục admin (Ctrl+K)

**Files:** Create `src/features/admin-search/command-palette.tsx` (Dialog + input + danh sách kết quả nhóm Sản phẩm/Đơn/Khách, điều hướng phím mũi tên, Enter mở), `src/app/api/admin/search/route.ts` (GET `q`, yêu cầu admin session qua `requireAdminSession` hoặc helper API tương đương, trả tối đa 5 mỗi nhóm, dùng `searchText` cho sản phẩm và logic Task 7 cho đơn/khách), hook phím tắt `Ctrl/Cmd+K` trong `admin/layout.tsx`, nút kính lúp trong `admin-nav.tsx`; Tests: `tests/api/admin-search.test.ts`, `tests/components/admin/command-palette.test.tsx`.

## Task 20: Cổng chất lượng cuối và cập nhật tài liệu

**Controller tự làm:** `pnpm check && pnpm build && pnpm test:e2e`; chụp screenshot 2 theme; cập nhật `.env.example` (biến mới: `NEXT_PUBLIC_APP_URL` khuyến nghị, `UV_THREADPOOL_SIZE=8` gợi ý), cập nhật `AGENTS.md` (cache tags, slug, voucher invariants), ghi "Execution status" vào plan này và plan 2026-09-11; commit; push `feat/pos-core`.
