# Đánh giá bảo mật sản phẩm Online Store

**Ngày khảo sát:** 07/09/2026  
**Phạm vi:** storefront công khai, checkout/đặt hàng online, tài khoản khách hàng, quyền xem đơn, quy trình đơn online trong admin và thông báo admin.  
**Ngoài phạm vi:** các chức năng POS, công nợ, quản trị sản phẩm/danh mục và hạ tầng triển khai, trừ khi chúng tạo thành ranh giới tin cậy trực tiếp cho Online Store.

## 1. Tóm tắt điều hành

Hệ thống đã có nền tảng bảo mật đúng hướng: tách cookie admin và khách hàng, băm mật khẩu bằng `scrypt`, chỉ lưu digest của session/capability token, ràng buộc truy vấn đơn theo chủ sở hữu, hợp đồng Zod strict cho checkout, giá bán được lấy lại từ cơ sở dữ liệu và thông báo được ghi cùng transaction tạo đơn. Các API thông báo admin cũng kiểm tra session tại route thay vì chỉ dựa vào middleware.

Tuy nhiên, sản phẩm **chưa nên được xem là production-ready về bảo mật**. Hai rủi ro cần xử lý trước khi phát hành công khai là:

1. API checkout công khai chưa có chống lạm dụng/rate limit và giới hạn body có thể bị vượt qua.
2. Kiểm tra rồi trừ tồn kho không nguyên tử, nên các request đồng thời có thể bán vượt tồn kho.

Ngoài ra còn các điểm mức cao/trung bình: rate limit đăng nhập chỉ nằm trong bộ nhớ và tin trực tiếp `x-forwarded-for`; admin session tồn tại 30 ngày nhưng không thể thu hồi; server actions quản lý đơn không tự kiểm tra quyền; kiểm tra Origin chấp nhận request không có Origin; mã đơn tuần tự cho phép dò trang xác nhận công khai; chưa có CSP và chưa có cơ chế redaction log tập trung.

### Đánh giá tổng thể

| Miền                         | Đánh giá                                        |
| ---------------------------- | ----------------------------------------------- |
| Xác thực khách hàng          | Khá, cần gia cố rate limit và chống enumeration |
| Phân tách admin/khách hàng   | Tốt ở cấp cookie và helper                      |
| Phân quyền xem đơn           | Tốt về predicate sở hữu và guest capability     |
| Tính toàn vẹn checkout       | Tốt về giá, chưa an toàn khi cạnh tranh tồn kho |
| Chống lạm dụng API công khai | Yếu                                             |
| Bảo vệ thao tác admin        | Trung bình, chưa thống nhất trust boundary      |
| Bảo vệ PII/token             | Khá ở DB, còn rủi ro URL/log/cache vận hành     |
| Security headers             | Khá, thiếu CSP                                  |
| Mức sẵn sàng phát hành       | Chưa đạt                                        |

## 2. Kiến trúc và ranh giới tin cậy đang có

### 2.1 Bề mặt công khai

Danh sách public được khai báo tường minh, trong đó API tạo đơn chỉ mở đúng `/api/online/orders`, không mở wildcard `/api/online/*`. Các trang storefront, checkout, xác nhận đơn, account auth và guest capability cũng được phân loại riêng.

Middleware chỉ áp dụng cho `/pos`, `/admin` và `/api`; các trang account tự bảo vệ tại data boundary. Cách tổ chức này phù hợp nếu mọi trang/API nhạy cảm luôn gọi helper xác thực tại server.

### 2.2 Hai miền xác thực độc lập

- Admin dùng cookie `pos_session`, token HMAC và secret môi trường.
- Khách hàng dùng cookie `customer_session`, opaque token ngẫu nhiên 256-bit và chỉ lưu SHA-256 digest trong DB.
- Customer session bị từ chối khi hết hạn, bị revoke hoặc tài khoản bị disable.
- Login khách hàng revoke session đang hoạt động trước khi tạo session mới, giảm số token sống đồng thời.

Đây là quyết định kiến trúc tốt: dữ liệu `Customer` của POS không bị dùng làm principal đăng nhập và cookie khách hàng không thể thay cookie admin chỉ bằng tên.

### 2.3 Quyền truy cập đơn hàng

- Lịch sử và chi tiết tài khoản truy vấn bằng cả `customerAccountId` và `channel=online`.
- Guest access dùng token 256-bit; DB chỉ lưu digest, có thời hạn và `revokedAt`.
- Trang guest là dynamic, `noindex` và đặt referrer policy `no-referrer` ở metadata.
- Mã đơn không cấp quyền vào trang chi tiết; trang success công khai chỉ chọn `code`, `total`, `paymentMethod`.

