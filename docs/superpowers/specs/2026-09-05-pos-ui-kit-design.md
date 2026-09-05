# POS UI Kit & Ảnh sản phẩm — Design

**Ngày:** 2026-09-05
**Trạng thái:** Đã duyệt, chờ plan
**Kế thừa:** `docs/superpowers/specs/2026-09-04-pos-store-design.md` (Spec 1)

## 1. Vấn đề

shadcn/ui đã được cài (commit `3f7ac4a`) và các màn hình đã được restyle
(`27cfcbc`, `b7334b4`), nhưng giao diện vẫn nhợt nhạt. Nguyên nhân gốc:
`components.json` khai `"baseColor": "neutral"` và `src/app/globals.css`
định nghĩa **toàn bộ token với chroma = 0** — kể cả `--primary`
(`oklch(0.205 0 0)`) và cả 5 màu chart. shadcn đang chạy trên một bảng màu
không màu, nên không có điểm nhấn và không phân biệt được trạng thái.

Ngoài ra, Spec 1 mục 5 đặt tiêu chí thẩm mỹ cho `/pos`:

> Màn hình dùng cả ngày → chữ to, nút to, khoảng cách thoáng; bấm bằng ngón
> tay trên tablet phải trúng.

Code hiện tại lệch tiêu chí này ở nhiều chỗ (xem §3).

Và `Product.imageUrl` đã tồn tại trong schema từ Plan 1 nhưng chưa được dùng
ở bất kỳ đâu: không có trong `SearchableProduct`, không có trong
`GET /api/catalog`, không có trong form admin, không chỗ nào render.

## 2. Mục tiêu

Dựng một **UI kit dùng lại được** đặt tại `src/components/kit/`, rồi áp dụng
nó cho phần sản phẩm trước, sau đó lan ra phần còn lại. Kit phải bê sang dự
án khác được bằng cách copy thư mục `kit/` cộng khối token trong
`globals.css`.

Đồng thời làm sống `imageUrl`: chủ cửa hàng upload được ảnh sản phẩm, ảnh
hiện ở lưới POS và bảng admin, và **mất mạng vẫn hiện được ảnh**.

### Không nằm trong phạm vi

- Bố cục 2 cột của `/pos` — giữ nguyên
- Nghiệp vụ tính tiền, `createOrder`, hàng đợi offline, phím tắt — không đụng
- Prisma schema — **không đổi**, `imageUrl` đã có sẵn
- Storybook hoặc bất kỳ hạ tầng component-doc nào ngoài một trang gallery thường

## 3. Chỗ code đang lệch Spec 1

| Chỗ                                 | Hiện tại                                                                                    | Spec 1 đòi                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Chip danh mục (`category-grid.tsx`) | `px-4 py-2 text-base` ≈ cao 40px                                                            | nút to, bấm ngón tay phải trúng (≥44px)    |
| Thẻ sản phẩm (`category-grid.tsx`)  | `p-3`, không `min-h` → cao thấp so le; `ring-foreground/10` viền mờ                         | nút to, thoáng, nhìn ra được               |
| Kết quả tìm (`product-search.tsx`)  | `<ul>` trần không khung; dòng active chỉ khác nền `bg-accent`                               | rõ đang chọn dòng nào khi gõ nhanh cả ngày |
| Tồn kho (cả hai)                    | "Còn 0 cái" chữ xám, y hệt "Còn 50 cái"                                                     | thu ngân phải liếc là thấy                 |
| `/admin/products`                   | form luôn xoè chiếm nửa màn trên; bảng không hover; không empty state; báo "Đã lưu" chữ xám | trang quản trị thường, cần gọn             |

## 4. Kiến trúc — sáu tầng

Tầng dưới không biết gì về tầng trên.

### Tầng 1 — Design tokens (`src/app/globals.css`)

Thay bảng xám bằng bảng có màu, định nghĩa cho cả light và dark:

```
--primary:   oklch(0.55 0.19 255)   /* xanh dương */
--success:   oklch(0.62 0.17 150)   /* còn hàng */
--warning:   oklch(0.75 0.16  75)   /* sắp hết */
--info:      oklch(0.60 0.14 230)
--touch-target: 2.75rem             /* 44px */
```

