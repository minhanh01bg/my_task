# Online Store Experience Completion Plan

> **For agentic workers:** Thực hiện theo đúng thứ tự dependency. Mỗi task bắt đầu bằng test thất bại, chỉ triển khai phạm vi của task, chạy focused quality gate, rồi tạo một Conventional Commit độc lập. Không gom landing page, cart feedback, checkout address và customer notification vào cùng commit.

**Ngày:** 2026-09-07

**Mục tiêu:** Hoàn thiện Online Store từ một catalog/checkout MVP thành trải nghiệm mua hàng đầy đủ, dễ hiểu và có thể vận hành: landing page, nội dung quảng bá do admin quản lý, catalog có bộ lọc/sắp xếp, phản hồi rõ khi thêm giỏ, cart drawer, địa chỉ giao nhận tốt hơn, thông báo trạng thái đơn cho khách và các trạng thái loading/empty/error/accessibility tương ứng.

**Nguồn đối chiếu:**

- `docs/superpowers/specs/2026-09-06-online-store-design.md`
- `docs/superpowers/plans/2026-09-06-online-store.md`
- `design-system/an-phat-pos/MASTER.md`

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Prisma 6 + SQLite, Zod 4, Vitest 4, Playwright 1.59.

---

## 1. Vì sao storefront hiện tại còn thiếu

Plan ngày 2026-09-06 chủ đích là **MVP giao dịch tối thiểu**: catalog công khai, tìm kiếm, giỏ lưu local, checkout và xử lý đơn. Spec cũ cũng ghi rõ CMS, marketing, đa địa chỉ, vận chuyển và notification cho khách nằm ngoài phạm vi. Quá trình security hardening ngày 2026-09-07 tiếp tục ưu tiên trust boundary, stock, idempotency, session và privacy thay vì mở rộng trải nghiệm.

Ngoài giới hạn chủ đích đó, implementation hiện tại còn chưa hoàn thành trọn vẹn một số chi tiết đã có trong MVP plan:

- Không có landing page thực sự; `/shop` mở thẳng catalog với một đoạn hero tĩnh nhỏ.
- Không có banner/campaign/announcement bar và admin không quản lý được nội dung storefront.
- Catalog chỉ có search + category chips; chưa có sort, khoảng giá, trạng thái còn hàng, filter summary hoặc URL state.
- `add(product)` không trả kết quả và UI không có toast/aria-live nên người dùng không biết thao tác đã thành công, bị giới hạn tồn hay không thay đổi.
- Header gọi CTA là “Giỏ hàng” nhưng dẫn thẳng đến checkout; chưa có cart drawer/panel để xem nhanh, sửa số lượng hoặc xóa.
- Checkout dùng bốn ô text địa chỉ rời rạc; chưa có selector tỉnh/quận/phường, lưu địa chỉ, xác nhận pickup address hoặc validation theo cấu trúc.
- Chưa có notification dành cho customer. `AdminNotification` hiện chỉ phục vụ quản trị viên và không được tái sử dụng cho trust domain khách hàng.
- Thiếu footer, thông tin cửa hàng, chính sách mua hàng/giao nhận, trust cues và các section merchandising cơ bản.
- Test storefront hiện quá mỏng: component catalog chỉ có một test search; E2E chưa khóa các interaction feedback và discovery flow.

---

## 2. Nguyên tắc sản phẩm và kiến trúc

### 2.1 Trust domain

- Storefront content là public-read, admin-write.
- Customer notification thuộc customer identity; tuyệt đối không tái sử dụng `AdminNotification` hoặc admin session.
- Guest không có inbox lâu dài. Guest tiếp tục xem đơn qua capability URL; notification ngoài hệ thống như SMS/Zalo/email chỉ triển khai sau khi có provider và consent riêng.
- Mọi cấu hình storefront mutation phải gọi `requireAdminSession()` tại server boundary, validate Origin và strict Zod.

### 2.2 Rendering và state

- Landing, campaign, store profile, category và catalog payload dùng Server Components.
- Filter/search/cart/toast/address selectors là client leaf nhỏ dưới `src/features/online-store/`.
- Filter state có thể chia sẻ qua URL; cart tiếp tục versioned local storage nhưng phải validate dữ liệu hydrate.
- Không đưa toàn bộ page thành Client Component chỉ để hiển thị toast hoặc cart drawer.