### 2.4 Ranh giới checkout

- Body được parse bằng Zod strict.
- Client chỉ gửi product id, quantity và thông tin fulfillment/contact; không gửi giá, tên, tổng tiền, trạng thái hoặc account id.
- Server truy vấn lại sản phẩm, kiểm tra active/deleted/service, dùng giá/tên/unit trong DB và tự tính tổng.
- Account ownership được suy ra từ cookie server-side.
- Order, order items, payment, stock movement, guest capability và notification được tạo trong một Prisma transaction.

## 3. Các kiểm soát đang làm tốt

### SEC-POS-01 — Hợp đồng checkout giảm mass assignment

**Trạng thái:** Tốt.

Schema dùng `.strict()`, giới hạn 1–50 dòng, quantity hữu hạn/tối đa 999, chuẩn hóa số điện thoại, giới hạn độ dài trường và bắt địa chỉ khi giao hàng. Điều này ngăn client chèn `price`, `status`, `channel`, `customerAccountId` hoặc field ngoài hợp đồng.

### SEC-POS-02 — Giá và dữ liệu sản phẩm có thẩm quyền ở server

**Trạng thái:** Tốt.

Server bỏ qua mọi display cache từ client, tải lại tên/giá/unit/tồn kho và tính tổng. Đây là kiểm soát chính chống sửa giá trên trình duyệt.

### SEC-POS-03 — Mật khẩu và customer session

**Trạng thái:** Tốt, có điểm cần gia cố.

- Mật khẩu dùng `scrypt` với salt ngẫu nhiên, format có version và so sánh constant-time.
- Session token có entropy 256-bit, chỉ lưu digest.
- Cookie có `HttpOnly`, `SameSite=Lax`, `Secure` trong production, path `/` và thời hạn 7 ngày.
- Response login không trả password hash, phone hoặc token trong JSON.

### SEC-POS-04 — Chống IDOR cho account order

**Trạng thái:** Tốt.

Điều kiện sở hữu nằm ngay trong Prisma predicate thay vì tải đơn theo id rồi mới so sánh trong application code. Account A không thể đọc đơn account B chỉ bằng cách đổi URL.

### SEC-POS-05 — Guest capability

**Trạng thái:** Tốt về thiết kế mật mã.

Capability token đủ dài, không lưu plaintext, có expiry/revoke và liên kết unique một-một với order. Response tạo đơn đặt `private, no-store` và `Referrer-Policy: no-referrer` khi trả capability URL.

### SEC-POS-06 — Thông báo admin nguyên tử và tối thiểu PII

**Trạng thái:** Tốt.

Notification được tạo trong cùng transaction với order và stock. `eventKey` deterministic/unique hỗ trợ idempotency. Snapshot chỉ chứa code và tổng tiền, không chứa số điện thoại hoặc địa chỉ; href được tạo nội bộ từ order id.

### SEC-POS-07 — API notification tự xác thực

**Trạng thái:** Tốt.

Cả API đọc và đánh dấu notification đều gọi kiểm tra admin session ở route. API mutation còn parse union Zod strict và kiểm tra Origin. Response dùng `private, no-store`.

### SEC-POS-08 — Security headers nền

**Trạng thái:** Khá.

Ứng dụng đã tắt `X-Powered-By` và đặt HSTS, frame denial, MIME sniffing protection, referrer policy và permissions policy cho toàn bộ route.

## 4. Phát hiện rủi ro

### SEC-POS-H01 — API checkout công khai chưa chống lạm dụng

**Mức độ:** Cao  
**Tác động:** spam đơn, giữ/trừ tồn kho hàng loạt, tạo notification rác, tăng DB/CPU/storage, gây từ chối dịch vụ và làm sai vận hành cửa hàng.

`POST /api/online/orders` không có rate limit, challenge, quota theo IP/session/thiết bị hoặc cơ chế phát hiện burst. `clientId` chỉ chống tạo trùng khi cùng id; bot có thể sinh UUID mới cho từng request.

Giới hạn hiện tại dựa trên `Content-Length`. Request chunked hoặc cố tình bỏ header sẽ có giá trị 0 rồi vẫn được đọc toàn bộ bằng `request.json()`, nên giới hạn 64 KB không phải hard limit.

