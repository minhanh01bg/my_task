# Kiểm tra chuyển backup theo script DisciplineQR — 06/10/2026

Tham chiếu: <https://github.com/minhanh01bg/thpthht-disciplineqr/tree/main/scripts>.

- Script chính `scripts/backup-db.mjs`: giữ định dạng DQRBACK1, scrypt và AES-256-GCM của repo tham chiếu; thay mongodump bằng snapshot SQLite online qua Python.
- `.env.backup` giữ nguyên thông tin Telegram/mật khẩu; bỏ dòng MONGODB_URI thừa sai dấu nháy vì không dùng MongoDB. Không lưu credentials vào Git.
- 8 test Node đạt: cấu hình, đường dẫn Prisma, encryption/GCM authentication, backup SQLite thật và restore tiền, cảnh báo khi gửi lỗi, snapshot lỗi, retention, chống ghi đè khi restore.
- 9 test Python đạt, gồm snapshot WAL giữ kết nối live, integrity_check và cleanup.
- Đã gửi bản mới thành công qua service; kích thước 17749 byte. Bản gửi có marker `.sent` và header DQRBACK1.
- Khôi phục chính bản đã gửi: 21 bảng, PRAGMA integrity_check = ok.
- Kiểm tra tương thích bằng chính decrypt-backup.mjs của repo tham chiếu: giải mã và khôi phục SQLite thành công.
- Timer vẫn enabled/active, OnCalendar 02:00 Asia/Ho_Chi_Minh mỗi ngày. ExecStart chuyển sang Node 22 backup-db.mjs; service Result=success, ExecMainStatus=0, PrivateTmp=yes.
- Giữ bản chưa gửi thành công; chỉ prune bản đã gửi quá 7 ngày. Shared flock tránh chạy đồng thời với script cũ.
- Hướng dẫn khôi phục phân biệt DQRBACK1 mới và Salted\_\_ CBC cũ. Các bản cũ vẫn được giữ theo chính sách retention.
- Website HTTPS /shop trả 200.
- Build production đạt tại NEXT_DIST_DIR=.next-release-backup-gcm-20261006; không thay build đang phục vụ.
- Full gate: `TRUSTED_PROXY_MODE=none TEST_DATABASE_URL=file:./prisma/backup-gcm-unit.db pnpm check` đạt lint, typecheck và 226 file / 1475 test. Dùng proxy mode của môi trường test, không đổi runtime Nginx.
- `NEXT_DIST_DIR=.next-release-backup-gcm-20261006 pnpm build` exit 0.