### 2.3 Nội dung quảng bá

- “Quảng cáo” trong phase này là **first-party storefront promotion** do admin tạo, không phải ad network bên thứ ba.
- Không nhúng script tracking/third-party ad SDK. Nếu sau này cần ad network phải security/privacy review riêng, cập nhật CSP và consent.
- Banner image dùng pipeline ảnh đã kiểm soát; CTA chỉ nhận internal path allowlist hoặc URL HTTPS đã duyệt.

### 2.4 UX và accessibility

- Mọi thao tác thêm/sửa/xóa giỏ phải có phản hồi trực quan và `aria-live` không gây spam.
- Touch targets tối thiểu 44px; các control liền nhau có gap tối thiểu 8px.
- Filter không được phụ thuộc màu để biểu thị selected; dùng `aria-pressed`, label và count.
- Toast không giữ thông tin duy nhất; cart badge/count và drawer phải phản ánh state bền vững.
- Hỗ trợ 375px, 768px, 1024px, 1440px; không horizontal overflow; focus không bị sticky header/drawer che.
- Tôn trọng reduced motion; không dùng animation bắt buộc để hiểu kết quả.

### 2.5 Commit policy

- Mỗi task đúng một concern và một Conventional Commit.
- Fix ngoài phạm vi phát hiện trong verification phải là commit riêng.
- Sau khi toàn bộ task xanh: push không force lên đúng `feat/pos-core`.

---

## 3. Ma trận gap và ưu tiên

| Khu vực               | Hiện trạng                      | Kết quả cần đạt                                       | Ưu tiên |
| --------------------- | ------------------------------- | ----------------------------------------------------- | ------- |
| Add-to-cart feedback  | Không có xác nhận               | Toast + live region + trạng thái quantity/cap         | P0      |
| Cart discovery        | CTA dẫn thẳng checkout          | Drawer xem/sửa/xóa + CTA checkout                     | P0      |
| Catalog controls      | Search + category               | URL state, sort, giá, còn hàng, clear/filter count    | P0      |
| Checkout address      | Text input thủ công             | Structured selectors, validation, address summary     | P0      |
| Landing page          | Hero tĩnh trong catalog         | Route/sections rõ, CTA, featured categories/products  | P1      |
| Promotion/banner      | Không có                        | Campaign model + admin CRUD + public rendering        | P1      |
| Store information     | Chỉ có tên                      | Địa chỉ, hotline, giờ mở cửa, pickup guidance, footer | P1      |
| Customer notification | Không có                        | Inbox riêng, order events, unread state               | P1      |
| Merchandising         | Không có featured/new/low-price | Server-derived product rails có fallback              | P2      |
| Content/policies      | Không có                        | Delivery/payment/return/privacy pages                 | P2      |
| SEO/share             | Tối thiểu                       | Metadata, canonical, OG, structured data phù hợp      | P2      |
| Analytics             | Chưa có funnel rõ               | Privacy-safe event allowlist, không PII/token         | P2      |

---

## 4. Dependency order

1. Chốt storefront contracts và test baseline.
2. Hoàn thiện interaction feedback và cart drawer trước khi thêm marketing traffic.
3. Hoàn thiện catalog filter và địa chỉ checkout để discovery → purchase không bị gãy.
4. Bổ sung store profile và landing foundation.
5. Bổ sung campaign/admin content management.
6. Bổ sung customer notification trong trust domain riêng.
7. Hoàn thiện policy, SEO, analytics và final quality gate.

---

## Task 1: Storefront UX contracts và baseline audit

**Priority:** P0 prerequisite

**Files:**

- Create: `src/types/storefront.ts`
- Create: `tests/types/storefront.test.ts`
- Modify: `src/features/online-store/types.ts`
- Modify: `docs/superpowers/specs/2026-09-06-online-store-design.md` chỉ để ghi amendment đã duyệt

**Tests first:**

- [ ] Định nghĩa strict schemas cho filter URL, cart mutation result, public store profile và promotion public payload.
- [ ] Test unknown keys, malformed numeric range, invalid sort, unsafe CTA URL và overlong public copy bị từ chối.
- [ ] Test defaults ổn định để URL không có query vẫn cho catalog hợp lệ.

