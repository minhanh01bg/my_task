# Kiểm tra sao lưu DB tự động — 06/10/2026

- Script mới: SQLite online backup → integrity_check → gzip → AES-256-CBC/PBKDF2 → Telegram sendDocument.
- 7 test Python đạt: snapshot WAL, giải mã/khôi phục, cleanup khi mã hóa lỗi, DB không tồn tại, đường dẫn Prisma, cấu hình mật khẩu, gửi Telegram/error redaction, giữ bản chưa gửi.
- Đã gửi thử thành công, Telegram xác nhận message 24. File mã hóa 17728 byte.
- Giải mã lại đúng bản đã gửi: 21 bảng, PRAGMA integrity_check = ok.
- Service/timer user systemd đã cài đặt; timer enabled/active, service Result=success / ExecMainStatus=0.
- OnCalendar: 02:00 Asia/Ho_Chi_Minh mỗi ngày. Lần kế tiếp lúc kiểm tra: 07/10/2026 02:00 giờ Việt Nam.
- PrivateTmp=yes; thư mục backup 700, .env.backup 600. Snapshot plaintext không lưu trong thư mục backup lâu dài.
- Website HTTPS smoke: /shop trả 200.
- Build production thành công, NEXT_DIST_DIR=.next-release-backup-20261006; không thay build đang phục vụ.
- `pnpm check`: lint/typecheck đạt; 1466/1475 test đạt, 9 test thuộc 3 file thất bại do .env triển khai dùng TRUSTED_PROXY_MODE=custom và x-real-ip, trong khi test gửi header khác.
- Chạy lại đủ 3 file với TRUSTED_PROXY_MODE=none và DB test riêng: 21/21 test đạt (public-receipt, online-orders-route, online-vouchers-validate-route). Không đổi cấu hình proxy runtime.
- CI đã thêm bước kiểm thử Python cho script backup. Không đưa credentials vào Git.
