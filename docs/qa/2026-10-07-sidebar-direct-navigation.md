# Vào trang khuyến mãi trực tiếp từ mục cha

Mục cha chỉ mở nhóm làm người dùng mất hai lần bấm để vào trang chiến dịch. Sửa phần tên/icon Khuyến mãi thành liên kết `/admin/promotions`, mở nhóm khi điều hướng. Mũi tên có nút riêng để mở/thu mà không đổi trang. Trên điện thoại, chọn tên mục cha đóng menu và vào trang chính. Sidebar icon vẫn mở popover chọn trang; giữ focus qua resize.

## Kiểm chứng hồi quy

- RED: 5 test thất bại với hành vi cũ, gồm liên kết trực tiếp, nút mở/thu riêng và đóng menu điện thoại từ tên mục cha (`/tmp/sidebar-direct-red.log`).
- RED bổ sung: Space trên liên kết mở rộng bị Base UI kích hoạt như nút (`/tmp/sidebar-direct-space-red.log`). Chặn riêng handler Base UI cho Space ở chế độ mở rộng để giữ hành vi liên kết; compact vẫn hỗ trợ Space/Enter.
- GREEN: 26 test / 3 file đạt với DB riêng (`/tmp/sidebar-direct-focused.log`).
- Production E2E kiểm tra tên mục cha vào chiến dịch trực tiếp, nút mũi tên không điều hướng, trang con hiện tại, bàn phím, popup icon/Escape/resize, menu điện thoại và các hành vi điều hướng/đăng xuất/animation đã có.

## Kết quả

- `pnpm check`: lint, typecheck và 233 file / 1.515 test đạt trong 435,11 giây (`/tmp/sidebar-direct-gate.log`).
- Build `.next-release-sidebar-direct-20261007` đạt (`/tmp/sidebar-direct-build.log`), tách khỏi build đang phục vụ.
- Production E2E: 11/11 đạt trong 30,3 giây (`/tmp/sidebar-direct-e2e.log`). Dùng build copy `.next-e2e-sidebar-direct-20261007`, DB riêng `sidebar-direct-e2e.db` và cổng 3137.
- Preview storefront: 54 kiểm tra, 0 lỗi (`/tmp/sidebar-direct-preview-smoke.log`). Đã xem ảnh nhóm sidebar desktop và menu điện thoại.
- Đã triển khai lên `https://taphoatuantoan.disciplineqrhht.com`: 54 kiểm tra, 0 lỗi; 22 chunk JavaScript đúng MIME và khớp SHA-256 với release đã kiểm chứng; địa chỉ cửa hàng vẫn đúng (`/tmp/sidebar-direct-deploy.log`).
- Giữ release trước `.next-release-sidebar-groups-20261007` để rollback; script triển khai khôi phục tự động nếu smoke/chunk thất bại.
