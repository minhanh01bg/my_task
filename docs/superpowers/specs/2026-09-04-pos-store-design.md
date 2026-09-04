# POS Bán Hàng Tại Quầy — Design Spec

- **Ngày:** 2026-09-04
- **Owner:** minhanh01bg
- **Base:** `nextjs-with-agent` (Next 16 + React 19 + TS strict + Tailwind 4 + shadcn + React Query + Zod)
- **Trạng thái:** Draft, chờ review
- **Thay thế:** `docs/superpowers/specs/2026-05-19-personal-task-app-design.md` (superseded — repo chuyển hướng sang POS)

## 1. Mục đích & Phạm vi

Web bán hàng tại quầy cho một cửa hàng tạp hoá tổng hợp: hàng tiêu dùng, giày dép, và phụ tùng xe máy (kèm dịch vụ sửa xe). Cửa hàng hiện không có phần mềm quản lý nào.

**Trọng tâm số một: tính tiền tại chỗ.** Cửa hàng chưa dán mã vạch, nên **gõ tìm sản phẩm là đường vào duy nhất của mọi giao dịch** — tốc độ và độ chính xác của tìm kiếm quyết định trải nghiệm của cả hệ thống.

### Trong phạm vi (Spec 1)

- Màn hình bán hàng (POS) toàn màn hình, tối ưu bàn phím
- Tìm kiếm sản phẩm tức thì: bỏ dấu, nhiều từ rời, từ khoá phụ, mã nội bộ
- Duyệt theo danh mục (bổ trợ cho gõ tìm)
- Giỏ hàng: sửa số lượng (số thực), đè đơn giá, giảm giá theo dòng
- Dòng dịch vụ (tiền công sửa xe) không trừ tồn kho
- Thanh toán: tiền mặt, chuyển khoản VietQR (QR động, đối soát thủ công), ghi nợ, và trả kết hợp
- Giữ đơn / mở lại đơn đang giữ
- Offline-first: PWA, cache danh mục vào IndexedDB, hàng đợi đơn chờ đồng bộ
- Tab quản lý (`/admin`): sản phẩm, danh mục, đơn hàng, công nợ, báo cáo gọn, cài đặt
- Trừ tồn kho khi bán; `StockMovement` ghi mọi biến động ngay từ đầu

### Ngoài phạm vi (Spec 1)

- **Kho & mua hàng đầy đủ** → Spec 2: nhà cung cấp, phiếu nhập, giá vốn bình quân, báo cáo lãi, kiểm kê. Model dữ liệu ở Spec 1 đã chuẩn bị sẵn cho Spec 2 (`costPrice`, `StockMovement`) nên Spec 2 chỉ thêm màn hình và loại phiếu, **không phải viết lại dữ liệu**.
- **Đơn hàng online** → spec riêng. Spec 1 chỉ chừa sẵn chỗ cắm (mục 12).
- Mã vạch / máy quét — thêm sau, cắm vào đúng đường tìm theo `sku`
- In hoá đơn giấy — **không làm** (đã chốt với user)
- Nhiều chi nhánh, phân quyền nhiều nhân viên
- Đồng bộ hai chiều local-first cho dữ liệu quản trị

## 2. Quyết định đã chốt

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Vị trí trong repo | POS **thay thế** spec personal task app | User không làm task app nữa |
| Database | **SQLite + Prisma** | Một cửa hàng, dữ liệu nhỏ, vận hành đơn giản |
| Chuyển khoản | **VietQR động, đối soát thủ công** | Không cần hợp đồng ngân hàng / API bên thứ ba |
| Offline | **Server cloud + hàng đợi offline (PWA)** | Bán được khi rớt mạng, xem doanh thu từ xa, sẵn đường cho đơn online |
| Kiến trúc | **Hướng 1 — Server-first, offline là lớp phòng thủ** | Nhiều máy là ngoại lệ (user: "ít khi 2 máy"), không đáng trả giá cho merge hai chiều |
| Xung đột tồn kho | **Luôn nhận đơn, cho tồn âm, gắn cảnh báo** | Không bao giờ từ chối đơn đã thu tiền khách |
| Giá | Giá niêm yết + **sửa được trên đơn** + **dòng dịch vụ** | Tạp hoá có mặc cả; tiền công sửa xe ghi chung hoá đơn |
| Tìm kiếm | Bỏ dấu + nhiều từ rời + **từ khoá phụ** + mã nội bộ | Phụ tùng xe máy gọi theo tên lóng |
| Ngôn ngữ | Route/code **tiếng Anh**, giao diện **tiếng Việt** | Nhất quán code, người dùng là người Việt |
| Đơn vị tính | Số lượng **số thực** (kg, mét), tiền **số nguyên VND** | Có bán cân lẻ và dây theo mét |

