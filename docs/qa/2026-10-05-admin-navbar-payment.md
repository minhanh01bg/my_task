# Navbar quản trị, chuyển quầy và thanh toán chuyển khoản

## Phạm vi

- `/admin` và `/pos` dùng layout chung trong `src/app/(management)`; URL giữ nguyên.
- Navbar chứa tìm kiếm, thông báo, đổi giao diện, đăng xuất và nút ẩn/hiện sidebar. Sidebar giữ các chức năng quản lý.
- Cài service worker lần đầu không tải lại trang làm mất thao tác; cập nhật worker cũ vẫn tải lại để lấy shell mới. Cache POS tăng lên v4.
- Đơn online chuyển khoản đang chờ thanh toán có QR, số tiền, nội dung mã đơn và tài khoản nhận tiền. Trang khách đã đăng nhập, trang khách vãng lai và biên nhận đều sử dụng cùng hướng dẫn. Đơn đã trả tiền/đã hủy/COD không hiện yêu cầu chuyển khoản.
- Chuyển khoản được cửa hàng xác nhận nhận tiền; không tự nhận tiền qua ngân hàng.

## Kịch bản và bằng chứng

1. Đăng nhập → quầy → thêm sản phẩm → Sản phẩm → quầy: sidebar giữ nguyên DOM và giỏ giữ tổng 120.000đ; ẩn/hiện sidebar và tải lại vẫn giữ giỏ. Test thất bại trước thay đổi vì sidebar bị tạo lại.
2. Điện thoại 390×844: thanh tính tiền nằm trên menu dưới, không tràn ngang.
3. Production offline: tải lại quầy, giữ giỏ, thanh toán offline và đồng bộ khi có mạng.
4. Lưu tài khoản ngân hàng → mở quầy → chuyển khoản: canvas QR có nội dung, API tạo đơn 201, payment có `receivedAt` và tổng 120.000đ.
5. Shop → Mua ngay → nhập liên hệ → nhận tại cửa hàng → chuyển khoản → đặt đơn: có QR thật và thông tin nhận tiền; kiểm tra cả khách vãng lai và khách vừa tạo tài khoản. Đánh dấu đơn đã trả tiền rồi tải lại: không còn yêu cầu trả tiền.
6. Thiếu tài khoản ngân hàng: hướng dẫn khách liên hệ cửa hàng. Unit kiểm tra đơn đã trả tiền, đã hủy và COD không hiện hướng dẫn chuyển khoản.

Production E2E dùng bản sao `.next-e2e-navbar-payment-20261005-1814` và DB fixture `prisma/goal-payment-e2e.db`, tách khỏi build/DB phục vụ thật. Header mô phỏng proxy chỉ đặt `X-Real-IP`; không sửa Origin. Số điện thoại checkout fixture tạo riêng mỗi lượt để tránh giới hạn chống spam tích lũy trong Redis.

Next.js giữ các trang đã điều hướng dưới Activity; kiểm tra tổng giỏ dùng locator của phần đang hiển thị để không chọn DOM ẩn.

Checkout UI dùng sản phẩm fixture với slug mới qua `saveProduct()`: global setup tạo lại ID sản phẩm mỗi lượt, còn HTML ISR trong bản copy có thể giữ ID đã bị xóa. Không dùng sản phẩm từ HTML của lần seed trước để khẳng định lỗi checkout thật. Gọi hàm fixture ngoài request Next có cảnh báo thiếu generation store khi invalidation; slug mới chưa có cache nên không phụ thuộc invalidation đó.

Production E2E: **3/3** kịch bản shell/mobile/offline qua; **1/1** lưu ngân hàng và thanh toán POS qua; **2/2** checkout UI guest/account qua. QR online được kiểm tra có pixel thực, thông tin tài khoản, mã đơn, không tràn ngang mobile và ẩn sau khi thanh toán.

Build production `.next-release-navbar-payment-20261005-1814` thành công. Preview trên cổng 3122 với DB thật chỉ chạy smoke đọc: **32 checks, 0 failures**. Không seed DB thật.

Full gate `TRUSTED_PROXY_MODE=none TEST_DATABASE_URL=file:./prisma/goal-navbar-unit.db pnpm check`: lint/typecheck qua, **226 file / 1.475 test qua**. Test toàn bộ chạy tuần tự, 574,72 giây. Build production độc lập qua; typecheck được chạy lại sau khi mở rộng kịch bản E2E.

## Triển khai

`my-task.service` chuyển sang `.next-release-navbar-payment-20261005-1814` lúc 18:19 UTC. Service active, smoke trên `https://taphoatuantoan.disciplineqrhht.com` **32 checks, 0 failures**, `/sw.js` trả cache version v4. Release trước `.next-release-pos-admin-20261005` giữ lại để rollback.
