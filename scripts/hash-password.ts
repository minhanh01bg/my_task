import { pbkdf2, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { promisify } from "node:util";

/*
 * Sinh hash cho STORE_PASSWORD_HASH / OWNER_PASSWORD_HASH. Mật khẩu đọc từ
 * stdin, không nhận qua tham số (lộ trong lịch sử shell và danh sách tiến
 * trình). Chỉ hash ra stdout; lời nhắc và lỗi ra stderr.
 *
 * Cố ý không import app (src/config/env.ts): script phải chạy được cả khi env
 * hiện tại bị từ chối, vì đó chính là lúc cần sinh hash mới. Định dạng phải
 * khớp hashPassword trong src/server/auth/session.ts (có test đối chiếu).
 */
const PBKDF2_ITERATIONS = 600_000;
const MIN_LENGTH = 8;
// Như TRIVIAL_PASSWORDS trong src/config/env.ts: production từ chối các hash này.
const TRIVIAL_PASSWORDS = ["123456", "12345678", "password", "admin"];
const USAGE = [
  "Dùng: pnpm tsx scripts/hash-password.ts   (nhập mật khẩu khi được hỏi)",
  "  hoặc qua stdin: printf '%s\\n' \"$MAT_KHAU\" | pnpm tsx scripts/hash-password.ts",
].join("\n");

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await promisify(pbkdf2)(
    password,
    salt,
    PBKDF2_ITERATIONS,
    32,
    "sha256",
  );
  return `pbkdf2-sha256:${PBKDF2_ITERATIONS}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Hỏi hai lần trên terminal, không hiện ký tự gõ. `null` nếu hai lần khác nhau. */
async function askTwiceHidden(): Promise<string | null> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stderr.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  rl.on("SIGINT", () => {
    process.stderr.write("\n");
    process.exit(130);
  });
  const ask = async (prompt: string) => {
    muted = false;
    const answer = rl.question(prompt);
    muted = true;
    const value = await answer;
    process.stderr.write("\n");
    return value;
  };
  try {
    const first = await ask("Nhập mật khẩu: ");
    const second = await ask("Nhập lại mật khẩu: ");
    return first === second ? first : null;
  } finally {
    rl.close();
  }
}

/** Dòng đầu của stdin (pipe), bỏ ký tự xuống dòng, giữ nguyên khoảng trắng. */
async function readPiped(): Promise<string> {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0];
}

async function main(): Promise<number> {
  if (process.argv.length > 2) {
    console.error(
      "Không nhận mật khẩu qua tham số dòng lệnh (lộ trong lịch sử shell và danh sách tiến trình).",
    );
    console.error(USAGE);
    return 1;
  }

  let password: string;
  if (process.stdin.isTTY) {
    const answer = await askTwiceHidden();
    if (answer === null) {
      console.error("Hai lần nhập không khớp, chưa tạo hash.");
      return 1;
    }
    password = answer;
  } else {
    password = await readPiped();
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Mật khẩu phải có ít nhất ${MIN_LENGTH} ký tự.`);
    return 1;
  }
  if (TRIVIAL_PASSWORDS.includes(password)) {
    console.error(
      "Mật khẩu quá dễ đoán, production sẽ từ chối hash này. Hãy chọn mật khẩu khác.",
    );
    return 1;
  }

  console.log(await hash(password));
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
