# Cửa Hàng Online MVP — Design Spec

- **Ngày:** 2026-09-06
- **Owner:** minhanh01bg
- **Base:** POS hiện tại (Next.js 16 App Router, React 19, Prisma 6 + SQLite, Zod 4)
- **Trạng thái:** Approved for implementation; revised after auth/notification audit
- **Tiền đề:** `docs/superpowers/specs/2026-09-04-pos-store-design.md`, mục 12

## 1. Mục tiêu và phạm vi

Mở một storefront công khai để khách xem hàng, tìm kiếm, thêm giỏ và đặt hàng mà không cần tài khoản. Cùng một catalog, tồn kho và nghiệp vụ đơn hàng với POS; quản trị viên xử lý đơn online trong màn hình đơn hàng hiện có.

### MVP trong phạm vi

- Storefront công khai tại `/shop`, có danh mục, tìm kiếm bỏ dấu, trạng thái còn/hết hàng và ảnh sản phẩm.
- Giỏ hàng lưu trong `localStorage`, sửa số lượng/xóa dòng, tổng tiền phản hồi tức thì.
- Guest checkout: họ tên, điện thoại, ghi chú; nhận hàng bằng `delivery` hoặc `pickup`.
- Delivery yêu cầu địa chỉ; pickup không yêu cầu địa chỉ.
- Thanh toán `cod` hoặc `bank_transfer` thủ công; không xác nhận tự động.
- Trang xác nhận theo mã đơn sau khi đặt thành công.
- Server lấy lại tên, giá, đơn vị, trạng thái hoạt động và tồn kho từ database; client chỉ gửi `productId` và `quantity`.
- Admin lọc theo kênh, xem fulfillment/contact/address/payment và chuyển trạng thái xử lý hợp lệ.
- Loading, empty, error và unavailable states cho các tuyến công khai.
- Vitest cho contract/domain/component và Playwright cho happy path storefront → checkout → admin.

### Ngoài phạm vi

- Tài khoản khách, lịch sử mua, wishlist, đánh giá, coupon, giá vận chuyển động.
- Cổng thanh toán, webhook, tự động đối soát, tích hợp hãng vận chuyển.
- Theo dõi đơn công khai bằng token, email/SMS/Zalo, đa địa chỉ, bản đồ.
- SEO catalog nâng cao, CMS, biến thể sản phẩm, phân trang vô hạn.

## 2. Quyết định nghiệp vụ

| Chủ đề         | Quyết định MVP                                                                        | Lý do                                                  |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Danh tính      | Guest checkout, không tạo tài khoản                                                   | Ít ma sát nhất                                         |
| Thanh toán     | COD hoặc chuyển khoản thủ công                                                        | Không phụ thuộc dịch vụ ngoài                          |
| Fulfillment    | Delivery hoặc pickup                                                                  | Phủ hai cách giao nhận thực tế                         |
| Phí giao hàng  | `0` trong MVP                                                                         | Không có bảng vùng/phí đủ tin cậy                      |
| Tồn kho online | Từ chối nếu thiếu hàng                                                                | Khách chưa trả tại quầy; tránh nhận đơn không thể giao |
| Giữ tồn        | Trừ tồn ngay khi tạo đơn; hủy hoàn tồn theo cơ chế chung                              | Đơn online cạnh tranh cùng tồn với POS                 |
| Giá            | Database tại thời điểm checkout là nguồn thật                                         | Chống sửa payload/giá cũ                               |
| Customer       | Tạo snapshot trực tiếp trên Order; không buộc tạo `Customer`                          | Không trộn guest marketing với công nợ POS             |
| Trạng thái     | `new → confirmed → preparing → ready → completed`, có thể `cancelled` trước completed | Lifecycle nhỏ, dễ vận hành                             |
| Payment        | `cod` hoặc `bank_transfer`; trạng thái payment độc lập `pending/paid`                 | Xử lý đơn không đồng nghĩa đã nhận tiền                |

## 3. Kiến trúc

Storefront dùng **Server Components mặc định**. `src/app/shop/page.tsx` đọc catalog bằng module server và render shell. Chỉ search interaction, cart drawer/store và checkout form là client leaf nodes trong `src/features/online-store/`.

Route `POST /api/online/orders` là biên công khai duy nhất có ghi dữ liệu. Contract Zod dùng chung nằm trong `src/types/online-order.ts`. Handler parse JSON, gọi `createOnlineOrder`; domain truy vấn lại sản phẩm trong transaction, kiểm tra active/deleted/service/stock, dựng input tin cậy rồi dùng lõi tạo đơn.

