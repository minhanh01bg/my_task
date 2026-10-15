# <Tên tính năng> Implementation Plan

> **For agentic workers:** Thực hiện từng task theo thứ tự; tick checkbox khi xong. Mỗi task: test RED → code GREEN → `scripts/agent/verify.sh --fast` → `scripts/agent/ship.sh`.

**Goal:** <một câu: người dùng nhận được gì>

**Architecture:** <2-4 câu: module/route/server path chạm tới, dữ liệu đi đâu, invariant cần giữ (cache tag, create-order, saveProduct, tx-only…)>

**Tech Stack:** Next.js 16, React 19, Prisma SQLite, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md` | Yêu cầu trong trao đổi với người dùng ngày DD/MM/YYYY.

## Global Constraints

- Tuân thủ `AGENTS.md`; copy tiếng Việt; tiền VND số nguyên; không cài thêm dependency trừ khi được duyệt.
- Ghi dữ liệu qua đường duy nhất (`create-order.ts`, `saveProduct()`); `revalidatePublic(...)` sau commit transaction.
- Không ghi DB production; không ghi đè distDir đang chạy; E2E dùng `scripts/agent/e2e.sh`.
- <ràng buộc riêng của task: route giữ nguyên, không đổi hành vi tính tiền, …>

## Task 1: <tên ngắn — phụ thuộc thấp nhất trước (schema/lib → server → UI → E2E)>

**Files:** Create `<path>`; Modify `<path>`; Test `tests/<path>.test.ts`.

- [ ] RED: viết test thất bại cho <hành vi>, chạy `scripts/agent/verify.sh --test tests/<path>.test.ts` thấy fail đúng lý do.
- [ ] GREEN: <thay đổi tối thiểu>.
- [ ] Verify: `scripts/agent/verify.sh --fast`.
- [ ] Commit: `scripts/agent/ship.sh --no-push -m "feat(<scope>): <subject>" -- <files>`.

## Task 2: <…phụ thuộc Task 1>

**Files:** …

- [ ] RED: …
- [ ] GREEN: …
- [ ] Verify + commit `fix(<scope>): …`.

## Task N: Kiểm chứng cuối và push

- [ ] `scripts/agent/verify.sh` (full); E2E liên quan: `scripts/agent/e2e.sh e2e/<spec>.spec.ts`.
- [ ] Production-only thay đổi (cache/ISR/proxy): `scripts/agent/release.sh build` + `scripts/agent/e2e.sh --prod <dir>`; `release.sh promote` chỉ khi người dùng đồng ý.
- [ ] Push nhánh hiện tại (`scripts/agent/ship.sh` commit cuối không `--no-push`); ghi sha vào mục Execution status.

## Execution status

<điền khi xong: kết quả verify/E2E, commit sha, việc còn thiếu/chưa kiểm chứng>
