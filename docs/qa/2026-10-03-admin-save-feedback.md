# Kịch bản kiểm thử lưu dữ liệu admin

Phạm vi: lưu cài đặt, thêm/sửa sản phẩm, sửa nhanh giá và tồn kho. Kiểm tra thông báo đi cùng kết quả lưu thật, giữ nội dung nhập khi lỗi và khả năng thử lại.

## Kịch bản và kết quả mong đợi

| ID  | Kịch bản                                         | Kết quả mong đợi                                                                                   | Kiểm thử tự động   |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------ |
| S01 | Lưu cài đặt hợp lệ, tải lại trang                | Toast thành công; tên, ngân hàng, phí giao hàng giữ giá trị đã lưu                                 | E2E + component    |
| S02 | Mã ngân hàng sai định dạng                       | Toast lỗi; giữ nội dung nhập; không ghi một phần vào SQLite                                        | E2E + component    |
| S03 | Request lưu cài đặt bị lỗi mạng, sau đó thử lại  | Thông báo an toàn; nút lưu bật lại; giữ thông tin; thử lại lưu được                                | E2E + component    |
| S04 | Lưu cài đặt lặp lại cùng kết quả                 | Mỗi lần lưu đều có thông báo                                                                       | E2E cũ + component |
| S05 | Lưu ở cuối trang trên màn hình 390 × 844         | Toast nằm trong viewport và người dùng đóng được                                                   | E2E                |
| P01 | Thêm sản phẩm với giá 7.500 và tồn kho 1,25      | SQLite lưu đúng giá/tồn; toast vẫn hiện sau khi modal đóng; reload không mất dữ liệu               | E2E                |
| P02 | Request thêm sản phẩm lỗi mạng rồi thử lại       | Modal còn mở; giữ tên/giá; lần lỗi không tạo bản ghi; thử lại tạo đúng một bản ghi và xóa bản nháp | E2E                |
| P03 | Tên sản phẩm chỉ gồm khoảng trắng                | Toast validation; modal còn mở; sửa tên rồi lưu được                                               | E2E                |
| P04 | Sửa chi tiết tên và giá sản phẩm                 | Reload hiện giá trị mới; cập nhật cùng bản ghi                                                     | E2E                |
| Q01 | Sửa nhanh giá 4.500 và tồn kho -2,5              | Lưu đúng giá lẻ/tồn âm; modal đóng; toast còn hiện                                                 | E2E                |
| Q02 | Request sửa nhanh lỗi mạng rồi thử lại           | Giữ modal và giá vừa nhập; lần lỗi không thay đổi dữ liệu; thử lại cập nhật được                   | E2E                |
| C01 | Request của từng form còn đang chờ               | Nút bị khóa, hiện “Đang lưu”; bấm lại không gửi lần thứ hai; chưa có toast thành công              | Component, 3 form  |
| C02 | Server trả lỗi rồi người dùng thử lại            | Giữ nội dung nhập; khôi phục nút; lần sau có toast thành công                                      | Component, 3 form  |
| C03 | Server phát sinh exception có thông tin riêng tư | Toast tiếng Việt; không hiển thị chi tiết exception                                                | Component          |

## Lỗi đã tái hiện

1. Form cài đặt mất nội dung vừa nhập khi server trả lỗi hoặc request thất bại. Component test và E2E validation bắt được lỗi này. React tự reset các trường uncontrolled khi form action hoàn thành, kể cả kết quả `{ ok: false }`.
2. Trạng thái “Đang lưu…” của sản phẩm và sửa nhanh không xuất hiện trong lúc action đang chờ. Component test sử dụng promise chưa resolve bắt được lỗi này: state được cập nhật trong transition của form action nên bị trì hoãn.

Sửa bằng submit handler có `preventDefault()`. Cài đặt vẫn dùng `useActionState` trong `startTransition`; sản phẩm/sửa nhanh gọi action từ event handler và chỉ reset dữ liệu trong nhánh thành công.

## Cách chạy

Dùng Node 22 và pnpm 10.28.2. Không dùng cơ sở dữ liệu đang phục vụ ứng dụng.

