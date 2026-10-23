import {
  isWeakPasswordHash,
  type ParsedPasswordHash,
  parsePasswordHash,
  passwordHashKey,
} from "../src/config/env";
import { prisma } from "../src/server/db/prisma";
import { ensureDefaultAdminIdentity } from "../src/server/auth/session";

const HASH_COMMAND = "pnpm tsx scripts/hash-password.ts";

/** Chỉ hiện hai nhãn cuối của host (vd ***.upstash.io): tên database là bí mật. */
function maskedHost(url: string): string {
  try {
    const labels = new URL(url).hostname.split(".");
    return labels.length > 2 ? `***.${labels.slice(-2).join(".")}` : "***";
  } catch {
    return "***";
  }
}

/** Chỉ báo trạng thái của hash; không in hash hay mật khẩu nào. */
function reportPasswordHash(
  name: string,
  hash: string | undefined,
  missingHint: string,
): ParsedPasswordHash | null {
  if (!hash) {
    console.log(`   ❌ ${name}: CHƯA CẤU HÌNH (${missingHint})`);
    console.log(
      `      👉 Tạo hash bằng: ${HASH_COMMAND} rồi đặt ${name} trong biến môi trường của server.`,
    );
    return null;
  }
  const parsed = parsePasswordHash(hash);
  if (!parsed) {
    console.log(
      `   ❌ ${name}: SAI ĐỊNH DẠNG (cần pbkdf2-sha256:<số vòng>:<salt>:<derived>)`,
    );
    console.log(`      👉 Tạo lại bằng: ${HASH_COMMAND}`);
    return null;
  }
  console.log(
    `   ✅ ${name}: Đã cấu hình, đúng định dạng (${parsed.iterations} vòng PBKDF2)`,
  );
  if (!hash.startsWith("pbkdf2-sha256:")) {
    console.log(
      `      ⚠️ Định dạng cũ salt:derived — nên tạo lại bằng ${HASH_COMMAND}.`,
    );
  }
  if (isWeakPasswordHash(parsed)) {
    console.log(
      `   ❌ ${name}: là hash mẫu đã công khai hoặc của mật khẩu dễ đoán — production sẽ từ chối khởi động.`,
    );
    console.log(`      👉 Đặt mật khẩu mới bằng: ${HASH_COMMAND}`);
  }
  return parsed;
}

async function main() {
  console.log("==========================================");
  console.log("🔍 KIỂM TRA HỆ THỐNG ĐĂNG NHẬP AN PHÁT POS");
  console.log("==========================================\n");

  // 1. Kiểm tra biến môi trường
  console.log("1️⃣ Kiểm tra Environment Variables:");
  const dbUrl = process.env.DATABASE_URL;

  console.log(
    `   - DATABASE_URL: ${dbUrl || "(Chưa đặt, mặc định file:./dev.db)"}`,
  );
  const store = reportPasswordHash(
    "STORE_PASSWORD_HASH",
    process.env.STORE_PASSWORD_HASH,
    "không đăng nhập được",
  );
  const owner = reportPasswordHash(
    "OWNER_PASSWORD_HASH",
    process.env.OWNER_PASSWORD_HASH,
    "không đổi được tài khoản nhận tiền",
  );
  if (store && owner && passwordHashKey(store) === passwordHashKey(owner)) {
    console.log(
      "   ❌ OWNER_PASSWORD_HASH: TRÙNG STORE_PASSWORD_HASH — mật khẩu chủ phải khác mật khẩu cửa hàng.",
    );
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
      console.log(
        `   ✅ UPSTASH_REDIS_REST_URL: Đã cấu hình (${maskedHost(redisUrl)})`,
      );
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
  console.log(
    `1. Tạo hash cho mật khẩu cửa hàng: ${HASH_COMMAND} (nhập mật khẩu khi được hỏi)`,
  );
  console.log(
    "2. Đặt STORE_PASSWORD_HASH (và OWNER_PASSWORD_HASH bằng một mật khẩu KHÁC) trong biến môi trường của server.",
  );
  console.log(
    "3. KHỞI ĐỘNG LẠI SERVER: Next.js chỉ nạp biến môi trường lúc khởi động.",
  );
  console.log("4. Đăng nhập bằng mật khẩu cửa hàng vừa đặt.");
  console.log("==========================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
