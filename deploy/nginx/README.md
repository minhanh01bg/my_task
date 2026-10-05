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
Không chạy lại `install` sau Certbot vì sẽ ghi đè phần TLS được thêm vào.

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
