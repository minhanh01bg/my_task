# Lịch dùng chung trong form khuyến mãi

## Vấn đề và thay đổi

Form `/admin/promotions` dùng `datetime-local`, mở lịch mặc định của trình duyệt. Đã chuyển ngày bắt đầu/kết thúc sang `DateField` hiện có và giữ phần giờ qua ô `time`. Server tiếp tục nhận chuỗi datetime như trước; không đổi schema/múi giờ.

`DateField` bổ sung các props tùy chọn cho id, lỗi liên kết và chế độ chỉ đọc còn focus được. Trang mã giảm giá và bộ lọc đơn hàng giữ API hiện tại. Khi đang lưu, lịch không mở/thay đổi; lỗi lịch focus vào nút chọn ngày. Xóa ngày xóa luôn giờ; lỗi server giữ giá trị; tạo thành công reset ngày/giờ.

## Kiểm chứng

- Trước sửa: 2 test của form thất bại do thiếu nút lịch chung (3 test khác đạt), `/tmp/promotion-date-red.log`.
- Test component bao phủ chọn lịch, giữ/reset ngày giờ, xóa ngày, sai khoảng thời gian, lỗi server focus lịch và lịch chỉ đọc có lỗi liên kết.
- Production E2E chọn ngày qua lịch tiếng Việt, chỉnh giờ, kiểm tra sai khoảng ngày, xác nhận datetime trong DB, bố cục 320/390/1280px và thao tác CRUD.

- `pnpm check`: lint, TypeScript, 232 file / 1.507 test đạt (`/tmp/promotion-date-gate.log`).
- Build `.next-release-promotion-date-20261007` đạt, giữ nguyên build đang phục vụ trước đó (`/tmp/promotion-date-build.log`).
- Production E2E: 3 kịch bản đạt trong 20,8 giây, dùng bản sao `.next-e2e-promotion-date-20261007`, fixture DB `prisma/promotions-e2e.db`, cổng 3137 (`/tmp/promotion-date-e2e.log`). Các lịch đóng phải hoàn tất animation trước khi mở lịch kế tiếp; ảnh chụp tắt animation để kiểm tra trạng thái hiển thị cuối.
- Đã kiểm tra ảnh popup `/tmp/promotion-calendar-320.png` và `/tmp/promotion-calendar-1280.png`; không tràn ngang khi mở lịch ở 320/390/1280px.
- Preview production: 54 kiểm tra, 0 lỗi (`/tmp/promotion-date-preview-smoke.log`).
- Sau triển khai HTTPS: 54 kiểm tra, 0 lỗi; 21 JavaScript chunks login/form có HTTP 200, MIME JavaScript và SHA256 khớp release đã test (`/tmp/promotion-date-deploy.log`). Địa chỉ cửa hàng giữ nguyên.
- `my-task.service` đang phục vụ `.next-release-promotion-date-20261007`; rollback `.next-release-promotions-20261007` còn nguyên.
