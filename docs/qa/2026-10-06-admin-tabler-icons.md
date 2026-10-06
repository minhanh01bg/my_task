# Đồng bộ icon admin và quầy bán hàng — 2026-10-06

## Thay đổi

Dùng `@tabler/icons-react` 3.49.0 (MIT) cho 27 component: sidebar/navbar admin,
đăng xuất, tìm kiếm, thông báo, POS, in hóa đơn và các điều khiển UI/kit dùng chung.
Icon dùng nét viền, stroke 2, màu hiện tại của component. Menu đang chọn vẫn có
nền/màu và `aria-current`; không đổi sang icon đặc khi chọn. Nút thu/mở sidebar
hiển thị mũi tên tương ứng với thao tác và giữ tên truy cập/trạng thái mở rộng.

Giữ các lớp kích thước hiện có và `aria-hidden` của icon trang trí. Không sửa
luồng bán hàng, thanh toán, lưu giỏ, xác thực hay dữ liệu. Phosphor/Lucide vẫn
cần cho các màn hình ngoài phạm vi lần này, nên giữ hai dependency đó.

Nguồn: [React API chính thức](https://docs.tabler.io/icons/libraries/react),
[giấy phép MIT](https://github.com/tabler/tabler-icons).
Next.js hiện tại tối ưu import Tabler mặc định theo tài liệu cài trong repo.
Kiểm tra mã client build cuối thấy 43 định nghĩa icon Tabler outline được dùng.

## Kiểm tra production

Build kiểm chứng `.next-release-admin-icons-v2-20261006`; fixture E2E dùng bản sao
`.next-e2e-admin-icons-v2-20261006` và SQLite `admin-icons-e2e.db` riêng.

- 16 kịch bản production qua: điều hướng desktop/mobile, resize/persist sidebar,
  animation và reduced motion, xác nhận đăng xuất, thông báo và action, đổi trang
  giữ giỏ POS, thanh tính tiền mobile, bán offline và đồng bộ khi có mạng.
- Một kịch bản kiểm tra trực quan tạm thời trong 16 kịch bản trên: 12 icon menu
  đều 20 × 20 px, stroke 2, ẩn khỏi cây accessibility; nút thu/mở đổi icon đúng;
  chuyển sáng/tối và ảnh desktop/mobile/compact. Không giữ test chỉ kiểm tra kiểu
  dáng trong bộ regression thường trực.
- 23 test component checkbox/toast/admin-nav qua sau khi bỏ stroke 3 cũ trên
  checkbox; SQLite riêng `admin-icons-focused.db`.
- Smoke bản production thử nghiệm: 51 kiểm tra, 0 lỗi.
- Rà soát độc lập không còn vấn đề chức năng hoặc accessibility cần sửa.

Log: `/tmp/admin-icons-e2e-final.log`, `/tmp/admin-icons-focused.log`,
`/tmp/admin-icons-build-v2.log`, `/tmp/admin-icons-preview-smoke-final.log`.
Ảnh: `/tmp/admin-icons-desktop-light.png`, `/tmp/admin-icons-desktop-dark.png`,
`/tmp/admin-icons-mobile-light.png`, `/tmp/admin-icons-mobile-dark.png`,
`/tmp/admin-icons-compact.png`.

## Gate và phát hành

- `pnpm check`: lint/typecheck đạt, 229 tệp / 1.492 test qua; log
  `/tmp/admin-icons-check.log`.
- Lint/Prettier/typecheck chạy lại trên source cuối đạt; log
  `/tmp/admin-icons-lint-final.log`, `/tmp/admin-icons-format-final.log`,
  `/tmp/admin-icons-typecheck-final.log`.
- Triển khai dịch vụ `my-task.service` bằng release v2 đã kiểm chứng. Smoke HTTPS
  trên domain thật: 51 kiểm tra, 0 lỗi; 17 chunk JavaScript khớp SHA-256 của build.
  Log `/tmp/admin-icons-deploy.log`. Giữ release trước để có thể quay lại.
