# Chứng cứ phát hành bảo mật Online Store (Release Evidence)

**Ngày lập:** 07/09/2026  
**Nhánh:** `feat/pos-core`  
**Kế hoạch thực hiện:** `docs/superpowers/plans/2026-09-07-online-store-security-hardening.md`  
**Nguồn đánh giá rủi ro:** `docs/security/2026-09-07-online-store-security-assessment.md`  
**Chính sách lưu trữ:** `docs/security/online-store-data-retention.md`

---

## 1. Tóm tắt kết quả Quality Gate

Toàn bộ các lệnh kiểm thử và kiểm tra chất lượng theo yêu cầu của **Final release gate** đã được thực thi và đạt 100% tiêu chuẩn chất lượng (tất cả đều xanh):

| Lệnh kiểm tra                                                     | Kết quả  | Chi tiết                                                                              |
| :---------------------------------------------------------------- | :------- | :------------------------------------------------------------------------------------ |
| `pnpm exec prettier --check .`                                    | **PASS** | Toàn bộ các file trong kho mã nguồn tuân thủ Prettier code style                      |
| `pnpm lint`                                                       | **PASS** | ESLint chạy không phát hiện cảnh báo hoặc lỗi                                         |
| `pnpm typecheck`                                                  | **PASS** | TypeScript `tsc --noEmit` không có lỗi kiểu                                           |
| `pnpm test` (Vitest)                                              | **PASS** | 75 test files, **486/486 unit và integration tests pass**                             |
| `pnpm build`                                                      | **PASS** | Next.js 16.2.4 (Turbopack) build production tối ưu hoàn tất, 24 static/dynamic routes |
| `pnpm test:e2e` (Playwright)                                      | **PASS** | **26/26 E2E tests pass** trên 12 workers song song                                    |
| `pnpm exec tsx scripts/apply-online-store-retention.ts --dry-run` | **PASS** | Script chạy độc lập, kết nối DB an toàn, không có lỗi cấu hình                        |
| `git diff --check`                                                | **PASS** | Không có lỗi trailing whitespace hoặc xung đột format                                 |
| `git status --short`                                              | **PASS** | Working tree sạch, không track file bí mật / DB thật                                  |

---

## 2. Danh sách Database Migrations & Kiểm tra Schema

Các migration được thiết kế theo nguyên tắc bổ sung (additive), bảo toàn dữ liệu POS hiện hữu và không phá vỡ logic bán âm của POS:

1. **`20260907100000_online_checkout_idempotency`**:
   - Thêm bảng `CheckoutIdempotency` quản lý khóa idempotent theo `clientId`, lưu `requestFingerprint`, `responsePayload`, `recoveryDigest`, `encryptedGuestToken`, `recoveredAt` và thời gian hết hạn `expiresAt`.
2. **`20260907110000_public_receipt_nonce`**:
   - Thêm cột `receiptNonceHash` (unique, nullable) vào bảng `Order`, đảm bảo tra cứu biên nhận công khai bằng token 256-bit unguessable thay vì mã tuần tự.
3. **`20260907120000_revocable_admin_sessions`**:
   - Thêm bảng `AdminIdentity`, `AdminSession` (lưu token digest, `expiresAt`, `idleExpiresAt`, `revokedAt`) và `AdminAuditEvent` phục vụ audit thao tác quản trị.
4. **`20260907140000_order_retention_fields`**:
   - Bổ sung `anonymizedAt` và `legalHold` vào bảng `Order` phục vụ chu kỳ lưu trữ và ẩn danh dữ liệu khách hàng.

---

## 3. Kiểm định Cấu hình Biến môi trường (Environment Validation)

