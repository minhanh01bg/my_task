# Địa chỉ hiện hành và rà trang Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Sửa danh mục địa chỉ cũ và kiểm chứng mọi trang điều hướng hiện có.

**Architecture:** Snapshot danh mục Cục Thống kê ngày 06/10/2026: 34 đơn vị cấp tỉnh, 3321 xã/phường/đặc khu với mã cha cấp tỉnh. Checkout mới chọn hai cấp, API đối chiếu mã/tên/quan hệ. Địa chỉ đơn cũ giữ nguyên và quận/huyện trong payload cũ vẫn là thông tin lịch sử tùy chọn.

**Tech Stack:** Next.js 16.3.8, React 19, Zod 4, Vitest, Playwright, Prisma SQLite.

**Spec:** Yêu cầu và thiết kế giới hạn trong cuộc trao đổi với người dùng ngày 06/10/2026.

## Global Constraints

- Node 22, pnpm 10.28.2; copy UI tiếng Việt.
- Không viết DB production khi kiểm thử; không đổi địa chỉ đơn lịch sử.
- Không ghi đè dist đang chạy; production E2E dùng copy build và DB riêng.

## Task 1: Danh mục và contract

- [x] Viết test RED: 34 tỉnh, phường Bắc Giang thuộc mã 24, không cần huyện; từ chối mã/tên sai và mã huyện cũ.
- [x] Snapshot JSON từ export Cục Thống kê, kiểm tra mã duy nhất/cha hợp lệ/count và ghi nguồn.
- [x] Thay lookup/validation tỉnh-xã; bỏ yêu cầu deliveryDistrict trong schema, giữ trường lịch sử tùy chọn.
- [x] Chạy test library/schema trước commit scoped.

## Task 2: Checkout hai cấp

- [x] Test RED chọn tỉnh → xã trực tiếp; đổi tỉnh reset xã; summary/payload không huyện; nhập tay hai cấp.
- [x] Sửa AddressFields và CheckoutForm, chỉ hiển thị tỉnh/xã/đường.
- [x] Test component, API tạo đơn và production E2E giao hàng địa chỉ Bắc Giang mới.
- [x] Commit UI riêng khi đạt.

## Task 3: Rà trang và triển khai

- [x] Rà liên kết tĩnh/động; smoke public pages, E2E admin sidebar với login fixture.
- [x] Ghi các workflow còn thiếu, không tạo trang rỗng để che chức năng chưa có.
- [x] pnpm check và build riêng; E2E production; review và preview smoke.
- [x] Triển khai artifact đã kiểm chứng, HTTPS smoke/chunks.
- [x] QA commit và push: c21da5b (snapshot), 9941c14 (checkout), a793742 (audit) đã lên origin/main.
