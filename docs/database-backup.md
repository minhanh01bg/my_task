# Sao lưu SQLite qua Telegram

Script chính: `node scripts/backup-db.mjs`. Cách mã hóa, định dạng `DQRBACK1`,
gửi Telegram và cảnh báo lỗi theo [script tham chiếu của DisciplineQR](https://github.com/minhanh01bg/thpthht-disciplineqr/tree/main/scripts).
Phần lấy dữ liệu dùng SQLite online backup API thay cho `mongodump` vì cửa hàng dùng SQLite.

Cấu hình `.env.backup` (quyền `600`, không đưa vào Git):

```dotenv
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
BACKUP_ENCRYPTION_PASSWORD=...
```

Mật khẩu phải dài ít nhất 16 ký tự. Script chỉ lấy các thông tin Telegram/mật khẩu
trong `.env.backup`, không lấy từ biến môi trường tiến trình. `DATABASE_URL` có thể
đặt trong `.env.backup`; nếu chưa đặt, script đọc giá trị trong `.env` của ứng dụng.
Không cần `MONGODB_URI`. Đường dẫn SQLite tương đối được tính từ thư mục `prisma`.

Snapshot được kiểm tra `PRAGMA integrity_check`, nén gzip rồi mã hóa theo luồng:
**AES-256-GCM + scrypt**, salt 16 byte, nonce 12 byte, tag 16 byte.
Định dạng: `DQRBACK1` (8 byte) | salt | nonce | ciphertext | tag.
GCM kiểm tra mật khẩu và phát hiện file bị sửa trước khi công bố bản giải mã.

Snapshot chưa mã hóa nằm trong thư mục tạm riêng; service dùng `PrivateTmp=true`
để systemd dọn dữ liệu tạm cả khi tiến trình bị dừng đột ngột. File mã hóa nằm ở
`~/.local/state/my-task-backups` (thư mục `700`, file `600`). Telegram chỉ nhận file mã hóa.
Giữ mật khẩu ở nơi an toàn để khôi phục.

Timer chạy lúc **02:00 giờ Việt Nam mỗi ngày**, có chạy bù sau khi máy hoạt động lại.
Giữ trên máy 7 ngày đối với bản đã gửi thành công (có marker `.sent`).
Khi backup lỗi, script gửi cảnh báo Telegram; bản mã hóa hoàn chỉnh chưa gửi được
vẫn giữ trên máy. Không tự gửi lại khi HTTP lỗi vì Telegram có thể đã nhận file.
Backup chỉ gồm database, không gồm ảnh/uploads hay cấu hình ứng dụng.

Cài service/timer trên máy hiện tại (Node 22, Python 3, `flock`):

```bash
install -m 600 ops/systemd/my-task-backup.service ~/.config/systemd/user/
install -m 600 ops/systemd/my-task-backup.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now my-task-backup.timer
systemctl --user start my-task-backup.service
systemctl --user list-timers my-task-backup.timer
journalctl --user -u my-task-backup.service -n 20 --no-pager
```

Đổi đường dẫn repo/Node trong service nếu cài trên máy khác. Khóa `flock` ngăn
hai lần backup CLI/service chạy đồng thời. Kiểm tra không gửi:
`node scripts/backup-db.mjs --no-send`.

Kiểm thử:

```bash
node --test scripts/backup-db.test.mjs
/usr/bin/python3 -m unittest discover -s tests/scripts -p 'test_*.py'
```

## Khôi phục bản mới (DQRBACK1)

Chạy vào một file riêng; script không ghi đè file hiện có:

```bash
umask 077
read -r -s -p 'Mật khẩu backup: ' BACKUP_ENCRYPTION_PASSWORD
export BACKUP_ENCRYPTION_PASSWORD
node scripts/decrypt-backup.mjs shop-backup-EXAMPLE.sqlite3.gz.enc /tmp/shop-restore.sqlite3.gz
unset BACKUP_ENCRYPTION_PASSWORD
gunzip /tmp/shop-restore.sqlite3.gz
```

Kiểm tra `PRAGMA integrity_check` trên bản khôi phục. Dừng dịch vụ trước khi thay DB,
giữ DB hiện tại để có thể quay lại. Bản giải mã chứa dữ liệu nhạy cảm; xóa sau khi
kiểm tra nếu không dùng để phục hồi.

## Bản cũ trước khi chuyển sang script tham chiếu

Bản cũ do `backup-sqlite-telegram.py` tạo có header `Salted__`, dùng OpenSSL
AES-256-CBC/PBKDF2; không giải mã bằng script Node. Các bản này vẫn được giữ,
bao gồm bản thử đầu tiên đã gửi Telegram. Phân biệt header bằng
`head -c 8 TEN_FILE.enc`: `DQRBACK1` là bản mới, `Salted__` là bản cũ.

```bash
umask 077
read -r -s -p 'Mật khẩu backup cũ: ' SHOP_RESTORE_PASSWORD
export SHOP_RESTORE_PASSWORD
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass env:SHOP_RESTORE_PASSWORD -in TEN_FILE_CU.enc -out /tmp/shop-restore-old.sqlite3.gz
unset SHOP_RESTORE_PASSWORD
gunzip /tmp/shop-restore-old.sqlite3.gz
```

Script Python cũ chỉ giữ để tương thích/kiểm thử; timer gọi `backup-db.mjs`.