**Khuyến nghị bắt buộc:**

1. Áp dụng distributed rate limiter ở edge/gateway hoặc shared store, có quota theo IP đã chuẩn hóa và fingerprint rủi ro; không dùng memory cục bộ.
2. Giới hạn request body ở reverse proxy/platform và đọc stream có hard byte cap nếu nền tảng không đảm bảo.
3. Thêm velocity rule theo phone, product và subnet; cảnh báo khi tăng đột biến.
4. Cân nhắc Turnstile/CAPTCHA theo risk score, không bắt mọi khách hợp lệ ngay từ đầu.
5. Trả `Retry-After` khi 429 và không tiết lộ rule chi tiết.

### SEC-POS-H02 — Race condition có thể bán vượt tồn kho

**Mức độ:** Cao  
**Tác động:** hai checkout đồng thời cùng vượt qua kiểm tra tồn kho, sau đó đều decrement; tồn kho âm và cả hai đơn được chấp nhận.

Sản phẩm và tồn kho được đọc/kiểm tra trước transaction. Bên trong transaction, code dùng decrement không điều kiện. Transaction bảo đảm các write cùng thành công hoặc rollback, nhưng không bảo đảm điều kiện `stock >= quantity` vẫn đúng tại thời điểm update.

**Khuyến nghị bắt buộc:**

1. Thực hiện conditional update trong transaction với điều kiện `stock >= requestedQuantity`, kiểm tra affected row count bằng 1.
2. Với nhiều dòng, nếu bất kỳ update nào thất bại thì rollback toàn bộ và trả `OUT_OF_STOCK`.
3. Viết test cạnh tranh thực sự với hai request mua phần tồn cuối.
4. Không thay đổi chính sách tồn âm của POS; conditional stock guard chỉ áp dụng channel online.

### SEC-POS-H03 — Rate limit customer auth có thể bị vượt qua

**Mức độ:** Cao khi public Internet; Trung bình nếu chỉ triển khai nội bộ.  
**Tác động:** brute force, credential stuffing, account/phone spraying và tiêu thụ CPU qua `scrypt`.

Rate limit hiện lưu trong `Map` của process nên mất khi restart, không chia sẻ giữa instance/serverless invocation và không có cleanup chủ động. Khóa là hash của IP + phone, vì vậy kẻ tấn công có thể đổi phone để password-spray hoặc đổi header/IP để brute force một account. Hàm lấy IP tin trực tiếp giá trị đầu tiên của `x-forwarded-for`; nếu proxy không ghi đè header, client có thể spoof.

Endpoint admin login hiện không có rate limit, trong khi admin password mở quyền vào toàn bộ quản trị Online Store.

**Khuyến nghị bắt buộc trước public launch:**

1. Chuyển limiter sang gateway hoặc shared durable store.
2. Chỉ tin forwarding headers từ trusted proxy; ưu tiên header IP do platform xác thực.
3. Kết hợp bucket theo account/phone, IP, subnet và global velocity.
4. Rate limit cả admin login; thêm delay/backoff và cảnh báo brute force.
5. Theo dõi login success/failure bằng dữ liệu đã pseudonymize, không ghi password/phone plaintext.

### SEC-POS-M01 — Admin session dài hạn, không thể thu hồi

**Mức độ:** Trung bình  
**Tác động:** cookie admin bị đánh cắp có thể dùng đến 30 ngày; đổi password/secret policy hoặc “logout” ở một thiết bị không revoke riêng token đó.

Admin token là HMAC stateless chỉ chứa thời điểm phát hành, không có session id, principal id, role, token version hoặc server-side revoke state. Mô hình một mật khẩu cửa hàng cũng không có attribution/audit theo nhân viên.

**Khuyến nghị:** chuyển admin sang opaque DB-backed session tương tự customer session; thời hạn ngắn hơn, idle timeout, revoke/logout, rotation sau login và identity/role riêng nếu có nhiều nhân viên. Tối thiểu phải rate limit login và có cơ chế xoay `SESSION_SECRET` khi sự cố.

### SEC-POS-M02 — Server actions quản lý đơn chưa tự xác thực

**Mức độ:** Trung bình  
**Tác động:** trust boundary phụ thuộc vào middleware và cơ chế Server Actions của Next.js; một thay đổi matcher/routing về sau có thể biến thành authorization bypass.