**Implementation:**

- [ ] Export `catalogFilterSchema` với `q`, `category`, `inStock`, `minPrice`, `maxPrice`, `sort`.
- [ ] Export `CartMutationResult` phân biệt `added`, `incremented`, `capped`, `unavailable`.
- [ ] Export allowlisted public store profile/promotion types; không expose raw Setting/Prisma model.
- [ ] Ghi rõ phase này không bao gồm third-party ads, dynamic shipping fee, SMS/Zalo/email provider.

**Verification:**

- `pnpm vitest run tests/types/storefront.test.ts tests/types/online-order.test.ts`
- `pnpm typecheck`
- `pnpm exec prettier --check src/types/storefront.ts tests/types/storefront.test.ts docs/superpowers/specs/2026-09-06-online-store-design.md`

**Commit:** `feat(storefront): define experience contracts`

---

## Task 2: Cart mutation result và add-to-cart feedback

**Priority:** P0
**Depends on:** Task 1

**Files:**

- Modify: `src/features/online-store/cart-context.tsx`
- Create: `src/features/online-store/cart-feedback.tsx`
- Modify: `src/features/online-store/catalog-browser.tsx`
- Create/modify: `tests/components/online-store/cart-feedback.test.tsx`
- Modify: `tests/components/online-store/catalog-browser.test.tsx`

**Tests first:**

- [ ] Click “Thêm vào giỏ” trả feedback chứa tên sản phẩm và quantity hiện tại.
- [ ] Click liên tiếp increment đúng; khi đạt stock cap phải báo “Đã đạt số lượng tối đa”, không báo thành công giả.
- [ ] Sản phẩm unavailable không mutate và không phát success feedback.
- [ ] Live region công bố kết quả; toast có dismiss, auto-dismiss hợp lý và không cướp focus.
- [ ] Rapid clicks không tạo chồng vô hạn hoặc timer race.

**Implementation:**

- [ ] Đổi `add()` trả `CartMutationResult` dựa trên functional state update an toàn.
- [ ] Tạo một feedback host duy nhất trong cart provider hoặc storefront shell.
- [ ] Toast dùng icon vector, copy ngắn, link “Xem giỏ”; không dùng emoji.
- [ ] Product card có pressed/pending micro-state không làm layout shift.
- [ ] Cart count vẫn là nguồn bền vững; toast chỉ là phản hồi tức thời.

**Verification:**

- `pnpm vitest run tests/components/online-store/catalog-browser.test.tsx tests/components/online-store/cart-feedback.test.tsx`
- `pnpm lint -- src/features/online-store`
- `pnpm typecheck`

**Commit:** `feat(cart): announce add to cart results`

---

## Task 3: Cart drawer và quản lý giỏ trước checkout

**Priority:** P0
**Depends on:** Task 2

**Files:**

- Create: `src/features/online-store/cart-drawer.tsx`
- Modify: `src/features/online-store/store-header.tsx`
- Modify: `src/features/online-store/cart-context.tsx`
- Create: `tests/components/online-store/cart-drawer.test.tsx`
- Modify: `e2e/online-store.spec.ts`

**Tests first:**

- [ ] Header button mở drawer, hiển thị lines, quantity, subtotal và empty state.
- [ ] Tăng/giảm bị chặn bởi stock/minimum; xóa item cập nhật count/subtotal.
- [ ] Drawer trap focus, Escape đóng, trả focus về trigger và background không thao tác được.
- [ ] “Tiến hành đặt hàng” dẫn `/checkout`; cart rỗng vô hiệu CTA.
- [ ] Reload vẫn hydrate cart không mismatch.

**Implementation:**

- [ ] Thay link “Giỏ hàng” bằng button mở accessible drawer; vẫn hỗ trợ direct checkout link trong drawer.
- [ ] Render thumbnail/fallback, tên, unit price, line total, stepper và remove.
- [ ] Có disclaimer giá/tồn được xác nhận lại khi checkout.
- [ ] Mobile drawer full-height phù hợp safe area; desktop side sheet có max width.

**Verification:**

