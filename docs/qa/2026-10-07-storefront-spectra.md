# Áp dụng Spectra vào trang cửa hàng

Người dùng chọn phương án đầu tiên trong ba preview và yêu cầu làm thử trực tiếp. `/shop` dùng scene Spectra với ảnh, giá, liên kết sản phẩm/danh mục từ catalog thật, đặt dưới header cửa hàng. Trang chính không có thanh chọn phương án, badge chờ duyệt hay footer tham khảo. Ba trang preview vẫn dùng chung scene để tránh hai bản hành vi khác nhau.

`ProductSlider` là client island dùng lại bộ điều khiển đã có. Trang `/shop` vẫn ISR, lấy catalog/profile tag-cache trên server rồi truyền DTO tối thiểu; không thêm đọc session, ghi DB hoặc lưu lựa chọn. Giữ fallback CTA tới catalog khi không có sản phẩm có ảnh. Focus và reduced motion áp dụng cả lúc nhúng ngoài layout preview.

## Kiểm chứng

- RED: 2 test thất bại với hero cũ, 1 fallback đạt (`/tmp/slider-spectra-red.log`).
- GREEN: 27 test / 4 file đạt, bao gồm tích hợp Spectra, liên kết thật, không có UI preview, fallback và hồi quy preview (`/tmp/slider-spectra-focused.log`). Lint tập trung/typecheck đạt.
- Full gate: `pnpm check` đạt lint/typecheck, 236 file / 1.530 test trong 442,39 giây (`/tmp/slider-spectra-gate.log`).
- Build triển khai `.next-release-spectra-shop-20261007` đạt (`/tmp/slider-spectra-build.log`), tách khỏi release đang phục vụ.
- Smoke bản release cổng 3140: 54 kiểm tra, 0 lỗi; ba preview HTTP 200/noindex; 22 asset JavaScript/CSS đúng MIME và SHA-256; Spectra có tại `/shop`, địa chỉ giữ nguyên (`/tmp/slider-spectra-preview-smoke.log`).

## Môi trường production E2E

Lượt đầu phát hiện môi trường fixture có hai vấn đề: server khởi động trước global setup nên ISR có thể cache catalog rỗng trong lúc seed đang xóa/tạo lại sản phẩm; test đăng nhập `home.spec.ts` thiếu header IP mà proxy production yêu cầu. Đã bổ sung `X-Real-IP` cho test này.

Lượt kiểm chứng lại seed DB riêng **trước** build fixture `.next-fixture-spectra-shop-20261007`, copy sang `.next-e2e-spectra-shop-20261007-r2`, và dùng config kiểm chứng tạm kế thừa cấu hình Playwright với global setup đã thực hiện trước đó. Không seed lại sau khi build để ID sản phẩm trong Full Route/Data Cache khớp DB. DB `spectra-storefront-e2e.db`, cổng 3137; cấu hình bảo mật production giữ nguyên. Artifact triển khai không dùng fixture DB/cache.

## Kết quả production

- E2E lại: 12/12 đạt trong 29,9 giây (`/tmp/slider-spectra-e2e-r2.log`): ba kích thước 1440/390/320px, tải ảnh, đúng một H1, không có UI preview, chuyển card/CTA, Tab tới card đang chọn rồi Mua ngay, đích sản phẩm và nút thêm giỏ; hồi quy ba preview/reduced motion/404; đăng nhập và quay về admin từ header desktop/mobile.
- Đã xem ba ảnh storefront production `/tmp/storefront-spectra-<width>.png` và ảnh crop đầu trang.
- Triển khai domain thật: 54 kiểm tra, 0 lỗi; 22 asset JavaScript/CSS đúng MIME/SHA-256; Spectra tại `/shop`, ba preview vẫn hoạt động, địa chỉ giữ nguyên (`/tmp/slider-spectra-deploy.log`). Service active, dùng `.next-release-spectra-shop-20261007`; giữ `.next-release-slider-previews-20261007` để rollback, script tự khôi phục nếu smoke thất bại.
- Browser trên domain ở 1440/390/320px: ảnh tải, chuyển slide cập nhật CTA, đích sản phẩm HTTP 200, không tràn ngang/UI preview và không có page error (`/tmp/slider-spectra-public-browser.log`). Ảnh `/tmp/spectra-shop-public-<width>.png`.

Xem trực tiếp: <https://taphoatuantoan.disciplineqrhht.com/shop>.
