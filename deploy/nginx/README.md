# taphoatuantoan.disciplineqrhht.com

Cấu hình riêng cho ứng dụng cổng 3001, không thay virtual host domain chính.

## DNS

Tại Tenten, tạo bản ghi A `taphoatuantoan` trỏ tới `160.250.247.137`.
Ngày 05/10/2026, Google và Cloudflare trả SERVFAIL với lỗi delegation không
có authority. Kiểm tra/xóa delegation NS riêng của subdomain nếu cấu hình nhầm;
không thay NS của domain chính. Chỉ cấp certificate sau khi DNS trả đúng IP.

## Cài Nginx và HTTPS

Chạy từ thư mục repo với tài khoản có sudo:

```bash
sudo install -m 644 deploy/nginx/taphoatuantoan.conf /etc/nginx/sites-available/taphoatuantoan
sudo ln -s /etc/nginx/sites-available/taphoatuantoan /etc/nginx/sites-enabled/taphoatuantoan
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d taphoatuantoan.disciplineqrhht.com --redirect
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Certbot hỏi email quản trị/chấp nhận điều khoản và tự thêm TLS vào virtual host.
Không chạy lại `install` sau Certbot vì sẽ ghi đè phần TLS được thêm vào; khi cần
cập nhật file, làm theo mục "Cập nhật cấu hình đã cài" bên dưới.

## Rate limit và hardening

Các dòng `limit_req_zone`/`limit_conn_zone` và khối `map` nằm ở đầu file, ngoài
khối `server`. Nginx (Debian/Ubuntu) `include /etc/nginx/sites-enabled/*` bên
trong `http {}` nên chúng thuộc http context. Nếu include file ở chỗ khác, chuyển
phần đó vào `http {}`. Tên zone và biến `map` có tiền tố `taphoatuantoan_` để
không trùng virtual host khác.

- `/api/auth/`, `/api/customer-auth/` (đăng nhập, đăng ký, đăng xuất):
  10 request/phút/IP, burst 10. App vẫn giữ rate limit riêng phía server.
- `/api/`: 20 request/giây/IP, burst 100.
- `/_next/image` (image optimizer dùng sharp, ghi cache đĩa): 10 request/giây/IP,
  burst 80 để một trang danh sách tải đủ ảnh cùng lúc.
- `/shop` (trang ISR; slug lạ cũng được render và ghi cache 404 xuống đĩa):
  10 request/giây/IP, burst 100 cho Link prefetch của một trang.
- Request ghi (mọi method trừ GET/HEAD, gồm Server Action của admin) ngoài
  `/api/`: 5 request/giây/IP, burst 20. Khối `map` theo `$request_method` cho
  GET/HEAD key rỗng nên duyệt trang không bị zone này giới hạn.
- Mọi đường dẫn: tối đa 100 kết nối đồng thời/IP. Vượt giới hạn trả 429.
- Cửa hàng dùng chung một IP NAT cho nhiều máy: nếu nhân viên gặp 429 khi duyệt
  `/shop` hay xem ảnh, tăng `burst` trước, rồi mới tăng `rate`.
- HSTS không đặt ở Nginx: ứng dụng gửi `Strict-Transport-Security` (next.config.ts),
  trình duyệt chỉ áp dụng qua HTTPS, và khối cổng 80 sau Certbot `--redirect` chỉ
  chuyển hướng 301.
- `client_max_body_size 10m` khớp giới hạn ảnh 8 MB của
  `/api/products/images` cộng overhead multipart; đổi một bên thì đổi cả hai.
- Chặn dotfile trừ `/.well-known/`, tắt `server_tokens`, đặt timeout client.
- Xóa header nội bộ `x-middleware-*`, `x-now-route-matches`, `x-matched-path`
  do client gửi trước khi proxy (phòng thủ kiểu CVE-2025-29927).
- `X-Real-IP`/`X-Forwarded-For` luôn ghi đè bằng `$remote_addr` (một hop proxy),
  khớp `TRUSTED_CLIENT_IP_HEADER=x-real-ip`.

## Cập nhật cấu hình đã cài

Cài lại file rồi để Certbot gắn lại certificate hiện có (không cấp mới):

```bash
sudo cp -p /etc/nginx/sites-available/taphoatuantoan /etc/nginx/taphoatuantoan.bak
sudo install -m 644 deploy/nginx/taphoatuantoan.conf /etc/nginx/sites-available/taphoatuantoan
sudo certbot --nginx -d taphoatuantoan.disciplineqrhht.com --redirect --reinstall
sudo nginx -t
sudo systemctl reload nginx
```

Nếu `nginx -t` lỗi, chép lại bản `.bak` vào `sites-available` rồi reload.

## Origin ứng dụng và release

Sau khi certificate hoạt động, cập nhật `.env`/`.env.local` đang có hiệu lực:

```dotenv
CANONICAL_ORIGIN=https://taphoatuantoan.disciplineqrhht.com
NEXT_PUBLIC_APP_URL=https://taphoatuantoan.disciplineqrhht.com
TRUSTED_PROXY_MODE=custom
TRUSTED_CLIENT_IP_HEADER=x-real-ip
```

Giữ các secret và DATABASE_URL hiện tại. Build vào thư mục release mới theo
README của repo để cập nhật metadata/client public URL; smoke-test bản đó rồi
đổi NEXT_DIST_DIR của my-task.service và restart. Khi chuyển proxy, đổi
ExecStart của user service sang `next start --hostname 127.0.0.1 --port 3001`
để chỉ Nginx truy cập backend và không nhận header IP giả qua cổng công khai.

```bash
systemctl --user daemon-reload
systemctl --user restart my-task.service
node scripts/smoke-storefront.mjs https://taphoatuantoan.disciplineqrhht.com
```

Kiểm tra canonical/sitemap dùng HTTPS domain mới và HTTP redirect sang HTTPS.
