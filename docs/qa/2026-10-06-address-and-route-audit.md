# Địa chỉ hiện hành và rà trang — 2026-10-06

## Kết quả rà soát

Có 33 template page. Rà 23 đích điều hướng tĩnh trong source không tìm thấy route thiếu; `/shop.webmanifest` là asset public, không phải page. Kiểm thử trình duyệt mở các trang sidebar admin và trang báo cáo sau login, HTTP 200 và không có pageerror. Smoke công khai kiểm tra trang chính, account/login/register/history, checkout, chính sách, link danh mục/sản phẩm và CTA từ HTML thực tế.

Các luồng chưa có: xác minh điện thoại cho tài khoản khách mới để claim đơn khách; khôi phục mật khẩu khách (copy hướng dẫn gọi hotline nhưng admin chưa có thao tác reset). Không thêm trang rỗng cho hai chức năng này và không bỏ kiểm tra sở hữu đơn.

## Nguyên nhân địa chỉ cũ

Danh mục hardcode 63 tỉnh/quận/huyện và một phần xã; phần còn lại tự sinh “Phường 1/2/Trung Tâm”. Checkout và API bắt buộc huyện. Thay bằng snapshot chính thức Cục Thống kê ngày 06/10/2026: 34 đơn vị cấp tỉnh, 3.321 mã xã/phường/đặc khu duy nhất, toàn bộ mã cha tồn tại/tên tỉnh khớp. Bao gồm cập nhật năm 2026; Bắc Ninh mã 24 hiện là thành phố, phường Bắc Giang mã 07210. Nguồn và checksum export ghi tại `src/lib/address/SOURCE.md`.

Form chọn tỉnh → xã trực tiếp, đổi tỉnh reset xã; nhập tay chỉ cần hai cấp và đường/số nhà. Server kiểm tra mã/tên bằng so khớp chuẩn hóa đầy đủ, không dùng includes một phần. Mã huyện cũ nhận hướng dẫn tải lại trang. Trường text huyện trong payload cũ được giữ tùy chọn; địa chỉ đơn đã lưu không sửa.

Địa chỉ cửa hàng trước kiểm tra là “Xã Đồng Kỳ - tỉnh Bắc Ninh”; tên xã tồn tại trong snapshot mới. Không có “thành phố Bắc Giang” trong địa chỉ cửa hàng, bộ chọn địa chỉ cũ là nguồn nghi vấn phù hợp.

## Kiểm chứng

- RED: 7 test contract mới thất bại trước sửa; 2 test UI mới thất bại trước sửa form.
- 46 test tập trung về dataset/contract/checkout/tạo đơn/voucher đạt.
- Build production riêng đạt; bản sao giữ symlink và DB E2E riêng.
- 4 test production đạt: giao hàng địa chỉ mới lưu đúng province/ward/street và district null; audit các trang admin; QR chuyển khoản guest/account.
- Smoke preview: 53 kiểm tra đạt.
- `pnpm check`: 229 file và 1.491 test đạt, lint/typecheck đạt. Review không tìm thấy lỗi đáng kể; typecheck/lint riêng bản cuối đạt.
- Build v2 mới sau cập nhật địa chỉ cửa hàng đạt; smoke preview/domain đều 53 kiểm tra đạt, HTML hiển thị “Xã Đồng Kỳ - thành phố Bắc Ninh”. 19 JavaScript chunks domain khớp SHA-256 artifact.
- Service chuyển sang `.next-release-address-v2-20261006`, giữ release notifications để rollback. Chỉ cập nhật Setting `store.address` qua helper hiện có, bản trước lưu trong `/tmp/store-address-before-20261006.json`; không sửa đơn production. Helper ngoài request gọi revalidate sau commit nhưng Next không có generation store; build mới và smoke xác nhận cache công khai đã làm mới.
- Test audit đầu đọc link trước khi sidebar render xong; thêm chờ link Settings hiển thị, lần sau đạt.
