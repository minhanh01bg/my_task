# Sidebar icon và navbar trong content — 2026-10-06

## Thay đổi

Sidebar desktop cao bằng viewport, nằm từ đầu trang; navbar chỉ chiếm cột nội dung. Giữ một logo ở sidebar. Có thể kéo sidebar từ 72 đến 360px; ở 160px trở xuống chỉ hiện icon, kèm tooltip khi hover hoặc focus. Nút navbar thu gọn/mở rộng, nhớ độ rộng mở rộng trước đó qua tải lại. Menu cuộn độc lập và giữ huy hiệu tồn kho. Nút đăng xuất hiển thị icon ở màn hình hẹp để tránh chồng nút.

## Kiểm chứng

- `pnpm check`: 226 file, 1.478 test đạt; lint và typecheck đạt.
- Sau các sửa cuối: 20 test component admin-navigation đạt, build production v4 đạt; lint/format kiểm tra riêng các file thay đổi.
- Production Playwright: 6/6 kịch bản admin-navigation và pos-admin-shell đạt, dùng DB fixture riêng và bản sao build riêng.
- Kiểm tra kéo thực từ 360 xuống 72, tải lại rồi mở rộng về 360; keyboard resize; tooltip hover/focus; navbar không tràn ở viewport 768 với sidebar 360; sidebar cao 900/500px; menu cuộn độc lập; navbar/sidebar giữ vị trí khi trang cuộn.
- Mobile 320/390px, chuyển mục POS giữ giỏ, tải lại offline rồi thanh toán và đồng bộ đều đạt.
- Xem ảnh chụp desktop compact, desktop POS và mobile.
- Smoke bản preview: 32 kiểm tra đạt. Sau restart, HTTPS domain: 32 kiểm tra đạt. JavaScript chunks trên domain khớp SHA-256 với artifact đã kiểm tra.

## Lỗi phát hiện và sửa trong test

Test trước thay đổi thất bại ở khả năng thu gọn icon. Production E2E phát hiện thiếu role tooltip, navbar chồng nút ở 768px, và pointer drag lưu nhầm độ rộng trung gian. Đã sửa cả ba và chạy lại 6 kịch bản đạt. Độ rộng mở rộng chỉ ghi khi kết thúc thao tác.

## Triển khai

Service `my-task.service` dùng `.next-release-icon-sidebar-v4-20261006`. Giữ artifact trước để rollback. Không thay đổi dữ liệu production; Vitest và Playwright dùng DB riêng. Cấu hình domain và lịch backup giữ nguyên.