- `pnpm vitest run tests/components/online-store/cart-drawer.test.tsx`
- `pnpm test:e2e -- e2e/online-store.spec.ts --grep "cart drawer|cart persistence"`
- `pnpm typecheck`

**Commit:** `feat(cart): add storefront cart drawer`

---

## Task 4: Catalog filters, sorting và URL state

**Priority:** P0
**Depends on:** Task 1

**Files:**

- Create: `src/features/online-store/catalog-filters.tsx`
- Create: `src/features/online-store/filter-products.ts`
- Modify: `src/features/online-store/catalog-browser.tsx`
- Create: `tests/features/online-store/filter-products.test.ts`
- Modify: `tests/components/online-store/catalog-browser.test.tsx`
- Modify: `e2e/online-store.spec.ts`

**Tests first:**

- [ ] Search bỏ dấu kết hợp category, còn hàng và price range theo AND semantics.
- [ ] Sort hỗ trợ `relevance`, `price-asc`, `price-desc`, `name-asc`; deterministic tie-break bằng id/name.
- [ ] Invalid query được normalize về default, không crash và không echo unsafe value.
- [ ] Filter state đồng bộ URL bằng replace/push có debounce phù hợp; back/forward khôi phục state.
- [ ] Hiện result count, active filter chips và clear-all; empty state giữ ngữ cảnh filter.

**Implementation:**

- [ ] Tách pure filtering/sorting khỏi component.
- [ ] Desktop dùng filter bar/sidebar tùy viewport; mobile dùng sheet có nút “Áp dụng”.
- [ ] Giá input là integer VND, min không vượt max; category lấy từ catalog allowlist.
- [ ] Selected states dùng semantic attributes, focus visible và hit target tối thiểu.

**Verification:**

- `pnpm vitest run tests/features/online-store/filter-products.test.ts tests/components/online-store/catalog-browser.test.tsx`
- `pnpm test:e2e -- e2e/online-store.spec.ts --grep "catalog filter|catalog sort"`
- `pnpm typecheck`

**Commit:** `feat(storefront): add shareable catalog filters`

---

## Task 5: Structured delivery address foundation

**Priority:** P0
**Depends on:** Task 1

**Decision required before implementation:** Chọn nguồn danh mục hành chính Việt Nam. Ưu tiên dataset versioned trong repo hoặc provider server-side có cache/fallback; không gọi API không cam kết trực tiếp từ browser.

**Files:**

- Create: `src/lib/address/vietnam-address.ts`
- Create: `src/types/address.ts`
- Create: `src/features/online-store/address-fields.tsx`
- Modify: `src/features/online-store/checkout-form.tsx`
- Modify: `src/types/online-order.ts`
- Create: `tests/lib/address/vietnam-address.test.ts`
- Create/modify: `tests/components/online-store/checkout-form.test.tsx`

**Tests first:**

- [ ] Chọn tỉnh reset quận/phường cũ; chọn quận reset phường cũ.
- [ ] Delivery yêu cầu street, province, district và ward theo policy; pickup loại bỏ address khỏi payload.
- [ ] Server schema từ chối tổ hợp code/name không hợp lệ hoặc field giả.
- [ ] Keyboard/screen reader đọc đúng label, required, loading và lỗi.
- [ ] Dataset/provider unavailable có fallback nhập tay rõ ràng thay vì khóa checkout.

**Implementation:**

- [ ] Dùng code ổn định cho selection và snapshot tên vào Order sau validation.
- [ ] Address fields theo thứ tự tỉnh → quận/huyện → phường/xã → số nhà/đường.
- [ ] Hiển thị summary địa chỉ trước submit.
- [ ] Không log hoặc đưa địa chỉ vào analytics.

**Verification:**

- `pnpm vitest run tests/lib/address/vietnam-address.test.ts tests/components/online-store/checkout-form.test.tsx tests/types/online-order.test.ts`
- `pnpm typecheck`
- `pnpm lint -- src/lib/address src/features/online-store src/types`

**Commit:** `feat(checkout): add structured delivery address`

---

## Task 6: Store profile và pickup information

**Priority:** P1
**Depends on:** Task 1

**Files:**