## 3. Kiến trúc tổng thể

Ba tầng với ranh giới rõ ràng:

**Tầng server** — Next.js App Router (Server Components + Route Handlers), Prisma + SQLite, chạy cloud. Nguồn sự thật duy nhất. Toàn bộ nghiệp vụ (tính tiền, trừ tồn, ghi biến động kho) nằm trong `src/server/`. Client **không bao giờ** quyết định số tiền cuối cùng.

**Tầng máy bán** — PWA, Client Component + IndexedDB. Mở ca tải toàn bộ danh mục về máy. Tìm kiếm, lọc danh mục, giỏ hàng chạy hoàn toàn trong máy, không gọi mạng. Chỉ chạm mạng khi bấm thanh toán.

**Tầng đồng bộ** — module riêng `src/lib/sync/`, đứng giữa hai tầng trên. Nắm hàng đợi đơn chờ, thử lại khi có mạng, làm mới danh mục.

> **Ranh giới then chốt:** màn hình bán **không biết** mình đang online hay offline. Nó gọi `submitOrder(cart)` và nhận kết quả; module đồng bộ lo phần còn lại. Nhờ vậy test UI không cần giả lập mạng, và test đồng bộ không cần dựng UI.

### Routing

| Route | Mô tả | Offline |
|---|---|---|
| `/pos` | Màn hình bán hàng, toàn màn hình, không sidebar | Có (service worker cache) |
| `/admin/products` | Quản lý sản phẩm | Không |
| `/admin/categories` | Danh mục | Không |
| `/admin/orders` | Đơn hàng | Không |
| `/admin/debts` | Công nợ | Không |
| `/admin/reports` | Báo cáo | Không |
| `/admin/settings` | Cài đặt (ngân hàng, tên cửa hàng) | Không |
| `/api/*` | Route handlers, payload validate bằng Zod | — |

`/pos` tách riêng vì là ứng dụng khác hẳn về giao diện: không menu, không gì thừa, tối ưu thao tác nhanh. `/admin` là trang quản trị bình thường.

### Cấu trúc thư mục

```txt
src/
  app/
    pos/page.tsx                 # màn hình bán (client shell)
    admin/
      layout.tsx                 # sidebar quản trị
      products/page.tsx
      categories/page.tsx
      orders/page.tsx
      debts/page.tsx
      reports/page.tsx
      settings/page.tsx
    api/
      catalog/route.ts           # GET danh mục đầy đủ cho máy bán
      orders/route.ts            # POST tạo đơn (idempotent theo clientId)
      products/...
  server/
    db/prisma.ts                 # Prisma singleton (HMR-safe)
    orders/create-order.ts       # nghiệp vụ tạo đơn — dùng chung POS & online
    products/...
    stock/apply-movement.ts
  lib/
    search/                      # chuẩn hoá + khớp + xếp hạng (thuần, testable)
    pricing/                     # tính tiền dùng chung client & server
    sync/                        # hàng đợi IndexedDB + retry
    money.ts                     # số nguyên VND, làm tròn
  components/
    pos/                         # search-box, cart, payment-dialog, ...
    admin/
```

## 4. Tìm kiếm sản phẩm (phần cốt lõi)

### Chuẩn hoá lúc lưu, không phải lúc tìm

Mỗi sản phẩm khi lưu sinh sẵn `searchText` = `name + aliases + sku + tên danh mục`, bỏ dấu, viết thường.

```
"Nhớt Castrol Power1 0.8L"  →  "nhot castrol power1 0.8l"
```

Làm một lần lúc lưu → lúc gõ không tốn gì.

### Khớp nhiều từ rời, không cần đúng thứ tự

Query tách theo khoảng trắng, sản phẩm phải chứa **tất cả** các từ:

```
"sen wave" → ["sen", "wave"] → khớp "Bộ nhông sên dĩa xe Wave"
```

Người dùng gõ thiếu và sai thứ tự vẫn ra đúng.

### Xếp hạng

