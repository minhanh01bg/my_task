# Lưu đơn khách vào tài khoản — 2026-10-06

## Nguyên nhân và thay đổi

Nút lưu đơn gặp 401 chuyển tới `/account`, nhưng địa chỉ này thiếu page và trả 404 trên domain. Bổ sung trang chuyển hướng sang `/account/orders`; khách chưa đăng nhập tiếp tục tới login. Nút lưu đơn chuyển thẳng tới login với đường dẫn đơn khách trong `next`. Login/register giữ đường dẫn qua các link đổi hình thức đăng nhập và sau login quay lại đúng đơn. Chỉ chấp nhận đường dẫn đơn khách nội bộ; loại URL ngoài, admin, traversal và query tùy ý.

Lịch sử và chi tiết đơn đã tồn tại ở `/account/orders` và `/account/orders/[id]`; query kiểm tra chủ sở hữu. Đơn đặt trong phiên khách được gắn trực tiếp vào tài khoản. Lưu đơn đặt trước login yêu cầu số điện thoại đã xác minh và khớp đơn. Chưa có luồng xác minh trong repo; không bỏ kiểm tra này. Khách đã đăng nhập nhưng chưa xác minh thấy thông báo rõ và nút lưu bị khóa, vẫn theo dõi qua link khách hiện tại. Bổ sung cách xác minh cần lựa chọn admin hoặc OTP/dịch vụ SMS; chưa triển khai trong thay đổi này.

## Kiểm chứng

- RED: 2 test điều hướng/login thất bại trước sửa; test tài khoản chưa xác minh thất bại trước thêm guard.
- `pnpm check`: lint/typecheck đạt, 228 file và 1.482 test đạt.
- Sau sửa guard: 26 test component/trang/helper đạt; 18 test API/dữ liệu đạt; typecheck riêng bản cuối đạt.
- Build production riêng v3 đạt. E2E dùng bản sao build và DB riêng với URL tuyệt đối.
- 3 test production đạt: giữ đơn qua login/register; unverified hiện hướng dẫn; verified fixture lưu đơn, chi tiết và lịch sử có đơn, link khách thu hồi; checkout guest và account có QR chuyển khoản. Trạng thái verified trong E2E được tạo bằng fixture, không phải luồng xác minh thực tế.
- Build đầu phát hiện test page cũ thiếu props searchParams; cập nhật test theo API page. Build v3 đạt.
- Smoke preview/domain: mỗi nơi 32 kiểm tra đạt. 18 JavaScript chunks trên domain khớp SHA-256 với artifact.
- Thêm 3 kiểm tra đường dẫn tài khoản trên domain đạt. Next có loading boundary nên redirect xuất hiện dưới dạng meta refresh trong HTTP 200; kiểm tra đích chuyển hướng thay vì chỉ yêu cầu HTTP 307. E2E xác nhận điều hướng thực trong trình duyệt.

## Commit và triển khai

Tách commit trang account, giữ đơn qua auth và hướng dẫn xác minh. Service dùng `.next-release-customer-claim-v3-20261006`, giữ release trước để rollback. Không sửa dữ liệu production hoặc lịch backup.