`createOrder` tiếp tục là cổng ghi Order duy nhất nhưng nhận metadata online đã chuẩn hóa. POS giữ nguyên payload và hành vi cho tồn âm. Online preflight nghiêm ngặt và không nhận giá/tên/discount/payment amount từ trình duyệt.

## 4. Routing và kiểm soát truy cập

| Route                   | Access           | Vai trò                          |
| ----------------------- | ---------------- | -------------------------------- |
| `/`                     | Public           | Chuyển/CTA vào cửa hàng          |
| `/shop`                 | Public           | Catalog + search                 |
| `/checkout`             | Public           | Guest checkout                   |
| `/order-success/[code]` | Public           | Xác nhận tối thiểu, không lộ PII |
| `/api/online/orders`    | Public POST      | Tạo đơn theo contract hẹp        |
| `/pos`, `/admin/**`     | Session required | Vận hành nội bộ                  |
| `/api/**` khác          | Session required | API nội bộ                       |

Middleware dùng allowlist exact/prefix rõ ràng, không mở toàn bộ `/api/orders`. Public order endpoint giới hạn body, Zod strict, thông báo lỗi an toàn; không trả địa chỉ/số điện thoại ở response hoặc URL.

## 5. Dữ liệu

Mở rộng `Order` bằng các trường nullable để tương thích dữ liệu POS:

- `fulfillmentStatus`: `new|confirmed|preparing|ready|completed|cancelled` (online; POS để null).
- `fulfillmentType`: `delivery|pickup`.
- `paymentMethod`: `cod|bank_transfer` (snapshot dễ đọc cho admin).
- `contactName`, `contactPhone`.
- `deliveryAddress`, `deliveryWard`, `deliveryDistrict`, `deliveryProvince` (delivery only).
- `shippingFee` số nguyên VND, mặc định `0`.

`Order.status` tài chính hiện hữu vẫn dùng: online ban đầu `pending`; khi admin đánh dấu đã thu tiền thì `paid`; hủy dùng `cancelled`. `Payment` online được tạo với method `cash` cho COD hoặc `transfer`, `receivedAt=null`; amount bằng tổng server. Không đổi nghĩa đơn POS cũ.

## 6. Catalog, search và cart

- Chỉ công khai sản phẩm `isActive=true`, `deletedAt=null`, `isService=false`.
- Không công khai `costPrice`, aliases nội bộ không cần thiết hay dữ liệu quản trị.
- Search chạy client trên catalog đã render, dùng normalize/multi-token hiện hữu; URL query `q` có thể chia sẻ và progressive enhancement vẫn hiện catalog.
- Hết hàng vẫn có thể hiện để khách biết nhưng nút thêm bị vô hiệu.
- Cart chứa `{productId, name, unit, imageUrl, displayedPrice, quantity}` để render; mọi field ngoài id/quantity chỉ là cache hiển thị.
- Quantity phải hữu hạn, dương, giới hạn hợp lý; server kiểm tra tổng số dòng, quantity và tồn thực.

## 7. Checkout và lỗi nghiệp vụ

Form có label thật, lỗi theo field, focus vào lỗi đầu tiên, nút submit có pending state và chống double-submit bằng `clientId` UUID được giữ cho lần retry. Số điện thoại Việt Nam được normalize khoảng trắng/dấu chấm trước validate.

Server trả envelope ổn định:

