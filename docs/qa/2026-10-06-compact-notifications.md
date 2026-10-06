# Thông báo gọn và thao tác theo loại — 2026-10-06

## Thay đổi

Hộp chuông admin trên navbar dùng placement mobile cả trên desktop; `inset-x-3` làm hộp kéo ngang toàn màn hình. Giới hạn rộng tối đa 384px, cao tối đa 512px và theo chiều cao viewport. Danh sách cuộn riêng, header/đóng/đọc tất cả giữ cố định. Hộp khách hàng cũng giới hạn chiều cao và cuộn danh sách riêng.

Danh sách chung thu gọn icon/khoảng cách, tiêu đề và nội dung tối đa hai dòng, từ dài không gây tràn. Liên kết hiện thao tác theo kind: đơn mới/đã lưu → Xem đơn hàng; cập nhật trạng thái → Theo dõi đơn hàng; thanh toán → Xem thanh toán; kind chứa stock → Kiểm tra tồn kho; loại khác → Xem chi tiết. Giữ href do server cấp và hành vi đánh dấu đã đọc/đóng hộp khi mở. Đây là thao tác điều hướng; không tự xác nhận hay đổi trạng thái đơn. Không bổ sung bộ phát cảnh báo tồn kho mới.

## Kiểm chứng

- RED: 6 case nhãn thao tác thất bại trước triển khai.
- 37 test component tập trung đạt, gồm hộp admin/khách hàng, nhãn/đường dẫn/read callback và múi giờ.
- Build production riêng đạt; E2E dùng bản sao giữ symlink và DB riêng đã push schema.
- 5 kịch bản production đạt: API từ chối anonymous/customer, badge và mở đúng đơn, desktop hẹp, điện thoại đóng/trả focus, 20 nội dung dài cuộn riêng và giữ header trên desktop/mobile.
- Smoke preview: 33 kiểm tra đạt.
- `pnpm check`: lint/typecheck và 229 file, 1.488 test đạt. Typecheck và lint riêng bản cuối cũng đạt.
- Domain HTTPS: 33 kiểm tra đạt; 19 JavaScript chunk khớp SHA-256 với artifact đã kiểm chứng.
- Service chuyển sang `.next-release-notifications-20261006`; giữ release customer-claim trước để rollback.

## Lưu ý kiểm thử

Lần chạy đầu sao chép build không giữ symlink làm Prisma external không load; sửa bản sao node_modules giữ symlink. DB E2E mới cần push schema trước global setup. Test cũ lấy chuông từ sidebar được cập nhật sang navbar; API request checkout cần header IP riêng và route mock thông báo cần khớp query limit. Không sửa cấu hình bảo mật production để cho test qua.
