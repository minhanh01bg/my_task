import { prisma } from "../src/server/db/prisma";
import {
  ensureDefaultAdminIdentity,
  verifyPassword,
} from "../src/server/auth/session";

async function main() {
  console.log("==========================================");
  console.log("🔍 KIỂM TRA HỆ THỐNG ĐĂNG NHẬP AN PHÁT POS");
  console.log("==========================================\n");

  // 1. Kiểm tra biến môi trường
  console.log("1️⃣ Kiểm tra Environment Variables:");
  const hash = process.env.STORE_PASSWORD_HASH;
  const dbUrl = process.env.DATABASE_URL;

  console.log(
    `   - DATABASE_URL: ${dbUrl || "(Chưa đặt, mặc định file:./dev.db)"}`,
  );
  if (!hash) {
    console.log("   ❌ STORE_PASSWORD_HASH: CHƯA CẤU HÌNH!");
    console.log("      👉 Hãy thêm vào file .env trên server:");
    console.log(
      '      STORE_PASSWORD_HASH="68bb3ab56e351d4e7e72bf8c511d76ab:cf3f01b0fa3356ff68c7d6856efc470e1b1031cb897f22ceed954207f0379db0"',
    );
  } else {
    console.log(
      `   ✅ STORE_PASSWORD_HASH: Đã cấu hình (${hash.slice(0, 16)}...)`,
    );
    const is123456Valid = await verifyPassword("123456", hash);
    if (is123456Valid) {
      console.log("   ✅ Mật khẩu '123456': HỢP LỆ VÀ KHỚP HASH");
    } else {
      console.log("   ⚠️ Mật khẩu '123456': KHÔNG KHỚP với hash hiện tại.");
    }
  }

  // 1b. Kiểm tra Upstash Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  if (redisUrl) {
    if (
      redisUrl.includes("your-upstash-redis") ||
      redisUrl.includes("example.com")
    ) {
      console.log(
        "   ⚠️ UPSTASH_REDIS_REST_URL: ĐANG DÙNG URL MẪU ('your-upstash-redis')!",
      );
      console.log(
        "      👉 Khuyên dùng: Hãy xóa hoặc comment lại dòng UPSTASH_REDIS_REST_URL trong .env để dùng bộ nhớ RAM.",
      );
    } else {
      console.log(`   ✅ UPSTASH_REDIS_REST_URL: Đã cấu hình (${redisUrl})`);
    }
  } else {
    console.log(
      "   ℹ️ UPSTASH_REDIS: Không dùng (sử dụng In-Memory Store an toàn cho dev)",
    );
  }

  // 2. Kiểm tra Database & Admin Identity
  console.log("\n2️⃣ Kiểm tra Database SQLite:");
  try {
    const admin = await ensureDefaultAdminIdentity();
    console.log(`   ✅ Kết nối Database thành công!`);
    console.log(
      `   ✅ Tài khoản Admin: '${admin.username}' (id: ${admin.id}, role: ${admin.role})`,
    );

    const sessionCount = await prisma.adminSession.count();
    console.log(`   ✅ Số phiên đăng nhập hiện có trong DB: ${sessionCount}`);
  } catch (err) {
    console.error("   ❌ Lỗi kết nối hoặc bảng cơ sở dữ liệu chưa sẵn sàng:");
    console.error(err);
    console.log("   👉 Hãy chạy: pnpm db:push");
  }

  console.log("\n==========================================");
  console.log("💡 HƯỚNG DẪN KHẮC PHỤC NẾU VẪN KHÔNG ĐĂNG NHẬP ĐƯỢC:");
  console.log("1. Kéo code mới nhất: git pull origin feat/pos-core");
  console.log("2. Đảm bảo file .env trên server có dòng STORE_PASSWORD_HASH:");
  console.log(
    '   STORE_PASSWORD_HASH="68bb3ab56e351d4e7e72bf8c511d76ab:cf3f01b0fa3356ff68c7d6856efc470e1b1031cb897f22ceed954207f0379db0"',
  );
  console.log(
    "3. KHỞI ĐỘNG LẠI DEV SERVER: Tắt terminal chạy pnpm dev và chạy lại `pnpm dev`",
  );
  console.log("   (Next.js không tự nạp biến .env mới nếu không restart)");
  console.log("4. Đăng nhập với mật khẩu: 123456");
  console.log("==========================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
