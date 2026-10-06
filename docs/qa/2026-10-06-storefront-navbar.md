# Chuyển liên kết cửa hàng lên navbar admin — 06/10/2026

- `Xem cửa hàng online` được chuyển khỏi NAV sidebar/menu mobile sang thanh công cụ chung của admin và POS.
- Desktop từ 1024px hiện nhãn đầy đủ; màn hình nhỏ dùng biểu tượng có aria-label/title và vùng bấm 44px. Giữ liên kết `/shop` trong cùng tab.
- 17 test component điều hướng đạt, gồm xác nhận liên kết trong header và không lặp trong sidebar/menu.
- Regression placement đã xác nhận thất bại trước khi sửa và thành công sau khi sửa.
- Production build `.next-release-storefront-navbar-20261006` thành công, tách khỏi artifact đang phục vụ.
- Fixture production dùng bản copy `.next-e2e-storefront-navbar-20261006` và DB `navbar-storefront-e2e.db` riêng.
- 6 production E2E đạt (admin-navigation và pos-admin-shell): mobile 320/390px không tràn navbar, liên kết mở `/shop`, desktop, sidebar resize, giữ giỏ khi đổi mục và offline sync.
- Đã xem ảnh chụp desktop 1280/1440px và mobile 390px; vị trí/vùng bấm hiển thị đúng.
- Smoke candidate trên cổng 3128: 32 kiểm tra trang HTML/RSC và JavaScript chunks, 0 lỗi.
- Full gate: TRUSTED_PROXY_MODE=none và DB unit riêng, `pnpm check` đạt lint/typecheck, 226 file / 1475 test.
- Đã chuyển my-task.service sang artifact đã kiểm chứng; MainPID=326065, ExecMainStatus=0, service active.
- Smoke trên https://taphoatuantoan.disciplineqrhht.com sau triển khai: 32 kiểm tra, 0 lỗi.
- Chunk chứa navbar mới trên tên miền: HTTP 200, MIME JavaScript, SHA-256 khớp artifact build.
- Timer backup vẫn active sau triển khai. Server preview cổng 3128 đã dừng.