- Modify: `src/server/settings/store-settings.ts`
- Modify: `src/app/admin/settings/actions.ts`
- Modify: `src/app/admin/settings/page.tsx`
- Create: `src/features/online-store/store-footer.tsx`
- Modify: `src/app/shop/page.tsx`
- Modify: `src/features/online-store/checkout-form.tsx`
- Create/modify focused settings tests

**Tests first:**

- [ ] Admin setting schema validate store name, hotline, address, hours và optional map URL.
- [ ] Public getter chỉ trả allowlisted profile, không raw setting rows.
- [ ] Pickup checkout hiển thị địa chỉ/giờ nhận hàng; thiếu cấu hình có fallback trung thực.
- [ ] Phone/map links chỉ render khi hợp lệ.

**Implementation:**

- [ ] Thêm store profile fields theo key namespaced, không nhét JSON không validate vào một setting.
- [ ] Admin form chia section “Thông tin cửa hàng online”, có save result feedback.
- [ ] Footer hiển thị contact, hours, address và links chính sách.
- [ ] Pickup selection hiển thị pickup card thay vì chỉ ẩn delivery fields.

**Verification:**

- `pnpm vitest run tests/server/settings tests/components/online-store`
- `pnpm typecheck`
- `pnpm test:e2e -- e2e/online-store.spec.ts --grep "store information|pickup address"`

**Commit:** `feat(storefront): publish store contact details`

---

## Task 7: Landing page composition

**Priority:** P1
**Depends on:** Tasks 4 and 6

**Files:**

- Create: `src/features/online-store/landing/hero-section.tsx`
- Create: `src/features/online-store/landing/category-section.tsx`
- Create: `src/features/online-store/landing/product-rail.tsx`
- Create: `src/features/online-store/landing/trust-section.tsx`
- Modify: `src/app/shop/page.tsx`
- Modify: `src/features/online-store/catalog-browser.tsx`
- Create: `tests/components/online-store/landing-page.test.tsx`
- Modify: `e2e/online-store.spec.ts`

**Tests first:**

- [ ] Landing có một H1, CTA tới catalog, featured categories và product rail fallback.
- [ ] Anchor “Mua ngay” focus/scroll đúng catalog và không bị sticky header che.
- [ ] Empty catalog/campaign vẫn render usable landing, không có section trống.
- [ ] Image giữ aspect ratio, alt đúng, responsive sizes hợp lý.

**Implementation:**

- [ ] Tách landing section server-rendered khỏi interactive catalog client leaf.
- [ ] Section order: announcement/promotion → hero → categories → featured products → benefits/trust → catalog → footer.
- [ ] Không dùng carousel auto-play trong baseline; nếu có carousel phải có pause và reduced-motion behavior.
- [ ] Copy không hứa giao hàng/đổi trả nếu admin chưa cấu hình policy tương ứng.

**Verification:**

- `pnpm vitest run tests/components/online-store/landing-page.test.tsx`
- `pnpm test:e2e -- e2e/online-store.spec.ts --grep "landing|featured"`
- Inspect 375px, 768px, 1440px light/dark

**Commit:** `feat(storefront): add merchandising landing page`

---

## Task 8: Promotion/campaign data model và public rendering