Các action chuyển trạng thái, đánh dấu đã trả và hủy đơn gọi domain mutation trực tiếp, không gọi `requireAdminSession`/`hasAdminSession`. Middleware hiện bảo vệ URL `/admin`, nhưng chính codebase đã xác định middleware chỉ là defense-in-depth đối với API notification.

**Khuyến nghị:** tạo helper `requireAdminSession()` dùng được trong Server Component/Server Action và gọi ở đầu mọi admin mutation. Tiếp tục giữ middleware như lớp ngoài, không dùng middleware làm trust boundary duy nhất.

### SEC-POS-M03 — Origin validation chấp nhận thiếu Origin

**Mức độ:** Trung bình  
**Tác động:** kiểm soát CSRF không fail-closed; request cookie-authenticated thiếu Origin vẫn được chấp nhận.

`SameSite=Lax` giảm đáng kể CSRF từ browser hiện đại, nhưng không thay thế hoàn toàn kiểm tra mutation. Helper hiện trả `true` nếu không có header Origin.

**Khuyến nghị:** với browser mutation dùng cookie, yêu cầu Origin hợp lệ trong production; nếu cần hỗ trợ client không gửi Origin, xác minh `Sec-Fetch-Site` và CSRF token theo luồng cụ thể. Chuẩn hóa helper dùng chung cho mọi API/server mutation nhạy cảm.

### SEC-POS-M04 — Mã đơn tuần tự cho phép enumeration trang success

**Mức độ:** Trung bình về riêng tư  
**Tác động:** người ngoài có thể dò mã kiểu `DH0001`, xác định đơn tồn tại và xem tổng tiền/phương thức thanh toán.

Trang success cố ý chỉ trả receipt tối thiểu và không trả PII/dòng hàng; vì vậy đây không phải IDOR chi tiết. Tuy nhiên tổng tiền và phương thức thanh toán vẫn là dữ liệu giao dịch và mã tuần tự dễ đoán.

**Khuyến nghị:** không dùng code tuần tự làm public lookup capability. Dùng receipt nonce ngẫu nhiên, hoặc chỉ hiển thị dữ liệu sau account/guest capability. Nếu vẫn giữ trang công khai, giảm response xuống thông báo chung và áp dụng rate limit chống enumeration.

### SEC-POS-M05 — Vòng đời guest token trong URL chưa được kiểm soát đầy đủ

**Mức độ:** Trung bình  
**Tác động:** token có thể xuất hiện trong browser history, ảnh chụp màn hình, access log reverse proxy/APM hoặc bị người dùng chia sẻ nhầm; ai có token có toàn quyền đọc chi tiết đơn đến khi hết hạn/revoke.

Thiết kế hash-at-rest và `no-referrer` là tốt. Tuy nhiên chưa thấy kiểm soát tại lớp deployment để redact path token khỏi access logs/analytics. Thời hạn capability là 30 ngày và không có UI revoke/claim trong phạm vi code hiện tại.

**Khuyến nghị:** redact route segment token trong CDN/APM logs; không gửi URL này vào analytics; đặt response HTML rõ ràng `private, no-store`; cân nhắc token một lần để đổi sang cookie scope hẹp hoặc thời hạn ngắn hơn; revoke sau khi claim vào account.

### SEC-POS-M06 — Idempotency chưa hoàn chỉnh dưới cạnh tranh

**Mức độ:** Trung bình  
**Tác động:** hai request cùng `clientId` có thể cùng không thấy order, một request thất bại unique constraint và trả 500; retry guest không nhận lại capability URL vì plaintext token không thể phục hồi.

Idempotency tuần tự hoạt động, nhưng read-before-create ở ngoài transaction không xử lý tốt concurrent race. Với guest order, response duplicate cố ý không trả access URL mới, có thể làm khách mất đường xem đơn nếu response đầu bị thất lạc.

**Khuyến nghị:** bắt unique conflict và đọc lại kết quả theo `clientId`; thiết kế idempotency record/response replay an toàn. Không lưu plaintext capability, nhưng có thể bind pending checkout với HttpOnly temporary cookie hoặc thiết kế capability exchange để retry vẫn sử dụng được mà không sinh quyền thứ hai.

### SEC-POS-M07 — Chưa có Content Security Policy

**Mức độ:** Trung bình  
**Tác động:** nếu xuất hiện XSS trong component, dependency hoặc nội dung động tương lai, browser không có lớp hạn chế script/connect/frame bổ sung; guest token và customer data có thể bị lấy cắp.

