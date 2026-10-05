# nextjs-with-agent

A reusable **Next.js App Router base** with modern defaults and agent-ready skill scaffolding.

## Included

- Next.js 16 + React 19 + TypeScript (strict)
- Tailwind CSS 4 + shadcn/ui bootstrap
- React Query provider setup
- Zod-based env validation
- Reusable HTTP client + typed API response pattern
- Security headers baseline in `next.config.ts`
- ESLint + Prettier + Husky + lint-staged + Commitlint
- Vitest + Testing Library + Playwright
- CI + Release workflows (`.github/workflows/*`)
- Sentry + Vercel Analytics + Speed Insights wiring
- Agent skills under `.agents/skills/`

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000

## Scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm check
pnpm changeset
pnpm version-packages
pnpm release
```

## Prisma khi cập nhật code

`pnpm build` tự tạo lại Prisma Client từ `prisma/schema.prisma` trước khi build
Next.js. Sau khi pull code mới, client cũ trong `node_modules` sẽ được cập nhật,
kể cả khi không cài lại dependencies.

`prisma generate` chỉ tạo client, không cập nhật database. Khi triển khai thay đổi
schema, áp dụng migrations bằng `pnpm exec prisma migrate deploy` với
`DATABASE_URL` của môi trường triển khai trước khi khởi động ứng dụng mới.

## Build và kiểm chứng khi server đang chạy

Không chạy `pnpm build` vào thư mục mà `next start` đang phục vụ. Next.js giữ
manifest/module cũ trong bộ nhớ; thay file build bên dưới tiến trình đó gây
`ChunkLoadError`, HTTP 500 và lỗi MIME khi tải JavaScript.

Build vào thư mục mới (không tái sử dụng thư mục của release đang chạy):

```bash
release_dir=".next-release-$(date -u +%Y%m%d-%H%M%S)"
NEXT_DIST_DIR="$release_dir" pnpm build
NEXT_DIST_DIR="$release_dir" pnpm start --port 3110
```

Từ terminal khác, smoke test chỉ đọc dữ liệu:

```bash
node scripts/smoke-storefront.mjs http://127.0.0.1:3110
```

Kiểm tra trang đăng nhập, các chunk JavaScript, HTML/RSC danh mục và chính sách.
Sau khi kiểm chứng, đặt `Environment=NEXT_DIST_DIR=<thư mục đã kiểm chứng>` trong
drop-in của `my-task.service`, rồi `systemctl --user daemon-reload` và
`systemctl --user restart my-task.service`. Chạy lại smoke test trên cổng 3001.
Giữ thư mục release trước để có thể rollback; không xóa hoặc build đè release
đang phục vụ. Thay đổi schema phải được xử lý riêng theo hướng dẫn Prisma ở trên.

Test phân trang bằng server production (DB fixture và bản copy build riêng).
Không chạy fixture E2E trên artifact sẽ triển khai: Next lưu Data/Full Route
Cache trong thư mục build, nên DB riêng vẫn có thể làm lẫn cache test vào release.

```bash
e2e_dir=".next-e2e-$(date -u +%Y%m%d-%H%M%S)"
cp -a "$release_dir" "$e2e_dir"
DATABASE_URL=file:./prisma/production-e2e.db pnpm exec prisma db push
DATABASE_URL=file:./prisma/production-e2e.db PLAYWRIGHT_PORT=3110 PLAYWRIGHT_PRODUCTION_DIR="$e2e_dir" PLAYWRIGHT_CANONICAL_ORIGIN=http://160.250.247.137:3110 pnpm test:e2e --workers=1 -- e2e/category-navigation.spec.ts
```

Dừng server kiểm chứng cổng 3110 trước khi Playwright khởi động server của nó.
Env production vẫn phải có đầy đủ cấu hình bảo mật; test không tắt các kiểm tra đó.

## Project structure

```txt
src/
  app/
    api/health/route.ts
    global-error.tsx
    loading.tsx
    not-found.tsx
  components/
    providers/
    shared/
    ui/
  config/
  lib/
  providers/
  types/
.agents/
  skills/
```

## Notes

- This base intentionally does **not** lock in any DB/ORM.
- Add Prisma/Drizzle/Mongoose per-project as needed.
- Update `CODEOWNERS` and release config (`.changeset/config.json`) before team rollout.