**Priority:** P1
**Depends on:** Task 7

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_storefront_promotions/migration.sql`
- Create: `src/server/storefront/promotions.ts`
- Create: `src/features/online-store/promotion-banner.tsx`
- Modify: `src/app/shop/page.tsx`
- Create: `tests/server/storefront/promotions.test.ts`
- Create: `tests/components/online-store/promotion-banner.test.tsx`

**Data model:**

- `StorefrontPromotion`: `id`, `title`, `body?`, `imageUrl?`, `ctaLabel?`, `ctaHref?`, `placement`, `startsAt?`, `endsAt?`, `priority`, `isActive`, timestamps.
- Index active window/placement/priority; no customer targeting or PII.

**Tests first:**

- [ ] Public query chỉ lấy active campaign trong UTC window, deterministic priority.
- [ ] Unsafe CTA scheme/path bị từ chối; expired/future campaign không render.
- [ ] Không có campaign trả empty state không chiếm layout.
- [ ] Banner image/copy/CTA có accessible names và contrast.

**Implementation:**

- [ ] Minimal Prisma select và Zod parse trước render.
- [ ] Hỗ trợ `announcement` và `hero` placement; giới hạn số item mỗi placement.
- [ ] Không thêm third-party scripts/pixels.

**Verification:**

- `pnpm db:generate`
- `pnpm vitest run tests/server/storefront/promotions.test.ts tests/components/online-store/promotion-banner.test.tsx`
- `pnpm typecheck`

**Commit:** `feat(promotions): add scheduled storefront campaigns`

---

## Task 9: Admin promotion management

**Priority:** P1
**Depends on:** Task 8

**Files:**

- Create: `src/app/admin/promotions/page.tsx`
- Create: `src/app/admin/promotions/actions.ts`
- Create: `src/features/admin-promotions/promotion-form.tsx`
- Modify: `src/features/admin-navigation/admin-nav.tsx`
- Create: `tests/server/storefront/admin-promotions.test.ts`
- Create: `e2e/admin-promotions.spec.ts`

**Tests first:**

- [ ] Direct action invocation không admin bị từ chối trước parse/write.
- [ ] Strict Zod validate schedule, placement, priority, copy lengths, image và CTA.
- [ ] Create/update/activate/deactivate revalidate `/shop` và admin list.
- [ ] Overlapping campaigns tuân thủ priority và max visible policy.

**Implementation:**

- [ ] Server Action gọi `requireAdminSession()` đầu tiên và audit create/update/toggle.
- [ ] Form có preview desktop/mobile, pending/error/success states.
- [ ] Dùng image pipeline hiện hữu hoặc module upload riêng có validation; không cho arbitrary HTML.

**Verification:**

- `pnpm vitest run tests/server/storefront/admin-promotions.test.ts`
- `pnpm test:e2e -- e2e/admin-promotions.spec.ts`
- `pnpm typecheck`

**Commit:** `feat(admin): manage storefront promotions`

---

## Task 10: Customer notification domain và atomic order events

**Priority:** P1
**Depends on:** Customer account/session hiện hữu; Tasks 1–5 ổn định

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_customer_notifications/migration.sql`
- Create: `src/server/customer-notifications/create-customer-notification.ts`
- Modify: `src/server/orders/create-order.ts`
- Modify: `src/server/orders/update-online-order.ts`
- Create: `tests/server/customer-notifications/customer-notifications.test.ts`
- Modify focused order transaction tests

**Data model:**

- `CustomerNotification`: `id`, `accountId`, `eventKey @unique`, `kind`, `title`, `body`, `orderId?`, `href`, `createdAt`, `readAt?`.
- Index `(accountId, readAt, createdAt)` và `(accountId, createdAt, id)`.

**Tests first:**

- [ ] Account order create/status events tạo tối đa một notification theo deterministic event key.
- [ ] Guest order không tạo customer inbox event khi chưa có owner.
- [ ] Claim thành công có thể tạo một ownership event theo policy, không copy guest token.
- [ ] Notification insert cùng transaction với status update; failure rollback mutation.
- [ ] Body không chứa full phone/address/note/token/receipt nonce.

**Implementation:**

- [ ] Tách hoàn toàn khỏi `AdminNotification` và admin read state.
- [ ] Event allowlist: order accepted, confirmed, preparing, ready, completed, cancelled, payment updated nếu thực sự hữu ích.
- [ ] Internal href chỉ tới ownership-protected account order route.
- [ ] Retention tích hợp policy hiện hữu.

**Verification:**

- `pnpm db:generate`
- `pnpm vitest run tests/server/customer-notifications tests/server/orders/update-online-order.test.ts tests/server/orders/order-access.test.ts`
- `pnpm typecheck`

**Commit:** `feat(customer-notifications): persist order updates atomically`

---

## Task 11: Customer notification inbox và unread feedback

**Priority:** P1
**Depends on:** Task 10

**Files:**

- Create: `src/types/customer-notification.ts`
- Create: `src/app/api/customer/notifications/route.ts`
- Create: `src/app/api/customer/notifications/read/route.ts`
- Create: `src/features/customer-notifications/notification-button.tsx`
- Create: `src/features/customer-notifications/notification-panel.tsx`
- Modify account layout/header composition
- Create focused API/component tests
- Modify: `e2e/customer-account.spec.ts`

