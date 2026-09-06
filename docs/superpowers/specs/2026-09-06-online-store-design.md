# Cửa Hàng Online MVP — Design Spec

- **Ngày:** 2026-09-06
- **Owner:** minhanh01bg
- **Base:** POS hiện tại (Next.js 16 App Router, React 19, Prisma 6 + SQLite, Zod 4)
- **Trạng thái:** Approved for implementation
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