1. Trùng `sku` (mã nội bộ) → lên đầu tuyệt đối
2. Khớp đầu tên sản phẩm
3. Khớp đầu một từ bất kỳ trong tên
4. Khớp giữa từ
5. Cùng bậc → món **bán chạy hơn** xếp trên

Tiêu chí 5 quan trọng trong thực tế: gõ `coca` phải ra chai 390ml (bán chạy nhất) trước lon 320ml.

### Từ khoá phụ (`aliases`)

Ô "tên gọi khác" nhập tự do trên mỗi sản phẩm. `"Bugi NGK C7HSA"` gắn thêm `bugi wave, bugi thuong`. **Không có trường này thì phụ tùng xe máy gần như không tìm nổi.**

### Chạy trong máy

Toàn bộ sản phẩm nằm trong bộ nhớ, quét tuyến tính. Vài nghìn món quét dưới 1ms — nhanh hơn mọi lần gọi mạng. Không cần thư viện fuzzy search, không cần index phức tạp.

**Cố ý không làm fuzzy/Levenshtein**: hay ra kết quả rác và làm chậm. Bỏ dấu + nhiều từ + aliases đã phủ gần hết nhu cầu thật.

### Thao tác

Ô tìm kiếm **luôn giữ con trỏ**. Gõ là ra, `↑`/`↓` chọn, `Enter` thêm vào giỏ, ô tự xoá sẵn sàng cho món tiếp. Bán cả đơn không cần rời bàn phím.

## 5. Màn hình bán hàng & tính tiền

### Bố cục

Hai cột. **Trái:** ô tìm kiếm + kết quả + lưới danh mục để bấm chọn. **Phải:** giỏ hàng và tổng tiền, luôn nhìn thấy, không bao giờ cuộn mất.

Màn hình dùng cả ngày → chữ to, nút to, khoảng cách thoáng; bấm bằng ngón tay trên tablet phải trúng.

### Giỏ hàng

Mỗi dòng sửa được tại chỗ:

- **Số lượng** — số thực, hiển thị kèm đơn vị: `2.5 mét × 15.000 = 37.500`
- **Đơn giá** — đè giá niêm yết; luôn lưu `originalPrice` để tra lại
- **Giảm giá** — theo từng dòng

**Dòng dịch vụ** thêm bằng nút riêng: gõ tên ("Công thay nhớt") và số tiền. Không trừ tồn, không cần tồn tại trong danh mục.

### Tính tiền chạy hai lần, cố ý

Client tính để hiện ngay cho khách xem. Server tính lại từ đầu khi nhận đơn, và **con số server là con số thật**. Client sửa dữ liệu trong trình duyệt cũng không đổi được hoá đơn.

Dùng **chung một hàm** (`src/lib/pricing/`) ở cả hai bên → hai kết quả luôn khớp. Có test khẳng định điều này.

### Tiền tệ

Tiền lưu bằng **số nguyên VND**, không số thập phân — tránh sai số dấu phẩy động (lỗi kinh điển của app bán hàng). Số lượng là số thực; nhân xong **làm tròn về đồng**.

### Giữ đơn

Khách bỏ quên ví, hoặc đang tính dở thì cần tính nhanh cho khách sửa xe — bấm "Giữ đơn", mở đơn mới, quay lại chọn tiếp. Đơn giữ nằm ở máy (IndexedDB), chưa lên server.

### Phím tắt

`F2` vào ô tìm · `F4` thanh toán · `F8` giữ đơn · `Esc` huỷ dòng. Ai quen bán rất nhanh; ai không quen vẫn bấm chuột bình thường.

### Sau thanh toán

Không in giấy. Hiện màn hình xác nhận: tổng tiền, tiền khách đưa, **tiền thối lại (chữ rất to)**, rồi về đơn mới. Đơn lưu đầy đủ trên server, tra lại trong `/admin/orders`.

## 6. Thanh toán

### Tiền mặt

Gõ số tiền khách đưa → hiện tiền thối. Có nút bấm nhanh mệnh giá hay gặp (50k, 100k, 200k, 500k) và nút "đúng số tiền". Đây là đường mặc định, ít thao tác nhất.

### Chuyển khoản VietQR

Hiện **QR động** đã gắn sẵn số tiền và nội dung chuyển khoản là mã đơn (VD `DH1042`). Khách quét → tiền vào đúng số, nội dung đúng mã đơn, không phải gõ tay.