**Tests first:**

- [ ] Anonymous, guest capability và admin cookie không đọc được customer inbox.
- [ ] Account A không đọc/mark notification của account B.
- [ ] Cursor pagination, limit cap, unread count và mark-one/mark-all cutoff hoạt động.
- [ ] Bell/panel có loading, empty, error, keyboard/focus và `99+` behavior.
- [ ] Click deep-link chỉ mở ownership-protected order.

**Implementation:**

- [ ] Route handler validate Zod và query bằng account predicate.
- [ ] Poll chỉ khi visible/focused hoặc dùng refresh-on-navigation phù hợp quy mô; không tạo polling ở từng page.
- [ ] Mark-read optimistic rồi reconcile; không lưu read state localStorage.
- [ ] Header shop chỉ hiện customer bell khi customer session hợp lệ; admin session không được xem như customer.

**Verification:**

- `pnpm vitest run tests/api/customer-notifications-route.test.ts tests/components/customer-notifications`
- `pnpm test:e2e -- e2e/customer-account.spec.ts --grep "notification"`
- `pnpm typecheck`

**Commit:** `feat(customer-account): add order notification inbox`

---

## Task 12: Policy pages, footer navigation và checkout reassurance

**Priority:** P2
**Depends on:** Task 6

**Files:**

- Create: `src/app/shop/delivery-policy/page.tsx`
- Create: `src/app/shop/payment-policy/page.tsx`
- Create: `src/app/shop/return-policy/page.tsx`
- Create: `src/app/shop/privacy/page.tsx`
- Modify: `src/features/online-store/store-footer.tsx`
- Modify: `src/features/online-store/checkout-form.tsx`
- Create policy content tests

**Tests first:**

- [ ] Footer links tồn tại và routes render semantic headings.
- [ ] Checkout chỉ hiển thị claim đúng với policy đã publish.
- [ ] Privacy page mô tả guest/account data, retention và contact channel phù hợp tài liệu security.
- [ ] Không copy boilerplate pháp lý sai hoặc hứa tự động hoàn tiền/chuyển phát chưa hỗ trợ.

**Implementation:**

- [ ] Viết copy tiếng Việt ngắn, trung thực, có owner phê duyệt.
- [ ] Thêm reassurance cạnh CTA checkout: giá được xác nhận, phương thức payment, contact support.
- [ ] Nếu policy cần admin-editable content, tạo model/versioning trong task riêng thay vì raw HTML setting.

**Verification:**

- `pnpm vitest run tests/components/online-store/policy-pages.test.tsx`
- `pnpm lint`
- `pnpm typecheck`

**Commit:** `feat(storefront): add customer policy pages`

---

## Task 13: SEO, metadata và privacy-safe funnel telemetry

**Priority:** P2
**Depends on:** Tasks 7–12

**Files:**

- Modify: `src/app/shop/page.tsx`
- Add metadata files/routes only as required by Next.js
- Modify: `instrumentation-client.ts`
- Create: `src/lib/analytics/storefront-events.ts`
- Create: `tests/config/storefront-metadata.test.ts`
- Create: `tests/lib/storefront-analytics.test.ts`

**Tests first:**

- [ ] Metadata có title/description/canonical/OG fallback, không chứa query/token/PII.
- [ ] Structured data chỉ dùng public store/product fields và valid absolute URLs.
- [ ] Analytics event schema allowlist chỉ nhận event name, category/product pseudonymous id, quantity bucket và UI placement cần thiết.
- [ ] Checkout form values, phone, address, note, guest URL, receipt nonce không bao giờ vào analytics.

**Implementation:**

- [ ] Thêm metadata server-side và public sitemap/robots policy phù hợp.
- [ ] Event tối thiểu: view catalog, apply filter, add result, open cart, begin checkout, checkout success/failure category.
- [ ] Không gửi raw search query nếu chưa có privacy review; ưu tiên length/result-count bucket.
- [ ] Không thêm cookie marketing hoặc third-party pixel trong task này.

**Verification:**

- `pnpm vitest run tests/config/storefront-metadata.test.ts tests/lib/storefront-analytics.test.ts tests/lib/log-redaction.test.ts`
- `pnpm build`
- Inspect rendered metadata and CSP headers