- `201`: `{ data: { order: { code, total, status, fulfillmentStatus }, duplicated } }`.
- `400`: payload không hợp lệ.
- `409`: `OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, hoặc transition conflict; kèm message thân thiện và product ids, không kèm internals.
- `500`: message chung và correlation logging server-side.

Nếu giá thay đổi, server dùng giá mới và response thành công trả total thật; UI xác nhận số thật. Nếu hàng hết, giữ giỏ để khách sửa và tải lại catalog.

## 8. Admin lifecycle

Danh sách đơn có filter `channel=online|pos`, badge kênh và fulfillment. Chi tiết online hiển thị contact, delivery/pickup, địa chỉ, payment method, note và hành động kế tiếp.

Transition cho phép:

- `new → confirmed|cancelled`
- `confirmed → preparing|cancelled`
- `preparing → ready|cancelled`
- `ready → completed|cancelled`
- terminal: `completed`, `cancelled`

Action server validate Zod, đọc order hiện tại, chỉ cho `channel=online`, kiểm transition trong domain thuần, cập nhật atomically và revalidate. Hủy gọi nghiệp vụ hoàn tồn hiện hữu đúng một lần. Đánh dấu paid là hành động riêng, đặt `Payment.receivedAt` và `Order.status=paid`.

## 9. UI/UX, accessibility và responsive

- Mobile-first; catalog 2 cột trên điện thoại, tăng cột theo viewport; checkout một cột, order summary sticky ở desktop.
- Header có tên cửa hàng, cart count và CTA rõ ràng; màu/tokens dùng design system hiện tại.
- Keyboard operable, focus visible, hit target tối thiểu 44px, semantic headings, `aria-live` cho cập nhật cart/submit.
- Ảnh có alt theo tên; placeholder giữ layout; tiền định dạng VND.
- `loading.tsx` dùng skeleton đúng khung; `error.tsx` là client boundary có retry; empty search đưa cách xóa lọc.

## 10. Bảo mật và vận hành

- Không tin client price/name/total/channel/status/payment amount.
- Zod `.strict()`, giới hạn độ dài text, số dòng và quantity; trim/normalize ở boundary.
- Prisma select tối thiểu; không serialize model đầy đủ ra public.
- Idempotency bằng `clientId`; không log PII/payload đầy đủ.
- Không thêm secrets. Bank details lấy từ Setting hiện hữu và chỉ hiển thị ở confirmation nếu cấu hình đầy đủ; không đưa account data vào env/client bundle.
- SQLite transaction là nguồn nhất quán; online không cho tồn âm. Race-condition phải biến thành lỗi 409, không tạo đơn nửa chừng.

## 11. Kiểm thử

- **Vitest:** schema accept/reject; phone normalization; transition matrix; trusted line resolution; unavailable/out-of-stock/idempotency; cart persistence/totals; checkout conditional address; middleware public/private classification.
- **Playwright:** public storefront không login; search/add/cart/reload; delivery COD checkout; pickup transfer checkout; success; login admin, filter online, xem thông tin và chuyển trạng thái; regression POS route vẫn protected và POS checkout vẫn hoạt động.

## 12. Acceptance criteria

1. Khách chưa đăng nhập truy cập `/shop`, tìm và thêm sản phẩm còn hàng.
2. Cart sống qua reload và không cho quantity không hợp lệ.
3. Delivery bắt buộc địa chỉ; pickup không bắt buộc; contact luôn bắt buộc.
4. Payload giả giá/tên/total không ảnh hưởng Order; giá snapshot lấy từ DB.
5. Hai request cùng `clientId` tạo đúng một đơn.
6. Online thiếu tồn trả 409 và không ghi Order/StockMovement; POS vẫn giữ chính sách cho tồn âm.
7. Admin thấy đủ thông tin giao nhận, lọc online và chỉ thực hiện transition hợp lệ.
8. Hủy đơn hoàn tồn đúng một lần; completed/cancelled không chuyển tiếp.
9. Public allowlist không mở API nội bộ; response success không lộ PII.
10. `pnpm check`, `pnpm build` và bộ Playwright online vượt qua; không có secret trong diff.

## 13. Migration và tương thích

Tất cả field mới nullable/default-safe nên record POS hiện tại hợp lệ. Không đổi route `/api/orders` hoặc contract POS. Seed thêm dữ liệu online chỉ khi cần cho E2E. Prisma migration/push phải chạy trước deploy; rollback ứng dụng cũ vẫn đọc được các cột mới. Báo cáo doanh thu tiếp tục dựa trên `Order.status`; đơn online pending không tính là doanh thu paid cho đến khi xác nhận tiền theo quy ước hiện tại.

## 14. Audit hiện trạng cho customer auth và admin notifications

Audit tại base commit `83d5dedc04dac64b237e068ac03c15e833c83c9a` xác nhận:

- Auth hiện tại là auth nội bộ dùng một mật khẩu cửa hàng, cookie `pos_session` ký HMAC và middleware chỉ bảo vệ `/pos`, `/admin/**`, `/api/**` không nằm trong public allowlist. Token không mang user id hay role và không thể dùng làm danh tính khách hàng.
- `Customer` hiện là hồ sơ nghiệp vụ POS/công nợ (`name`, `phone`, quan hệ `orders`), chưa phải credential principal. Ghép tài khoản online vào model này sẽ làm lẫn quyền sở hữu đơn với quan hệ công nợ.
- `Order.customerId` hiện phục vụ khách công nợ POS; đơn online chỉ có contact snapshot và chưa có principal sở hữu. Endpoint tạo đơn là public và trang success theo code không phải cơ chế authorization.
- Checkout đã có `clientId` và lõi đơn dùng unique constraint để chống tạo trùng. Notification chưa có model, endpoint, badge hay navigation item; nếu phát notification sau transaction bằng side effect thì retry/crash có thể làm mất hoặc nhân đôi thông báo.
- Admin navigation là một client component tĩnh, phù hợp để gắn badge nhỏ nhưng không nên tự giữ nguồn dữ liệu notification trong local state.

Kết luận: triển khai customer identity/session và notification như hai bounded context mới. Không sửa nghĩa admin session, `Customer`, `Order.customerId` hoặc idempotency hiện hữu.

## 15. Customer identity và session tách hoàn toàn khỏi admin

### 15.1 Mô hình dữ liệu

Thêm các model độc lập:

- `CustomerAccount`: `id`, `phoneNormalized @unique`, `displayName`, `passwordHash`, `phoneVerifiedAt?`, `createdAt`, `updatedAt`, `disabledAt?`. Không chứa role admin và không tái sử dụng secret/mật khẩu cửa hàng.
- `CustomerSession`: `id`, `accountId`, `tokenHash @unique`, `expiresAt`, `createdAt`, `lastSeenAt?`, `revokedAt?`; index `(accountId, expiresAt)`. Chỉ digest SHA-256 của token ngẫu nhiên tối thiểu 256 bit được lưu DB.
- `Order.customerAccountId?` là ownership online, relation `onDelete: SetNull`, có index. Giữ nguyên `Order.customerId?` cho hồ sơ POS/công nợ và giữ contact fields trên Order làm snapshot giao nhận.
- `GuestOrderAccess`: `id`, `orderId @unique`, `tokenHash @unique`, `expiresAt`, `createdAt`, `revokedAt?`; token plaintext chỉ xuất hiện một lần trong URL trả về sau checkout. Không lưu plaintext và không dùng order code làm credential.

Không tự động hợp nhất `CustomerAccount` với `Customer` theo số điện thoại. Một tác vụ liên kết rõ ràng có kiểm chứng có thể được thiết kế sau; MVP tránh account takeover do số điện thoại nhập tay ở POS.

### 15.2 Cookie và biên authorization

- Giữ admin cookie `pos_session` và module auth hiện tại không đổi. Customer dùng cookie riêng `customer_session`, opaque, `HttpOnly`, `Secure` ở production, `SameSite=Lax`, `Path=/`, có hạn ngắn hợp lý và được kiểm tra bằng session row còn hạn/chưa revoke.
- Tách namespace: `/api/auth/**` và `/login` tiếp tục dành cho admin; customer dùng `/api/customer-auth/register|login|logout` và `/account/**`. Không có fallback kiểu “admin session cũng là customer session” hoặc ngược lại.
- Middleware chỉ phân loại route thô. Mọi server page, route handler và server action customer phải gọi helper `requireCustomerSession`; mọi truy vấn order phải có predicate ownership `customerAccountId = session.accountId`, không fetch theo id/code rồi mới so sánh trong application.
- Password dùng primitive chuyên dụng có salt và work factor được version hóa; rate-limit register/login theo IP và phone, trả lỗi đăng nhập chung, rotate session khi login, revoke server-side khi logout/disable. Không log password, session token, guest token hoặc PII đầy đủ.
- CSRF dựa trên `SameSite=Lax` cộng kiểm tra Origin cho mutation cookie-authenticated; mọi input tiếp tục qua Zod strict.

### 15.3 Guest checkout, ownership và guest link

- Guest checkout vẫn là luồng mặc định. Khi request có customer session hợp lệ, server gắn `customerAccountId`; client không được gửi account id.
- Trong cùng transaction tạo Order, server tạo đúng một `GuestOrderAccess` cho đơn guest. Retry cùng `clientId` trả lại kết quả logical của đơn cũ nhưng không tạo token/access row thứ hai. API chỉ có thể phát lại plaintext token nếu thiết kế một cơ chế sealed response/recovery an toàn; mặc định UI phải giữ response thành công đầu tiên và không hứa có thể lấy lại token đã mất.
- Route guest là `/orders/guest/[token]`; server hash token rồi truy vấn access row còn hạn/chưa revoke cùng Order. URL không chứa phone, code hoặc database id. Response/page dùng `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` và không nhúng analytics payload chứa token.
- Account order history chỉ hiển thị order có `customerAccountId` thuộc session. Guest link cấp quyền xem đúng một đơn, không tạo customer session và không tự động claim ownership.
- Claim guest order là mutation riêng: yêu cầu customer session, guest token hợp lệ và bước xác minh contact phone phù hợp với `phoneNormalized` đã verified; update `customerAccountId` atomically nếu đang null rồi revoke guest access. Nếu chưa có phone verification đáng tin cậy thì hoãn claim thay vì dựa vào chuỗi phone nhập tay.
- Dữ liệu chi tiết/PII không còn được public qua `/order-success/[code]`. Route này chỉ là receipt tối thiểu; chi tiết order dùng customer ownership hoặc guest token.

## 16. Persistent idempotent admin notifications

### 16.1 Mô hình và quy tắc ghi

Thêm `AdminNotification`:

- `id`, `eventKey @unique`, `kind`, `title`, `body`, `entityType`, `entityId`, `href`, `createdAt`, `readAt?`.
- Index `(readAt, createdAt)` cho unread badge và `(createdAt, id)` cho cursor ổn định. Nội dung là snapshot vận hành tối thiểu, không chứa địa chỉ hay số điện thoại đầy đủ.
- Event tạo đơn online dùng deterministic key `online-order:{orderId}:created`. Các event tương lai phải định nghĩa version/event name trong key, ví dụ `online-order:{orderId}:status:ready:v1`.

Notification “đơn online mới” phải được insert trong **cùng Prisma transaction** tạo Order và stock movements. Unique `eventKey` là hàng rào idempotency ở DB; retry `clientId`, concurrent request hoặc retry transaction đều cho một Order và tối đa một notification. Không dùng fire-and-forget sau response và không dựa vào in-memory event emitter. Nếu việc tạo notification thất bại, transaction tạo order thất bại để không có đơn online vô hình với admin.

### 16.2 Đọc, polling và actions

- API nội bộ `GET /api/admin/notifications?cursor=&limit=` trả envelope Zod-typed gồm items mới nhất, `nextCursor` và `unreadCount`; chỉ admin session hiện hữu được phép truy cập. Cursor dùng cặp `(createdAt,id)`, limit bị chặn và response `private, no-store`.
- Client provider duy nhất dưới admin layout poll mỗi 15 giây khi tab visible, dừng khi hidden, refetch ngay khi focus/online và dùng request deduplication. Không poll từ từng nav item/page và không dùng SSE/WebSocket cho quy mô SQLite MVP.
- Bell/badge nằm trong admin shell/navigation; badge hiển thị `99+`, panel có loading/empty/error, keyboard/focus semantics và link `href` nội bộ đã lưu. Không render PII nhạy cảm trong toast.
- Mutation `POST /api/admin/notifications/read` nhận strict union `{ id } | { allBefore }`. Mark-one dùng `updateMany where {id, readAt:null}`; mark-all dùng cutoff do server xác nhận để không vô tình đọc các item đến sau thao tác. Mutation idempotent, kiểm tra Origin và trả unread count mới.
- Click item điều hướng tới entity và mark-read theo best effort có retry; thất bại mark-read không chặn navigation. Xóa Order không cascade notification; snapshot và `href` có thể dẫn tới not-found an toàn để giữ audit trail.

### 16.3 Retention và consistency

- MVP giữ notification 90 ngày; cleanup theo batch trong maintenance command/cron khi có hạ tầng, không nằm trên request path.
- SQLite là nguồn thật duy nhất. Badge sau mutation được cập nhật optimistic rồi reconcile ở lần poll; không dùng `localStorage` làm read state.
- Nếu sau này có nhiều admin principal, thay `readAt` toàn cục bằng `AdminNotificationReceipt(notificationId, adminId, readAt)`; auth hiện tại chỉ có một principal cửa hàng nên không giả lập per-user read state lúc này.

## 17. Acceptance criteria bổ sung

1. Admin session không truy cập được account history với tư cách customer; customer session không mở `/admin`, `/pos` hoặc API nội bộ.
2. Session customer revoke/expire bị từ chối server-side; token plaintext không có trong DB/log/client-readable cookie.
3. Account chỉ đọc được Order có `customerAccountId` của chính mình; thay id/code không làm lộ đơn khác.
4. Guest token chỉ đọc đúng một Order, có expiry/revoke, được lưu dạng hash và không suy ra từ order code.
5. Guest checkout retry cùng `clientId` tạo một Order, một guest access row và một notification event.
6. Tạo Order online và notification là atomic; unique `eventKey` chống duplicate dưới retry/concurrency.
7. Admin badge tồn tại qua restart/browser khác, poll không chạy khi tab hidden và mark-read lặp lại vẫn an toàn.
8. Mark-all dùng cutoff, không đánh dấu notification mới đến sau thao tác; API notification không public và không trả PII đầy đủ.
9. Migration giữ nguyên dữ liệu/semantics của `Customer`, `Order.customerId`, admin `pos_session` và đơn POS cũ.