React escaping và `HttpOnly` đang giảm rủi ro, nhưng storefront có input, ảnh và nhiều client component nên CSP là defense-in-depth quan trọng.

**Khuyến nghị:** triển khai CSP theo nonce/hash, bắt đầu ở Report-Only; tối thiểu kiểm soát `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-ancestors`, `base-uri`, `form-action` và `object-src`. Đồng bộ với Sentry/analytics/image hosts thực tế.

### SEC-POS-L01 — Đăng ký có thể lộ trạng thái tài khoản

**Mức độ:** Thấp–Trung bình  
**Tác động:** attacker phân biệt phone đã đăng ký qua status 409 so với 201.

Message lỗi là generic nhưng status/behavior vẫn khác. Với hệ thống dùng số điện thoại, đây là dữ liệu cá nhân.

**Khuyến nghị:** chọn policy sản phẩm rõ ràng. Nếu ưu tiên chống enumeration, trả response gần tương đương và hướng người dùng sang recovery/login; giữ rate limit mạnh. Nếu chấp nhận UX hiện tại, ghi nhận đây là rủi ro đã chấp nhận.

### SEC-POS-L02 — Logging chưa có redaction tập trung

**Mức độ:** Thấp–Trung bình  
**Tác động:** lập trình viên có thể vô tình truyền request, token, phone/address hoặc Prisma error chứa dữ liệu nhạy cảm vào `meta`.

Logger hiện chuyển `meta` trực tiếp sang console. Route checkout đang chỉ log error và không chủ động log payload, đây là điểm tốt; tuy nhiên không có allowlist/redaction bảo vệ về hệ thống.

**Khuyến nghị:** logger chỉ nhận metadata có schema/allowlist; tự động redact cookie, authorization, token, phone, address, password và URL guest capability; cấu hình Sentry `beforeSend` tương ứng; đặt retention và quyền truy cập log.

### SEC-POS-L03 — PII trong SQLite không có bảo vệ cấp ứng dụng

**Mức độ:** Thấp–Trung bình, phụ thuộc hạ tầng  
**Tác động:** file DB hoặc backup bị đọc sẽ lộ phone, tên, địa chỉ, ghi chú và lịch sử đơn; password/session token vẫn là hash nhưng PII là plaintext.

**Khuyến nghị:** mã hóa disk/volume và backup, giới hạn quyền file/service account, không đưa DB vào artifact/repository, thiết lập retention/xóa dữ liệu, kiểm soát backup restore và audit truy cập. Chỉ cân nhắc field-level encryption nếu threat model yêu cầu quản trị hạ tầng không được đọc PII.

### SEC-POS-L04 — Quy trình đăng ký không nguyên tử

**Mức độ:** Thấp  
**Tác động:** concurrent register có thể tạo unique conflict/500; account có thể được tạo nhưng session creation thất bại, gây UX không nhất quán.

**Khuyến nghị:** xử lý unique conflict thành response an toàn; cân nhắc transaction cho account + session hoặc flow retry có chủ đích.

## 5. Ma trận ưu tiên xử lý

### P0 — Chặn phát hành public

- [ ] Distributed anti-abuse/rate limit và hard body limit cho checkout.
- [ ] Conditional stock decrement nguyên tử trong transaction.
- [ ] Distributed/trusted-IP rate limit cho customer auth và admin login.
- [ ] Chạy migration/Prisma generate và làm xanh typecheck/test/build; trạng thái hiện tại chưa vượt quality gate.

### P1 — Hoàn thành trước production GA

- [ ] Bổ sung authorization trực tiếp trong mọi admin Server Action.
- [ ] Làm Origin/CSRF validation fail-closed cho cookie-authenticated mutation.
- [ ] Hoàn thiện concurrent idempotency và cơ chế lấy lại quyền guest sau retry.
- [ ] Chống enumeration qua trang success hoặc thay lookup bằng nonce/capability.
- [ ] Redact guest token/PII trong logs, analytics và APM.
- [ ] Thêm CSP ở Report-Only rồi enforcement.

### P2 — Gia cố sau khi luồng chính ổn định

- [ ] Chuyển admin sang session có thể revoke, có identity/role/audit.
- [ ] Quyết định policy chống phone enumeration ở register.
- [ ] Hoàn thiện retention, backup encryption và quyền truy cập PII.
- [ ] Thêm UI/flow revoke hoặc claim guest capability.

## 6. Kiểm thử bảo mật cần có

### Authentication