Thang chữ display cho "tiền thối lại (chữ rất to)" ở Spec 1 mục 5.
`components.json` giữ nguyên `baseColor: "neutral"`. Trường này chỉ nhận một
tập cố định do registry quy định (`gray`, `neutral`, `slate`, `stone`, `zinc`),
không nhận màu thật, và CLI chỉ đọc nó lúc `init` chứ không phải lúc `add` —
nên khối token ở trên là nguồn sự thật duy nhất về màu.

Mỗi token màu mới đi kèm một token `-foreground` tương ứng, và phải đạt tương
phản WCAG AA (≥4.5:1 cho chữ thường) trên cả hai theme.

### Tầng 2 — Primitive còn thiếu (`src/components/ui/`)

Thêm từ registry shadcn, giữ nguyên 10 primitive đã có: **`collapsible`**, và
chỉ nó. Bản nháp trước liệt thêm `separator`, `skeleton`, `sonner`, `popover`
nhưng không component nào của §4.3 cần tới — thêm vào là vi phạm YAGNI. Khi nào
có component thật sự cần thì thêm lúc đó.

### Tầng 3 — Kit (`src/components/kit/`)

Thuần trình bày. **Không import Prisma, không import store, không gọi
Server Action.** Nhận dữ liệu qua props, phát sự kiện ra ngoài qua callback.
Đây là ranh giới khiến kit copy sang dự án khác được.

| Component                  | Việc                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- |
| `Money`                    | Định dạng VND qua `formatVnd`, `tabular-nums`, size `sm`/`base`/`display`         |
| `StockBadge`               | 3 mức: hết (`≤0`, destructive) / sắp hết (`≤ threshold`, warning) / còn (success) |
| `ChipToggle`               | Chip danh mục, cao ≥ `--touch-target`, có trạng thái chọn                         |
| `TouchButton`              | Bọc `Button`, ép `min-height: var(--touch-target)`                                |
| `ProductImage`             | Ảnh + dự phòng: chữ cái đầu của tên trên nền màu sinh từ tên                      |
| `ProductTile`              | Thẻ sản phẩm đều cỡ: ảnh + tên + giá + đơn vị, `min-h`, border rõ, hover nhấc     |
| `SearchField`              | Input + icon kính lúp + nút xoá                                                   |
| `ResultList` / `ResultRow` | Khung `divide-y`; dòng active có thanh nhấn trái + nền đậm                        |
| `PageHeader`               | Tiêu đề + mô tả + slot hành động (cho `/admin/*`)                                 |
| `DataTableShell`           | Bảng hover row, cột số canh phải, có empty state                                  |
| `EmptyState`               | Icon + câu dẫn + hành động                                                        |
| `CollapsibleFormCard`      | Card form gập được                                                                |
| `StatTile`                 | Ô số liệu cho `/admin/reports`                                                    |

**Ngưỡng "sắp hết"** là hằng số trong kit, mặc định `5`, ghi đè qua prop
`threshold`. Không thêm cột vào schema.

### Tầng 4 — Đường đi của ảnh

```
form admin  →  Server Action  →  save-image.ts  →  public/uploads/<cuid>.webp
                                                          ↓
                                        imageUrl = "/uploads/<cuid>.webp"
                                                          ↓
                              GET /api/catalog  →  SearchableProduct.imageUrl
                                                          ↓
                                   ProductTile / ResultRow  →  ProductImage
```

- `src/server/products/save-image.ts` — nhận `File`; kiểm MIME
  (`image/jpeg|png|webp`) và dung lượng (≤5MB); `sharp` resize 300×300 →
  webp chất lượng 80 (~15KB); ghi `public/uploads/<cuid>.webp`; xoá file cũ
  khi thay ảnh. Thêm dependency `sharp` (hiện chưa có trong `package.json`,
  chỉ được nhắc trong `ignoredBuiltDependencies` của pnpm).