- **Fail-closed trong môi trường Production**: Hệ thống kiểm tra nghiêm ngặt qua `src/config/env.ts` trước khi phục vụ bất kỳ traffic nào:
  - Bắt buộc `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`.
  - Bắt buộc `RATE_LIMIT_KEY_SECRET` có độ dài tối thiểu 32 ký tự.
  - Bắt buộc `TRUSTED_PROXY_MODE` phải được cấu hình (từ chối `none`), kèm header tương ứng nếu dùng `custom`.
  - Bắt buộc `CANONICAL_ORIGIN` hợp lệ để chống CSRF.
  - Bắt buộc `STORE_PASSWORD_HASH` có định dạng PBKDF2 (`salt:derived`), loại bỏ hoàn toàn fallback mật khẩu mặc định (khắc phục phát hiện P1).
- **Phân tách môi trường Test/Build**: Build phase có cơ chế nạp biến build-time an toàn; Test suite nạp fixture độc lập qua Playwright và vitest setup.

---

## 4. Kiểm thử Rate Limit Phân tán & Hành vi Fail-Closed

- Sử dụng Redis REST limiter (`src/server/security/rate-limit.ts`) với hashing ẩn danh HMAC-SHA256 (`src/server/security/rate-limit-policy.ts`).
- Không lưu IP thật, số điện thoại, mật khẩu hoặc cookie trong key Redis hoặc telemetry.
- **Fail-closed**: Khi Redis gặp sự cố kết nối hoặc phản hồi không hợp lệ, hệ thống trả về mã `503 Service Unavailable` cùng header `Cache-Control: private, no-store` cho các endpoint nhạy cảm (checkout, customer auth, admin login).
- Đã kiểm thử đa thực thể (multi-instance simulation) chứng minh không thể vượt qua rate limit bằng cách gửi luân phiên tới các app instance khác nhau.

---

## 5. Ma trận Đối chiếu Phát hiện Bảo mật (Traceability Matrix)

| Mã phát hiện  | Mức độ | Commit thực hiện                           | File kiểm thử chính                                                                        |     Trạng thái      |
| :------------ | :----: | :----------------------------------------- | :----------------------------------------------------------------------------------------- | :-----------------: |
| `SEC-POS-H01` |   P0   | `85e790b`, `18bc278`                       | `tests/server/http/read-json-body.test.ts`, `tests/server/security/checkout-abuse.test.ts` | **Đã xử lý & Pass** |
| `SEC-POS-H02` |   P0   | `c84e701`                                  | `tests/server/orders/online-stock-concurrency.test.ts`                                     | **Đã xử lý & Pass** |
| `SEC-POS-H03` |   P0   | `50e9e15`, `342f14f`, `0b60928`, `41b7666` | `tests/server/http/client-ip.test.ts`, `tests/server/security/rate-limit.test.ts`          | **Đã xử lý & Pass** |
| `SEC-POS-M01` |   P2   | `8709a9a`                                  | `tests/server/auth/session.test.ts`                                                        | **Đã xử lý & Pass** |
| `SEC-POS-M02` |   P1   | `19c42fc`                                  | `tests/server/auth/admin-order-authorization.test.ts`                                      | **Đã xử lý & Pass** |
| `SEC-POS-M03` |   P1   | `7c1cf9c`                                  | `tests/server/http/origin.test.ts`                                                         | **Đã xử lý & Pass** |
| `SEC-POS-M04` |   P1   | `ead5d73`                                  | `tests/server/orders/public-receipt.test.ts`                                               | **Đã xử lý & Pass** |
| `SEC-POS-M05` | P1/P2  | `63429a5`, `9627964`, `eb73d06`            | `tests/server/orders/order-access.test.ts`, `tests/lib/log-redaction.test.ts`              | **Đã xử lý & Pass** |
| `SEC-POS-M06` |   P1   | `63429a5`                                  | `tests/server/orders/online-order-idempotency.test.ts`                                     | **Đã xử lý & Pass** |
| `SEC-POS-M07` |   P1   | `74c7678`                                  | `tests/config/csp.test.ts`                                                                 | **Đã xử lý & Pass** |
| `SEC-POS-L01` |   P2   | `f72bafe`                                  | `tests/server/customer-auth/register.test.ts`                                              | **Đã xử lý & Pass** |
| `SEC-POS-L02` |   P1   | `9627964`                                  | `tests/lib/log-redaction.test.ts`, `tests/config/sentry-redaction.test.ts`                 | **Đã xử lý & Pass** |
| `SEC-POS-L03` |   P2   | `aa72684`                                  | `tests/server/privacy/retention.test.ts`                                                   | **Đã xử lý & Pass** |
| `SEC-POS-L04` |   P2   | `f72bafe`                                  | `tests/server/customer-auth/register.test.ts`                                              | **Đã xử lý & Pass** |

