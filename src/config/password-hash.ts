import { pbkdf2Sync } from "node:crypto";

/**
 * Hash PBKDF2-SHA256 của mật khẩu quản trị. scripts/hash-password.ts sinh
 * `pbkdf2-sha256:<số vòng>:<salt>:<derived>` (hex); định dạng cũ
 * `salt:derived` (100k vòng) vẫn dùng được. Dùng `:` thay vì `$` vì Next nội
 * suy `$...` trong file .env.
 *
 * Module thuần (không đọc env khi import) để scripts/check-auth.ts chẩn đoán
 * được cả khi env.ts từ chối khởi động.
 */
const PASSWORD_HASH_PATTERN =
  /^pbkdf2-sha256:([1-9][0-9]{0,6}):([0-9a-fA-F]{32}):([0-9a-fA-F]{64})$/;
const LEGACY_PASSWORD_HASH_PATTERN = /^([0-9a-fA-F]{32}):([0-9a-fA-F]{64})$/;
export const LEGACY_PBKDF2_ITERATIONS = 100_000;
// Chặn số vòng quá lớn: hash lỗi không được làm treo mỗi lần đăng nhập.
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 5_000_000;

export interface ParsedPasswordHash {
  iterations: number;
  saltHex: string;
  derivedHex: string;
}

/** Tách hash mật khẩu; `null` nếu sai định dạng hoặc số vòng ngoài khoảng. */
export function parsePasswordHash(hash: string): ParsedPasswordHash | null {
  const legacy = LEGACY_PASSWORD_HASH_PATTERN.exec(hash);
  if (legacy) {
    return {
      iterations: LEGACY_PBKDF2_ITERATIONS,
      saltHex: legacy[1],
      derivedHex: legacy[2].toLowerCase(),
    };
  }
  const match = PASSWORD_HASH_PATTERN.exec(hash);
  if (!match) return null;
  const iterations = Number(match[1]);
  if (
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    return null;
  }
  return {
    iterations,
    saltHex: match[2],
    derivedHex: match[3].toLowerCase(),
  };
}

export const PASSWORD_HASH_FORMAT =
  "pbkdf2-sha256:<iterations>:<salt>:<derived> (or legacy salt:derived) PBKDF2 hash";

/** Hai hash cùng số vòng, salt và derived (bỏ qua hoa/thường) là một. */
export function passwordHashKey(hash: ParsedPasswordHash): string {
  return `${hash.iterations}:${hash.saltHex.toLowerCase()}:${hash.derivedHex}`;
}

/**
 * Hash từng nằm trong repo (fixture e2e/test, hướng dẫn cũ của
 * scripts/check-auth.ts cho mật khẩu 123456, dummy lúc build): ai cũng có.
 */
const PUBLISHED_PASSWORD_HASHES = new Set(
  [
    "68bb3ab56e351d4e7e72bf8c511d76ab:cf3f01b0fa3356ff68c7d6856efc470e1b1031cb897f22ceed954207f0379db0",
    "714989c4f592fda0ff69a63ef217e4b0:98dcc3f54f21aa15273f4836302084e830fa296f505bc7187ca79c022470fc0b",
    "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000",
    "0f1e2d3c4b5a69788796a5b4c3d2e1f0:1111111111111111111111111111111111111111111111111111111111111111",
  ].map((hash) => passwordHashKey(parsePasswordHash(hash)!)),
);
const TRIVIAL_PASSWORDS = ["123456", "12345678", "password", "admin"];

// Next có thể nạp module này ở nhiều bundle server trong cùng tiến trình:
// mỗi hash chỉ tốn PBKDF2 một lần.
const cacheHost = globalThis as unknown as Record<
  symbol,
  Map<string, boolean> | undefined
>;
const weakHashCache = (cacheHost[Symbol.for("env.weakPasswordHashes")] ??=
  new Map());

/** Hash mẫu đã công khai, hoặc hash của một mật khẩu dễ đoán. */
export function isWeakPasswordHash(hash: ParsedPasswordHash): boolean {
  const key = passwordHashKey(hash);
  if (PUBLISHED_PASSWORD_HASHES.has(key)) return true;
  let weak = weakHashCache.get(key);
  if (weak === undefined) {
    const salt = Buffer.from(hash.saltHex, "hex");
    weak = TRIVIAL_PASSWORDS.some(
      (password) =>
        pbkdf2Sync(password, salt, hash.iterations, 32, "sha256").toString(
          "hex",
        ) === hash.derivedHex,
    );
    weakHashCache.set(key, weak);
  }
  return weak;
}