- `imageUrl` thêm vào `SearchableProduct` và `select` của `GET /api/catalog`.
- `product-form.tsx` — ô chọn ảnh + xem trước trước khi lưu; `actions.ts` mở
  rộng Zod schema để nhận file.
- `.gitignore` — thêm `public/uploads/`.
- `next.config.ts` — cấu hình `next/image` cho ảnh nội bộ.

**Ràng buộc triển khai:** cách này ghi file lúc chạy, nên cần filesystem ghi
được. Chạy được với `next start` self-host (đúng mô hình hiện tại, vì DB là
SQLite trên đĩa). **Không chạy được trên Vercel serverless** — nếu sau này
chuyển lên đó thì phải đổi sang object storage.

### Tầng 5 — Offline cho ảnh (`public/sw.js`)

Service worker hiện chỉ cache đường dẫn bắt đầu bằng `/pos`, nên `/uploads/*`
sẽ **không** được cache và mất mạng là vỡ ảnh dù ảnh cùng origin.

Thêm một nhánh **cache-first** riêng cho `/uploads/`, khác với nhánh
network-first của `/pos`. Cache-first là đúng ở đây vì ảnh bất biến: tên file
theo cuid, sửa ảnh nghĩa là sinh file mới. Ảnh dùng cache riêng
(`pos-images-v1`) để việc dọn cache shell không xoá mất ảnh.

Nguyên tắc cũ giữ nguyên: **không** cache `/api/`, **không** cache `/admin`.

### Tầng 6 — Trang gallery (`/dev/kit`)

Một trang xem toàn bộ kit ở light + dark, đủ mọi trạng thái của từng
component. Đây là chỗ "sau chỉ lấy ra dùng thôi".
`notFound()` khi `process.env.NODE_ENV === "production"`.

## 5. Áp dụng

**Đợt 1 — phần sản phẩm:** `product-search.tsx`, `category-grid.tsx`,
`/admin/products/page.tsx`, `product-form.tsx`.

**Đợt 2 — lan ra, giữ nguyên bố cục:** `cart-panel`, `cart-line-row`,
`payment-dialog`, `held-orders-bar`, `sync-indicator`, và các trang
`/admin/*` còn lại (`categories`, `orders`, `debts`, `reports`, `settings`).

## 6. Kiểm chứng

- **Vitest** — logic thuần: `Money` định dạng đúng mọi cỡ; `StockBadge` chọn
  đúng mức ở các ngưỡng biên (`-1`, `0`, `5`, `6`); `save-image` từ chối sai
  MIME và file quá cỡ, resize ra đúng kích thước.
- **Playwright** — chụp `/dev/kit`, `/pos`, `/admin/products` ở cả hai theme;
  một spec e2e cho luồng upload ảnh trong `/admin/products`; một spec kiểm
  ảnh vẫn hiện khi ngoại tuyến (DevTools offline).
- `pnpm check` và `pnpm build` phải xanh.

## 7. Rủi ro

| Rủi ro                                                      | Xử lý                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đổi token màu làm hỏng màn hình chưa được xem tới           | Trang `/dev/kit` + ảnh chụp Playwright trước/sau                                                                                                                                                                                                                                                                              |
| Ảnh làm phình payload catalog (POS nạp cả danh mục một lần) | Chỉ trả `imageUrl` (chuỗi), không nhúng ảnh; ảnh tải lười qua `next/image`                                                                                                                                                                                                                                                    |
| Upload lúc chạy khoá app vào self-host                      | Ghi rõ ở §4; đổi sang object storage là thay đúng `save-image.ts`                                                                                                                                                                                                                                                             |
| `sharp` là native dep, có thể vấp lúc cài                   | `pnpm-workspace.yaml` đang liệt `sharp` trong `ignoredBuiltDependencies` (không cho chạy build script). Khi thêm `sharp` làm dependency thật, phải chuyển nó sang `onlyBuiltDependencies`, nếu không binary native sẽ không được biên dịch và `save-image.ts` sẽ ném lỗi lúc chạy. Kiểm bằng một test Vitest gọi resize thật. |