- Brute force/spraying theo một IP nhiều phone, nhiều IP một phone và nhiều instance.
- Header spoofing với `x-forwarded-for` nhiều giá trị/giá trị lỗi.
- Admin cookie không xác thực customer; customer cookie không xác thực admin.
- Session expired, revoked, disabled; session fixation và rotation sau login.
- Concurrent register cùng phone và lỗi session write.

### Authorization và privacy

- Account A không list/read account B ở query layer và qua route thực tế.
- Order code đơn thuần không mở được PII/items.
- Guest token sai, hết hạn, revoke; token không xuất hiện trong response/log/referrer/analytics.
- Anonymous/customer session không gọi được admin API và Server Actions.
- Dò hàng loạt `/order-success/{code}` bị chặn hoặc không lộ metadata giao dịch.

### Checkout integrity và abuse

- Unknown keys, price/name/total/status/account id từ client đều bị từ chối.
- Body không Content-Length/chunked vượt 64 KB bị chặn trước parse JSON.
- Burst UUID mới nhận 429 mà không tạo order/notification/stock movement.
- Hai request tranh phần tồn cuối: chính xác một thành công, một `OUT_OF_STOCK`.
- Hai request cùng `clientId`: một order, một stock decrement, một notification và response retry nhất quán.
- Notification write thất bại phải rollback order và stock.

### Browser controls

- Cross-site form/fetch, thiếu Origin, Origin malformed và `Sec-Fetch-Site: cross-site` bị từ chối cho mutation có cookie.
- CSP report không có violation ngoài allowlist dự kiến.
- Trang account/guest/API nhạy cảm có `private, no-store`; guest page có `no-referrer`, `noindex`.

## 7. Bằng chứng mã nguồn đã khảo sát

| Chủ đề                               | Tệp                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public route classification          | `src/lib/auth/public-paths.ts`                                                                                                                                             |
| Middleware admin/API                 | `src/middleware.ts`                                                                                                                                                        |
| Admin session                        | `src/server/auth/session.ts`, `src/server/auth/require-admin-session.ts`                                                                                                   |
| Customer password/session/rate limit | `src/server/customer-auth/password.ts`, `src/server/customer-auth/session.ts`, `src/server/customer-auth/rate-limit.ts`                                                    |
| Customer auth API                    | `src/app/api/customer-auth/*/route.ts`                                                                                                                                     |
| Checkout contract/API/core           | `src/types/online-order.ts`, `src/app/api/online/orders/route.ts`, `src/server/orders/create-online-order.ts`, `src/server/orders/create-order.ts`                         |
| Order ownership/capability           | `src/server/orders/order-access.ts`, `src/app/account/orders/**`, `src/app/orders/guest/[token]/page.tsx`                                                                  |
| Public receipt                       | `src/app/order-success/[code]/page.tsx`                                                                                                                                    |
| Admin order mutations                | `src/app/admin/orders/actions.ts`                                                                                                                                          |
| Notification auth/integrity          | `src/app/api/admin/notifications/**`, `src/server/notifications/create-admin-notification.ts`                                                                              |
| Security headers                     | `next.config.ts`                                                                                                                                                           |
| Data model                           | `prisma/schema.prisma`                                                                                                                                                     |
| Logging                              | `src/lib/logger.ts`                                                                                                                                                        |
| Security-focused tests               | `tests/server/customer-auth/**`, `tests/server/orders/order-access.test.ts`, `tests/api/admin-notifications-route.test.ts`, `tests/lib/auth/customer-public-paths.test.ts` |

## 8. Giới hạn của đánh giá

Đây là static review trên code hiện tại, không phải penetration test. Chưa xác minh cấu hình reverse proxy/CDN, TLS termination, firewall, file permission, backup, secret manager, Sentry/analytics production, dependency CVE, deployed headers hay hành vi nhiều instance. Quality gate hiện cũng đang thất bại ở typecheck do Prisma Client/dependencies chưa đồng bộ, nên các nhận định “đã có test” không đồng nghĩa toàn bộ test suite đang xanh.

## 9. Tiêu chí bảo mật để coi Online Store hoàn thành

Online Store chỉ nên được đánh dấu hoàn thành khi toàn bộ P0 và P1 được xử lý hoặc có risk acceptance bằng văn bản; migration/schema/client đồng bộ; `pnpm check`, build và E2E xanh; kiểm thử cạnh tranh tồn kho/idempotency xanh; không có token/PII trong log hoặc cache; và các route admin/customer/guest được kiểm thử authorization ở data boundary thực tế.
