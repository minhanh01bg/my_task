# Animation sidebar admin — 2026-10-06

## Thay đổi

Thu/mở sidebar desktop chuyển width trong 250 ms; cột grid auto đưa navbar và nội dung đi cùng sidebar. Nhãn menu/brand trượt nhẹ và mờ dần, padding/gap đổi đồng bộ. Menu giữ nguyên DOM để focus không mất khi chuyển sang tooltip compact. Tên truy cập vẫn bao gồm badge sản phẩm sắp hết.

Kéo tay tắt transition trong lúc pointer capture để width bám con trỏ. Đảo chiều thu/mở không phụ thuộc animationend. Chế độ prefers-reduced-motion tắt chuyển động. Giữ bộ nhớ độ rộng, thao tác bàn phím, tooltip và layout mobile.

## Kiểm chứng

- RED production trên bản cũ: test không tìm được width trung gian; reduced-motion đạt.
- RED accessibility: aria-label riêng làm mất số hàng sắp hết trong tên menu; loại bỏ ghi đè aria-label và giữ nhãn trong cây truy cập.
- 21 test thành phần bản cuối đạt (AdminNav, voucher links, low-stock badge).
- pnpm check đạt lint/typecheck và 229 file/1.491 test; bộ test tập trung chạy lại sau bổ sung assertion badge. Lint/typecheck/Prettier bản cuối đạt.
- Build riêng `.next-release-sidebar-motion-v2-20261006` đạt, không ghi đè dist đang phục vụ.
- 7 test trình duyệt production đạt trên bản sao build và DB riêng: width trung gian, navbar/content đồng bộ, giữ focus, đảo chiều, kéo tức thì, reduced-motion, nhớ width, tooltip, mobile và đăng xuất xác nhận.
- Test kéo cũ lấy tay nắm khi animation từ bàn phím chưa kết thúc; chờ width thực đạt 360 trước khi kéo, lần chạy lại đạt.
- Preview production: 53 kiểm tra trang/JavaScript/RSC đạt. Review cuối không có lỗi đáng kể.
- Đã chuyển service sang release v2; domain HTTPS qua 53 kiểm tra, 19 JavaScript chunks khớp SHA-256 artifact. Giữ release địa chỉ trước đó để rollback.