**Commit:** `feat(storefront): add safe discovery telemetry and metadata`

---

## Task 14: Full regression, visual QA và release delivery

**Priority:** Release gate
**Depends on:** Tasks 1–13

**Automated verification:**

- [ ] `pnpm exec prettier --check .`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e -- e2e/online-store.spec.ts`
- [ ] `pnpm test:e2e -- e2e/customer-account.spec.ts`
- [ ] `pnpm test:e2e -- e2e/admin-promotions.spec.ts`
- [ ] `pnpm test:e2e -- e2e/pos-cash-sale.spec.ts e2e/pos-offline-sale.spec.ts`
- [ ] `pnpm test:e2e`
- [ ] `git diff --check`

**Manual visual/accessibility matrix:**

- [ ] 375×667, 390×844, 768×1024, 1024×768, 1440×900.
- [ ] Light/dark mode; 200% zoom; keyboard-only; reduced motion.
- [ ] Landing no campaign, one campaign, long Vietnamese copy, missing image.
- [ ] Catalog 0/1/many categories, 0/1/many products, long names, out-of-stock mix.
- [ ] Add success, increment, stock cap, drawer empty/full, persisted reload.
- [ ] Address provider/dataset success và fallback; pickup configuration missing/present.
- [ ] Customer inbox empty/unread/error, cross-account access blocked.

**Security/privacy review:**

- [ ] Search logs, analytics payload, Sentry, URLs và HTML cho phone/address/note/session/guest/receipt tokens.
- [ ] Confirm promotion CTA cannot execute `javascript:` or escape internal allowlist policy.
- [ ] Confirm admin promotion actions authorize directly and customer notifications scope by account predicate.
- [ ] Confirm no third-party ad/tracking script and CSP remains restrictive.
- [ ] Confirm migrations apply to a copy of legacy database and POS semantics remain unchanged.

**Delivery:**

- [ ] Mỗi task có commit riêng đúng message đã định.
- [ ] Fix phát sinh có commit concern-specific riêng, không amend/squash concern khác.
- [ ] Working tree sạch, không secret/PII/database artifact.
- [ ] Branch chính xác `feat/pos-core`.
- [ ] Push không force: `git push origin feat/pos-core`.

---

## 5. Definition of Done

- Người dùng vào `/shop` hiểu ngay cửa hàng bán gì, có CTA rõ và thấy nội dung quảng bá đang hiệu lực.
- Admin có thể quản lý campaign và thông tin storefront mà không sửa code.
- Catalog hỗ trợ search bỏ dấu, category, còn hàng, khoảng giá và sort; state chia sẻ/back-forward được.
- Mỗi lần thêm giỏ đều có phản hồi chính xác; stock cap không bị báo thành công giả.
- Cart drawer cho xem/sửa/xóa trước checkout, state sống qua reload và accessible bằng keyboard.
- Delivery address có cấu trúc, validation server-authoritative và fallback khi nguồn địa chỉ unavailable.
- Pickup hiển thị địa chỉ/giờ cửa hàng thật; footer có contact và policy links.
- Customer đã đăng nhập nhận notification trạng thái đơn trong inbox riêng; admin/guest/account khác không truy cập được.
- Guest checkout vẫn hoạt động không cần account; không ép đăng ký để mua.
- Không có PII/token trong analytics, logs, campaign URL hoặc public metadata.
- Full Vitest, Playwright, lint, typecheck, build và migration regression đều xanh.
- Mỗi feature/fix là commit độc lập và nhánh `feat/pos-core` được push không force.

---

## 6. Hạng mục cố ý hoãn sau plan này

- Third-party ad network, retargeting pixel và consent management platform.
- SMS, Zalo, email/push notification provider.
- Dynamic shipping fee, carrier integration và live tracking.
- Coupon/promotion pricing engine; campaign trong plan chỉ là nội dung quảng bá, không tự thay đổi giá.
- Wishlist, review/rating, product variants, recommendation ML.
- Multiple saved addresses và address book synchronization.
- CMS rich-text/HTML tự do; tránh XSS và complexity khi chưa có nhu cầu được duyệt.
