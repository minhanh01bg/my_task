---
name: verify
description: Run lint + typecheck + Vitest (the `pnpm check` gate) with compact output. Use after editing code in this repo and before committing, whenever you would otherwise run `pnpm check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` or `pnpm exec vitest run <file>` by hand, or to re-run one failing test file / test name.
---

# verify

Một lệnh thay cho `pnpm check`; chỉ in ✓/✗ mỗi bước + lỗi rút gọn. Dòng cuối luôn là
`VERIFY PASS` hoặc `VERIFY FAIL: <steps>` (exit 0/1).

## Chọn lệnh

| Tình huống                    | Lệnh                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Vòng lặp khi đang sửa code    | `scripts/agent/verify.sh --fast`                                              |
| Chạy lại 1 file / 1 case test | `scripts/agent/verify.sh --test tests/lib/money.test.ts [-t "dung dau cham"]` |
| Chỉ một bước                  | `--only lint` / `--only types` / `--only test` (lặp được)                     |
| Trước khi commit / bàn giao   | `scripts/agent/verify.sh` (đầy đủ, giống `pnpm check`)                        |
| Muốn thấy mọi lỗi một lượt    | thêm `--continue` (mặc định dừng ở bước fail đầu tiên)                        |
| Kiểm tra Prettier file đổi    | thêm `--format`                                                               |

- `--fast`: eslint chỉ file đổi so với HEAD (kể cả untracked), `vitest --changed HEAD`
  (chạy cả test phụ thuộc file đổi, có thể vẫn nhiều), tsc luôn chạy toàn bộ.
- Thời gian tham khảo (máy đang tải): lint ~25s, tsc ~10–40s, 1 file test ~5s,
  toàn bộ vitest 4–9 phút. Chạy lệnh dài với timeout ≥ 600000 ms.

## Đọc output

- lint: `» file:line:col message [rule]` — chỉ error; warning chỉ được đếm.
- types: `» file(line,col): error TSxxxx: msg` (đã dedupe, tối đa 30 dòng; `VERIFY_MAX=N` để đổi).
- test: `» FAIL file:line > suite test` + 1–3 dòng message; `(suite)` = file không load được.
- `(no parsed errors; tail of log)` = crash/setup lỗi; đọc thêm log được in đường dẫn.
- Log đầy đủ + `eslint.json`/`vitest.json`: `.agent-logs/<run-id>/`. Chỉ mở khi cần
  (vd. diff Expected/Received đầy đủ: `grep -n -A20 'FAIL' .agent-logs/<id>/test.log`).
- `AGENT_VERBOSE=1` in toàn bộ log (tốn token, tránh dùng).

## Khi fail

1. Sửa đúng file/dòng được báo, chạy lại hẹp nhất có thể (`--test <file>`, `--only types`).
2. Pass rồi mới chạy lại `--fast` hoặc full trước khi commit (skill `ship`).
3. Lỗi thuộc WIP không liên quan đến task: báo lại cho user, không tự sửa lan man.

## Bất biến

- Vitest global setup push schema vào `prisma/test.db` và các file chạy tuần tự:
  không chạy 2 lần verify/vitest song song.
- Script không build, không chạy Playwright (dùng skill `e2e`), không đụng `.next*`.
- Không thêm `--passWithNoTests`/bỏ qua test để ép PASS; `--test`/`-t` không khớp test nào = FAIL.
