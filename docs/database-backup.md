# Sao lưu SQLite qua Telegram

Script `scripts/backup-sqlite-telegram.py` đọc `DATABASE_URL` trong `.env` và thông tin trong `.env.backup`:

```dotenv
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
BACKUP_ENCRYPTION_PASSWORD=...
```

Không cần `MONGODB_URI`. Đường dẫn SQLite tương đối được tính từ thư mục `prisma`.
Không đưa các file môi trường vào Git. Đặt quyền `.env.backup` là `600`.

Script tạo snapshot bằng SQLite online backup API, kiểm tra toàn vẹn, nén gzip,
rồi mã hóa OpenSSL AES-256-CBC với PBKDF2 SHA-256, 200000 vòng. Snapshot chưa mã hóa
chỉ tồn tại trong thư mục tạm riêng và được xóa khi chạy xong. Service dùng
`PrivateTmp=true`; systemd dọn thư mục tạm của service cả khi tiến trình bị kill. File mã hóa nằm ở
`~/.local/state/my-task-backups` (thư mục `700`, file `600`). Telegram chỉ nhận file mã hóa.
Giữ mật khẩu ở nơi an toàn để khôi phục; file mã hóa dùng CBC không có xác thực chống sửa đổi.

Timer chạy lúc **02:00 giờ Việt Nam mỗi ngày**, có chạy bù sau khi máy hoạt động lại.
Các bản đã được Telegram xác nhận gửi thành công được giữ trên máy 7 ngày.
Bản chưa gửi thành công được giữ lại; kiểm tra journal khi job lỗi.
Backup chỉ gồm database, không gồm ảnh/uploads hay cấu hình ứng dụng.

```bash
install -m 600 ops/systemd/my-task-backup.service ~/.config/systemd/user/
install -m 600 ops/systemd/my-task-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now my-task-backup.timer
systemctl --user start my-task-backup.service
systemctl --user list-timers my-task-backup.timer
journalctl --user -u my-task-backup.service -n 20 --no-pager
```

Kiểm tra không gửi: `/usr/bin/python3 scripts/backup-sqlite-telegram.py --no-send`.
Kiểm thử: `/usr/bin/python3 -m unittest discover -s tests/scripts -p 'test_backup*.py'`.
Không tự gửi lại khi HTTP bị lỗi vì Telegram có thể đã nhận file trước khi mất kết nối.

Khôi phục vào một file riêng, kiểm tra trước khi thay database đang chạy:

```bash
umask 077
read -r -s -p 'Mật khẩu backup: ' SHOP_RESTORE_PASSWORD
export SHOP_RESTORE_PASSWORD
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass env:SHOP_RESTORE_PASSWORD -in shop-backup-EXAMPLE.sqlite3.gz.enc \
  -out /tmp/shop-restore.sqlite3.gz
unset SHOP_RESTORE_PASSWORD
gunzip /tmp/shop-restore.sqlite3.gz
```

Chạy `PRAGMA integrity_check` trên bản khôi phục, dừng dịch vụ trước khi thay DB,
và giữ bản DB hiện tại để có thể quay lại. Bản giải mã chứa dữ liệu nhạy cảm;
đặt `umask 077` trước khi khôi phục và xóa sau khi kiểm tra.
