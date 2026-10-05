# Quầy bán hàng dùng chung layout admin

## Hành vi

- `/pos` là mục Quầy bán hàng trong menu quản trị, mở thẳng danh mục và giỏ.
- Admin và quầy dùng chung `AdminWorkspace`: sidebar, menu mobile, tìm kiếm,
  thông báo, đổi theme, đăng xuất, toast và QueryProvider.
- Quầy không có nút “Quản lý cửa hàng” trung gian. Desktop có nút ẩn/hiện
  sidebar; mobile dùng cùng bottom navigation với admin.
- Giỏ hiện tại giữ nguyên khi chuyển qua sản phẩm rồi quay lại, kể cả reload,
  nhờ cart store hiện có. Không thay đổi cách ghi đơn, tính tiền hay queue offline.
- Thanh tính tiền mobile nằm phía trên menu và safe area, không che nhau.
  Lưới sản phẩm đáp ứng theo chiều rộng thực tế khi có sidebar.
- Giữ URL `/pos` và routing service worker; tăng cache shell lên v3 để bỏ HTML
  giao diện cũ. Loading/error quầy nằm trong cùng vùng nội dung admin.

## Kịch bản kiểm chứng

| Ca                 | Kiểm tra                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Desktop            | Menu Quầy bán hàng active; thêm hàng; vào Sản phẩm rồi quay lại; giỏ/tổng vẫn đúng; ẩn/hiện sidebar; reload       |
| Mobile 390 × 844   | Menu quản trị hiện; thanh tính tiền và menu không đè nhau; không tràn ngang                                       |
| Production offline | Service worker kiểm soát trang; thêm hàng; mất mạng và reload; giỏ còn; thanh toán vào queue; có mạng lại đồng bộ |
| Hồi quy bán hàng   | Tiền mặt, tiền thừa, số lượng lẻ, giữ/mở đơn, in hóa đơn và offline sync                                          |

E2E mới: `e2e/pos-admin-shell.spec.ts`. Ca offline reload chỉ chạy khi dùng
server production. Fixture dùng DB riêng; build production E2E là bản copy
riêng để cache test không ảnh hưởng release thật. Ảnh desktop/mobile đính kèm
Playwright report.

## Kết quả

- Trước sửa, hai ca E2E mới thất bại do quầy chưa có menu quản trị.
- Sau sửa, hai ca desktop/mobile qua trên dev server.
- Production E2E: 3/3 qua, gồm reload offline và đồng bộ đơn sau khi có mạng.
- Hồi quy: 7/7 ca tiền mặt, giữ đơn và offline qua; ca responsive qua khi chạy lại riêng (lần đầu điều hướng bị `ERR_ABORTED` trên dev).
- Smoke bản release trước triển khai: 32 kiểm tra, 0 lỗi.
- Cập nhật test bảo vệ cả layout admin/POS; chờ nút retry sau transition trong test lưu cài đặt. 20/20 ca liên quan qua.
- `pnpm check`: lint, TypeScript và 225 file / 1.470 test qua.
- `NEXT_DIST_DIR=.next-release-pos-admin-20261005 pnpm build`: qua.
- Đã triển khai release `.next-release-pos-admin-20261005` lên HTTPS domain.
- Smoke sau khi dịch vụ sẵn sàng: 32 kiểm tra, 0 lỗi; `/sw.js` trả cache v3. Lần gọi ngay khi restart có 502 tạm thời; chạy lại sau ready qua đầy đủ.
