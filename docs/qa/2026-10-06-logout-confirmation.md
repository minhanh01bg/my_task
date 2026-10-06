# Xác nhận đăng xuất admin — 2026-10-06

Bấm nút đăng xuất trên navbar hoặc menu mobile mở hộp xác nhận. Mặc định focus vào Hủy; Hủy/Escape giữ phiên đăng nhập. Chỉ xác nhận mới gửi POST logout. Trong lúc chờ, khóa nút và không cho đóng hộp; nếu thất bại, hiển thị lỗi để thử lại.

## Kiểm chứng

- RED: test mobile xác nhận không gọi API khi bấm lần đầu thất bại trên code cũ.
- GREEN: 20 test component admin-navigation đạt, gồm hủy rồi mở lại và xác nhận đăng xuất.
- `pnpm check`: lint/typecheck đạt, 226 file và 1.478 test đạt.
- Build production riêng `.next-release-logout-confirm-20261006` đạt.
- 8 kịch bản production admin-navigation/POS đạt: desktop Hủy/Escape trả focus và giữ phiên; mobile hộp xác nhận trong menu, Hủy giữ menu/phiên; xác nhận chuyển về login; sidebar và POS/offline không hồi quy.
- Test production vòng đời phiên trong online-store đạt: cookie thu hồi, truy cập admin lại chuyển về login.
- Production E2E dùng bản sao build và DB fixture riêng. Khởi tạo DB test ban đầu thiếu schema; đã sửa bằng schema riêng và dùng URL DB tuyệt đối để thống nhất đường dẫn Prisma.
- Smoke preview và domain HTTPS: mỗi nơi 32 kiểm tra đạt. 18 JavaScript chunks trên domain khớp SHA-256 với artifact đã kiểm tra.

## Triển khai

Service `my-task.service` dùng `.next-release-logout-confirm-20261006`. Giữ bản sidebar trước để rollback. Không đổi DB production hoặc lịch backup.