QR sinh **ngay trong máy** theo chuẩn EMVCo/VietQR, không gọi API bên ngoài → **mất mạng vẫn hiện được QR**, khách vẫn chuyển khoản được.

Thông tin ngân hàng (mã ngân hàng, số tài khoản, tên chủ tài khoản) khai một lần ở `/admin/settings`. Chưa cấu hình → nút chuyển khoản báo "chưa cấu hình tài khoản".

### Đối soát thủ công

Thu ngân nhìn app ngân hàng thấy tiền về → bấm "Đã nhận tiền" → đơn sang trạng thái đã thanh toán. Khách đi rồi mà chưa thấy tiền → đơn giữ trạng thái **chờ thanh toán** để kiểm lại sau, không mất dấu.

### Trả kết hợp

Một phần tiền mặt, phần còn lại chuyển khoản. Mô hình dữ liệu là **danh sách `Payment`** trên mỗi đơn, không phải một trường "phương thức" → trả kết hợp là chuyện tự nhiên, và thêm ví điện tử sau này không phải sửa cấu trúc.

### Ghi nợ

Khách quen mua chịu. Đơn ghi trạng thái nợ kèm khách hàng; trả sau thì ghi nhận khoản trả.

`Customer` giữ tối giản: **tên + số điện thoại**. Lúc bán, ô "khách nợ" gõ tên là gợi ý khách cũ; không có thì tạo mới ngay tại chỗ, một thao tác.

Trang `/admin/debts`: ai đang nợ, nợ bao nhiêu, nợ từ đơn nào, nút "khách trả tiền".

**Không làm:** lịch sử mua hàng theo khách, tích điểm, hạn mức nợ.

## 7. Mô hình dữ liệu

```prisma
Category      id, name, sortOrder

Product       id, name, sku?, categoryId, unit, price, costPrice,
              stock, aliases, searchText, imageUrl?, isActive, isService,
              soldCount            // phục vụ xếp hạng tìm kiếm

Customer      id, name, phone?

Order         id, code, channel, status, subtotal, discount, total,
              customerId?, note, createdAt, clientId, syncedAt

OrderItem     orderId, productId?, nameSnapshot, unitPrice,
              originalPrice, quantity, discount, lineTotal, isService

Payment       orderId, method (cash|transfer|debt), amount,
              receivedAt?, note

StockMovement productId, delta, reason (sale|adjust|purchase|count),
              refId, createdAt

Setting       key, value           // thông tin ngân hàng, tên cửa hàng
```

### Bốn quyết định đáng nói

**`nameSnapshot` + `originalPrice` trên từng dòng đơn.** Đơn lưu tên và giá *tại thời điểm bán*. Đổi tên hàng hay tăng giá sau này, đơn cũ vẫn hiện đúng cái đã bán với giá đã bán. Không có thì báo cáo cũ sai hết.

**`StockMovement` ghi mọi biến động ngay từ Spec 1.** `Product.stock` chỉ là số tổng cho nhanh; sự thật nằm ở chuỗi biến động. Đây là chỗ Spec 2 cắm vào — thêm `reason` mới là xong.

**`clientId` trên `Order` — chống trùng đơn.** Máy bán sinh mã duy nhất **trước khi** gửi. Mạng chập chờn, đơn gửi hai lần, server thấy `clientId` đã tồn tại thì bỏ qua lần thứ hai. Không có trường này là có ngày thu tiền một lần mà ghi sổ hai lần.

**`isService`** phân biệt dòng tiền công với hàng hoá — không trừ tồn, không cần giá vốn.

### Kiểu số

- Tiền (`price`, `total`, `amount`, ...): **số nguyên VND**
- Số lượng và tồn (`quantity`, `stock`, `delta`): **số thực** (có cân lẻ, dây theo mét)

## 8. Tab quản lý (`/admin`)

Server Components thuần, không offline.

| Trang | Nội dung |
|---|---|
| **Sản phẩm** | Bảng có tìm kiếm; thêm/sửa/xoá mềm; sửa nhanh giá và tồn ngay trên dòng. Form gồm cả "tên gọi khác" và giá vốn. |
| **Danh mục** | CRUD + sắp thứ tự — thứ tự này chính là thứ tự lưới bấm chọn ở `/pos`. |
| **Đơn hàng** | Danh sách, lọc theo ngày và trạng thái, xem chi tiết, huỷ đơn (huỷ thì hoàn tồn kho). |
| **Công nợ** | Ai nợ bao nhiêu, từ đơn nào, ghi nhận trả tiền. |
| **Báo cáo** | Doanh thu theo ngày, hàng bán chạy, cảnh báo sắp hết hàng. Cố ý gọn — **báo cáo lãi để Spec 2**. |
| **Cài đặt** | Tên cửa hàng, thông tin ngân hàng cho VietQR. |