### Các điểm khắc phục bổ sung trong đợt Review Release Gate

| Finding                                 | Mức độ | Commit thực hiện     | Nội dung khắc phục                                                                                             |
| :-------------------------------------- | :----: | :------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Review P1: Default Password Hash**    |   P1   | `de99720`            | Bắt buộc `STORE_PASSWORD_HASH` trong production, bỏ hardcoded fallback khỏi `POST /api/auth/login`.            |
| **Review P1: Admin Bootstrap Race**     |   P1   | `f2469f6`            | `ensureDefaultAdminIdentity()` dùng `upsert` và bắt `P2002`, kèm seed identity mặc định.                       |
| **Review P2: Atomic One-Time Recovery** |   P2   | `55ed0e7`            | Recovery guest capability dùng conditional `updateMany` với `recoveredAt: null` và xóa ciphertext sau consume. |
| **Review P2: Retention Standalone Run** |   P2   | `53bb4eb`, `978e35b` | Script retention nạp biến môi trường độc lập qua Node native `process.loadEnvFile`.                            |
| **Review P3: Code Formatting Quality**  |   P3   | `69e59aa`            | Định dạng toàn bộ 414 file bằng Prettier theo chuẩn dự án.                                                     |

---

## 6. Vận hành, Kích hoạt Khẩn cấp & Rollback

1. **Công tắc Content Security Policy (CSP)**:
   - Biến môi trường `CSP_MODE`: Có thể chuyển đổi ngay lập tức giữa `report-only`, `enforce` hoặc `disabled` mà không cần sửa code.
2. **Thu hồi khẩn cấp Admin Session**:
   - Gọi `revokeAllAdminSessions(identityId)` để vô hiệu hóa ngay lập tức toàn bộ session đang mở của quản trị viên khi phát hiện rò rỉ cookie hoặc thiết bị.
3. **Dịch vụ Lưu trữ & Ẩn danh PII**:
   - `pnpm exec tsx scripts/apply-online-store-retention.ts --dry-run` để kiểm tra trước số lượng bản ghi đến hạn.
   - Thêm cờ `--execute` khi thực thi xóa/ẩn danh chính thức theo quy trình định kỳ.
4. **Quy trình Rollback**:
   - Nếu hạ tầng Redis hoặc proxy gặp sự cố: Cấu hình cổng gateway tạm đóng checkout/login công khai; database không bị hỏng do mọi thao tác đều là transaction nguyên tử.
   - Cơ sở dữ liệu sử dụng migrations additive, hoàn toàn tương thích ngược với phiên bản trước đó.

---

## 7. Xác nhận Hoàn tất & Ký duyệt (Sign-off)

- [x] Toàn bộ 14 rủi ro bảo mật P0, P1, P2 và các điểm review đã được khắc phục hoàn toàn.
- [x] 100% các lệnh quality gate (Prettier, Lint, Typecheck, Vitest, Build, Playwright E2E) đều đạt trạng thái xanh.
- [x] Nhánh hiện tại là `feat/pos-core`, mã nguồn sạch sẽ, không chứa secrets hay dữ liệu cá nhân.
- [x] Sẵn sàng phát hành lên nhánh chính thức.
