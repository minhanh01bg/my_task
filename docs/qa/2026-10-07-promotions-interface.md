# Kiểm chứng giao diện quản lý khuyến mãi — 07/10/2026

## Phạm vi

Trang `/admin/promotions` dùng bố cục thống nhất với admin: các nhóm nội dung, vị trí hiển thị và lịch chạy; khung xem trước; danh sách chiến dịch có nhãn tiếng Việt và thao tác rõ ràng. Trang mã giảm giá giữ nguyên.

Form dùng `InputField` với lỗi liên kết qua `aria-describedby`, focus ô lỗi đầu tiên, giữ dữ liệu khi lưu thất bại, chỉ đặt lại khi tạo thành công. Đường dẫn ảnh không hợp lệ không được đưa vào khung xem trước. Server trả lỗi theo trường và từ chối ngày không hợp lệ trước khi ghi Prisma. Tạm dừng/kích hoạt/xóa có phản hồi; xóa vẫn yêu cầu xác nhận.

Không thay đổi phân quyền, audit, chính sách URL, cách diễn giải múi giờ hay cache invalidation hiện có.

## Kịch bản

- Component: tiêu đề trống; liên kết không an toàn; giữ tên, thứ tự và lịch khi server thất bại; reset và toast khi thành công; ảnh nhập dở; lịch kết thúc trước bắt đầu; phản hồi đổi trạng thái.
- Server: validation theo trường, ngày không hợp lệ, auth và CRUD.
- Production Playwright: chuyển hướng khách chưa đăng nhập; validation/focus; preview; bố cục 320/390/1280px; tạo, tạm dừng, kích hoạt, hủy xóa, xác nhận xóa; hồi quy form danh mục.
- Fixture DB và bản sao build tách khỏi production; chỉ dọn chiến dịch có tên fixture duy nhất.

## Kết quả

- `pnpm check`: lint, TypeScript và 232 file / 1.504 test đạt (`/tmp/promotions-gate.log`).
- Build tách biệt `.next-release-promotions-20261007` đạt (`/tmp/promotions-build.log`); build đang phục vụ trước đó được giữ nguyên để rollback.
- Production Playwright với bản sao `.next-e2e-promotions-20261007`, DB `prisma/promotions-e2e.db`, cổng 3137: 3 kịch bản đạt, 14,9 giây (`/tmp/promotions-e2e.log`).
- Preview production: 54 kiểm tra, 0 lỗi (`/tmp/promotions-preview-smoke.log`).
- Đã kiểm tra ảnh `/tmp/promotions-desktop.png` và `/tmp/promotions-mobile.png`; không tràn ngang ở 320/390/1280px.
- Sau triển khai HTTPS: 54 kiểm tra, 0 lỗi; 21 JavaScript chunks của login/form khuyến mãi trả HTTP 200, MIME JavaScript và SHA256 khớp build đã kiểm chứng (`/tmp/promotions-deploy.log`). Địa chỉ cửa hàng hiện tại được giữ nguyên.
- Service `my-task.service` chuyển sang `.next-release-promotions-20261007`; rollback `.next-release-categories-v2-20261007` còn nguyên.

Kịch bản E2E bấm nhãn của radio ẩn, mở/đóng thông báo qua tương tác thực và đợi phản hồi xóa hoàn tất trước khi xác nhận dữ liệu. Đây là các điều chỉnh cách kiểm chứng, không thay đổi mã ứng dụng sau build.
