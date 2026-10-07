# Ba bản slider để duyệt trước khi áp dụng

Ghi lại hướng thiết kế trong [kế hoạch](../superpowers/plans/2026-10-07-slider-previews.md), triển khai ba trang preview độc lập dùng cùng catalog, giá, ảnh và tên cửa hàng thật. Slider đang dùng tại `/shop` giữ nguyên trong lúc người dùng duyệt.

- Spectra: nền xanh rừng, ảnh giữa nổi lớn, phối cảnh và ánh sáng đổi theo sản phẩm.
- Spotlight: nền kem, tiêu đề thanh lịch, hàng ảnh cong nhẹ.
- Under The Radar: chữ lớn, ảnh xòe như quạt, nền chartreuse.

## Hành vi và giới hạn

Chuyển slide bằng thẻ ảnh, nút trước/sau, chấm chọn, phím mũi tên khi focus vùng slider hoặc vuốt. CTA sản phẩm/danh mục đồng bộ với lựa chọn. Tự chạy mặc định tắt; bật thủ công thì dừng khi hover/focus và tôn trọng reduced motion. Chỉ thẻ đang chọn tham gia Tab để tránh focus vào ảnh bị cắt ngoài khung. Catalog rỗng và một sản phẩm có trạng thái riêng.

Preview là trang ISR dùng tag-cache công khai, không đọc session/cookie/header, không ghi DB hoặc lưu lựa chọn. Metadata noindex/nofollow; variant lạ trả 404. Chưa áp dụng phương án nào vào slider cửa hàng.

## Kiểm chứng

- RED của hồi quy bàn phím: test mới thất bại vì card chưa có tabIndex (`/tmp/slider-preview-keyboard-red.log`).
- GREEN: 12 test / 2 file đạt với DB test riêng (`/tmp/slider-preview-focused.log`). Lint tập trung và typecheck đạt.
- Review độc lập phát hiện card ngoài khung vẫn nhận Tab; đã sửa và bổ sung test. Không phát hiện hồi quy routing/cache/storefront.

- `pnpm check`: lint, typecheck và 235 file / 1.527 test đạt trong 445,79 giây (`/tmp/slider-previews-gate.log`).
- Build `.next-release-slider-previews-20261007` đạt; ba variant được prerender bằng `generateStaticParams`, revalidate 60 giây (`/tmp/slider-previews-build.log`).
- Production E2E: 6/6 đạt trong 12 giây (`/tmp/slider-previews-e2e.log`). Dùng build copy `.next-e2e-slider-previews-20261007`, DB riêng `slider-previews-e2e.db`, cổng 3137. Mỗi variant kiểm tra ảnh thật, card/CTA đồng bộ, Tab tới card đang chọn rồi Mua ngay, vuốt, không tràn ngang ở 390/320px. Kiểm tra đổi ba preview, giữ slider `/shop`, reduced motion và variant lạ 404.
- Đã xem chín ảnh production: ba desktop và sáu mobile 390/320px (`/tmp/slider-preview-<variant>-<desktop|390|320>.png`).
- Smoke bản release ở cổng 3140: 54 kiểm tra, 0 lỗi; ba preview HTTP 200/noindex; 22 asset JavaScript/CSS đúng MIME, khớp SHA-256 (`/tmp/slider-previews-preview-smoke.log`).
- Đã triển khai preview lên domain: 54 kiểm tra, 0 lỗi; ba preview HTTP 200/noindex; 22 asset khớp release; slider hiện tại và địa chỉ cửa hàng giữ nguyên (`/tmp/slider-previews-deploy.log`). Service `my-task.service` active, release cũ `.next-release-sidebar-direct-20261007` được giữ để rollback. Script triển khai tự khôi phục release cũ nếu kiểm tra thất bại.

- Browser trên domain thật: cả ba mẫu tải ảnh, chuyển slide cập nhật CTA, đích sản phẩm HTTP 200, không tràn ngang và không có page error (`/tmp/slider-previews-public-browser.log`).

## Link duyệt

1. [Spectra](https://taphoatuantoan.disciplineqrhht.com/shop/slider-preview/spectra)
2. [Spotlight](https://taphoatuantoan.disciplineqrhht.com/shop/slider-preview/spotlight)
3. [Under The Radar](https://taphoatuantoan.disciplineqrhht.com/shop/slider-preview/under-the-radar)

Người dùng xem và duyệt sau; các link trên dành cho so sánh, không kích hoạt thay thế slider hiện tại.
