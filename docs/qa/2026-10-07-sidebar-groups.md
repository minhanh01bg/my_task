# Nhóm cha/con trong menu quản lý

## Phạm vi

Khuyến mãi là nút mở/thu nhóm, chứa hai trang Chiến dịch khuyến mãi và Mã giảm giá. Các mục đơn giữ điều hướng trực tiếp. Trang con hiện tại được đánh dấu riêng, tự mở nhóm khi truy cập hoặc tải lại trang.

Sidebar mở rộng dùng danh sách con có đường phân cấp, chữ/icon nhỏ hơn, hiệu ứng mở/thu và hỗ trợ giảm chuyển động. Sidebar icon dùng popover bên cạnh, không bị vùng cuộn sidebar cắt mất. Escape đóng bảng và trả focus về nút cha; chọn trang con đóng popover. Menu điện thoại dùng cùng nhóm; chọn trang con đóng sheet.

Giữ nguyên trạng thái/animation chiều rộng, công cụ navbar, badge sản phẩm, bottom navigation và xác nhận đăng xuất. Không đổi auth/routes/dữ liệu.

## Kịch bản

- RED: 4 test mở/thu, tự mở nhóm hiện tại, flyout icon/Escape, focus khi resize và điều hướng mobile thất bại với sidebar cũ.
- RED riêng: flyout cũ tự bật lại khi mở rộng rồi thu nhỏ sidebar. Sửa bằng xóa trạng thái mở khi rời chế độ icon và giữ component PopoverContent để hoàn tất đóng.
- GREEN riêng: 23 test / 3 file đạt (`/tmp/sidebar-groups-final-focused.log`), DB riêng `sidebar-groups-isolated.db` để không đụng bộ test toàn dự án.
- Production E2E: điều hướng cha/con desktop, đánh dấu/tải lại trang con, bàn phím, compact flyout/focus/Escape/resize, menu điện thoại.

## Kết quả đã kiểm chứng

- `pnpm check`: lint, typecheck và 233 file / 1.512 test đạt (`/tmp/sidebar-groups-gate.log`).
- Build production riêng `.next-release-sidebar-groups-20261007` đạt (`/tmp/sidebar-groups-build.log`), không ghi đè build đang phục vụ.
- Production E2E: 10/10 đạt trong 31,3 giây, gồm nhóm menu, điều hướng admin, xác nhận đăng xuất, animation resize và giảm chuyển động (`/tmp/sidebar-groups-e2e.log`). Dùng bản build sao chép `.next-e2e-sidebar-groups-20261007`, DB riêng `sidebar-groups-e2e.db`, cổng 3137.
- Preview production: 54 kiểm tra storefront, 0 lỗi (`/tmp/sidebar-groups-preview-smoke.log`). Đã xem ảnh desktop, compact và mobile tại `/tmp/sidebar-group-{desktop,compact,mobile}.png`.
- Đã triển khai artifact đã kiểm chứng lên `https://taphoatuantoan.disciplineqrhht.com`: 54 kiểm tra, 0 lỗi; 22 chunk JavaScript trả đúng MIME và khớp SHA-256 với build; địa chỉ công khai vẫn đúng (`/tmp/sidebar-groups-deploy.log`).
- Release trước `.next-release-promotion-date-20261007` được giữ để rollback; script triển khai tự khôi phục nếu kiểm tra thất bại.