```bash
# Component test: Prisma setup dùng file riêng.
TEST_DATABASE_URL=file:./prisma/save-components.db pnpm exec vitest run tests/components/admin/save-feedback.test.tsx

# Toàn bộ quality gate; môi trường test không có reverse proxy.
TRUSTED_PROXY_MODE=none TEST_DATABASE_URL=file:./prisma/save-full-gate.db pnpm check
pnpm build

# Tạo schema riêng trước khi Playwright reseed fixtures.
DATABASE_URL=file:./prisma/save-scenarios.db pnpm exec prisma db push

# Kịch bản mới hoặc toàn bộ E2E. Một worker tránh tranh chấp fixture.
DATABASE_URL=file:./prisma/save-scenarios.db PLAYWRIGHT_PORT=3107 TRUSTED_PROXY_MODE=none pnpm test:e2e --workers=1 -- e2e/admin-save-scenarios.spec.ts
DATABASE_URL=file:./prisma/save-scenarios.db PLAYWRIGHT_PORT=3107 TRUSTED_PROXY_MODE=none pnpm test:e2e --workers=1

# Trên máy ít RAM, chạy từng nhóm với server mới.
DATABASE_URL=file:./prisma/save-scenarios.db PLAYWRIGHT_PORT=3107 TRUSTED_PROXY_MODE=none pnpm test:e2e --workers=1 -- e2e/admin- e2e/auth-entry.spec.ts
DATABASE_URL=file:./prisma/save-scenarios.db PLAYWRIGHT_PORT=3107 TRUSTED_PROXY_MODE=none pnpm test:e2e --workers=1 -- e2e/online-store.spec.ts
DATABASE_URL=file:./prisma/save-scenarios.db PLAYWRIGHT_PORT=3107 TRUSTED_PROXY_MODE=none pnpm test:e2e --workers=1 -- e2e/pos-cash-sale.spec.ts e2e/pos-offline-sale.spec.ts e2e/responsive-layout.spec.ts e2e/screens.spec.ts
```

Playwright mặc định dùng một worker vì các file cùng ghi fixture trong SQLite, và khởi động server riêng thay vì dùng lại server đang chạy với DB/env khác. Kịch bản mới chụp và khôi phục các Setting liên quan qua action để hết hạn cache rồi trả lại trạng thái khóa ban đầu sau mỗi ca, xóa sản phẩm fixture có tiền tố riêng, và chỉ chặn request POST có header `next-action` để mô phỏng lỗi mạng. Các test lỗi mạng không thay thế kết quả action bằng mock thành công.

## Kết quả chạy

- 22/22 component test liên quan đã qua sau khi sửa.
- Quality gate: lint, TypeScript và 1.463/1.463 test (225 file) đã qua với proxy dành cho test và DB riêng.
- Build production đã qua.
- Nhóm admin và đăng nhập: 26/26 E2E đã qua, gồm 10 kịch bản mới.
- Storefront: 23/23 ca đã qua theo nhóm (21 ca trong lượt chính, 2 ca mobile/ảnh trong lượt riêng sau khi server bị OOM).
- POS, offline, responsive và chụp màn hình: 10/10 ca đã qua.
- Trang chủ và UI kit: 5/5 ca đã qua. Các ca chụp màn hình chỉ tạo ảnh để đối chiếu, không phải kiểm thử visual regression.
- Tài khoản khách: 2/3 ca đã qua; ca mở hộp thư thông báo vẫn chưa qua khi chạy riêng. Đăng ký, đăng nhập và mở panel thành công, nhưng fetch thông báo thất bại khi server bị OOM; bộ đếm `oom_kill` tăng từ 9 lên 10 trong lượt cuối.
- API storefront: 1/1 ca đã qua trong lượt riêng sau khi lượt ghép bị OOM. Chưa có một lượt chạy toàn bộ 68 ca thành công trên cùng server.
- Kiểm tra toàn storefront phát hiện một expectation cũ: nút “Quay lại trang quản trị” được triển khai trỏ tới `/admin`, nhưng test mong `/admin/orders`. Đã sửa expectation về đúng `/admin`, vẫn giữ các bước xác minh đăng nhập và thu hồi cookie khi đăng xuất.

Tổng cộng 67/68 ca E2E đã được xác nhận qua các đợt chạy, không phải một lượt suite toàn bộ thành công. Ca thông báo khách chưa được xác nhận; cần chạy lại trên môi trường đủ RAM trước khi kết luận toàn bộ E2E đã qua. Báo cáo HTML của nhóm lưu admin nằm ở `playwright-report/save-admin/index.html`, có ảnh toast trên mobile đính kèm.

### Máy ít RAM

Khi chạy toàn bộ E2E với Turbopack, server dev bị hệ điều hành kết thúc do thiếu RAM: telemetry ghi nhận RSS server hơn 3 GB và bộ đếm `oom_kill` của session tăng từ 4 lên 5 ngay khi server biến mất. Đổi sang Webpack và tắt Node source maps cũng không giải quyết được OOM, nên không giữ các cấu hình thử nghiệm này. Các luồng được kiểm tra theo nhóm với server mới; ca chưa hoàn tất được ghi rõ thay vì đánh dấu qua. Không suy ra mọi luồng ứng dụng đều đúng chỉ từ việc server bị OOM.