## 9. Đăng nhập & bảo mật

Server chạy trên cloud, nên `/pos` và `/admin` **phải** được bảo vệ — dữ liệu doanh thu và công nợ không được để công khai.

Mức tối giản đủ dùng cho một cửa hàng: **một mật khẩu chung cho cửa hàng**, lưu bằng hash trong biến môi trường; đăng nhập thành công thì đặt cookie phiên dài hạn (30 ngày). Máy ở quầy đăng nhập một lần rồi dùng mãi.

- Middleware chặn toàn bộ `/pos`, `/admin`, và `/api/*` trừ route đăng nhập
- Phiên phải sống lâu và **không tự hết hạn giữa ca bán** — đăng xuất giữa lúc có khách là lỗi nghiêm trọng
- Cookie `httpOnly`, `secure`, `sameSite=lax`

**Không làm ở Spec 1:** nhiều tài khoản nhân viên, phân quyền, nhật ký thao tác theo người. Một cửa hàng, người nhà bán — chưa cần. Nếu sau này cần, thêm bảng `User` và gắn `userId` vào `Order` là đủ.

## 10. Xử lý lỗi

> **Nguyên tắc: không bao giờ chặn việc bán.**

| Tình huống | Xử lý |
|---|---|
| Gửi đơn thất bại | Vào hàng đợi, bán tiếp, hiện "N đơn chờ đồng bộ". **Không** hiện lỗi đỏ doạ người dùng. |
| Có mạng lại | Hàng đợi thử lại với giãn cách tăng dần; thử ngay khi trình duyệt báo online. |
| Đơn lỗi nghiệp vụ (sản phẩm đã xoá) | Giữ lại, đánh dấu, hiện trong `/admin` để xử lý tay. **Không tự ý bỏ đơn.** |
| Tồn âm | Nhận đơn bình thường, gắn cảnh báo. |
| Danh mục cache cũ (>24h) | Nhắc làm mới, nhưng **vẫn cho bán**. |
| Chưa cấu hình ngân hàng | Nút chuyển khoản báo "chưa cấu hình tài khoản". |

## 11. Kiểm thử

**Vitest** cho logic thuần, **Playwright** cho luồng.

- **Tìm kiếm** (test kỹ nhất — đây là trái tim hệ thống): bỏ dấu, nhiều từ rời, thứ tự xếp hạng, aliases, khớp `sku`.
- **Tính tiền**: giảm giá dòng, đè giá, số lượng lẻ, làm tròn, dòng dịch vụ. Có test khẳng định **client và server ra cùng một con số**.
- **Hàng đợi**: gửi lỗi thì xếp hàng; có mạng thì đẩy; gửi hai lần **không trùng đơn** (`clientId`).
- **E2E**: bán một đơn tiền mặt hoàn chỉnh; bán khi offline rồi bật mạng và kiểm tra đơn lên server.

## 12. Chuẩn bị cho đơn online (chưa xây)

Spec 1 chỉ làm phần *không làm bây giờ sẽ phải đập đi*:

- `Order.channel` (`pos` | `online`) có sẵn → thêm sau không phải sửa dữ liệu cũ
- Nghiệp vụ tạo đơn (`src/server/orders/create-order.ts`) **tách khỏi UI POS** → đơn online dùng lại đúng hàm đó
- `Product.isActive` và `imageUrl` có sẵn để hiện lên trang khách

**Không làm bây giờ:** trang khách, giỏ hàng online, giao hàng. Đó là spec riêng.

## 13. Lộ trình

| Spec | Nội dung | Thứ tự |
|---|---|---|
| **Spec 1** (tài liệu này) | POS + tìm kiếm + thanh toán + offline + quản lý sản phẩm | Làm trước |
| **Spec 2** | Kho & mua hàng: nhà cung cấp, phiếu nhập, giá vốn bình quân, báo cáo lãi, kiểm kê | Ngay sau |
| **Spec 3** | Đơn hàng online cho khách | Sau nữa |
