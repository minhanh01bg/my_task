// @vitest-environment node
import { execFile } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const run = promisify(execFile);
const FIXTURE_HASH =
  "68bb3ab56e351d4e7e72bf8c511d76ab:cf3f01b0fa3356ff68c7d6856efc470e1b1031cb897f22ceed954207f0379db0";

function hashOf(password: string) {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2-sha256:100000:${salt.toString("hex")}:${derived.toString("hex")}`;
}

const FAKE_UPSTASH_HOST = "check-auth-test-host.upstash.io";

/**
 * Chay scripts/check-auth.ts voi env tu dat. Moi bien duoc kiem tra deu co gia
 * tri (ke ca ""): Prisma nap file .env canh schema nhung khong ghi de bien da
 * co, nen script khong doc nham cau hinh that.
 */
async function checkAuth(overrides: Record<string, string>) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    STORE_PASSWORD_HASH: "",
    OWNER_PASSWORD_HASH: "",
    UPSTASH_REDIS_REST_URL: `https://${FAKE_UPSTASH_HOST}`,
    UPSTASH_REDIS_REST_TOKEN: "check-auth-test-token",
    ...overrides,
  };
  // `node --import tsx` thay vi CLI tsx: CLI mo IPC socket, khong can o day.
  const { stdout, stderr } = await run(
    process.execPath,
    ["--import", "tsx", "scripts/check-auth.ts"],
    { env, timeout: 60_000 },
  );
  return stdout + stderr;
}

describe("scripts/check-auth.ts", () => {
  it("reports configured hashes without printing them or a default password", async () => {
    const store = hashOf("mat-khau-cua-hang-rieng");
    const owner = hashOf("mat-khau-chu-rieng");

    const output = await checkAuth({
      STORE_PASSWORD_HASH: store,
      OWNER_PASSWORD_HASH: owner,
    });

    expect(output).toContain(
      "STORE_PASSWORD_HASH: Đã cấu hình, đúng định dạng",
    );
    expect(output).toContain(
      "OWNER_PASSWORD_HASH: Đã cấu hình, đúng định dạng",
    );
    for (const hash of [store, owner]) {
      expect(output).not.toContain(hash.split(":")[2]);
      expect(output).not.toContain(hash.split(":")[3]);
    }
    expect(output).not.toContain(FIXTURE_HASH.slice(0, 16));
    expect(output).not.toContain("123456");
    expect(output).toContain("scripts/hash-password.ts");
  }, 60_000);

  it("points to scripts/hash-password.ts when STORE_PASSWORD_HASH is missing", async () => {
    const output = await checkAuth({});

    expect(output).toContain("STORE_PASSWORD_HASH: CHƯA CẤU HÌNH");
    expect(output).toContain("pnpm tsx scripts/hash-password.ts");
    expect(output).not.toContain(FIXTURE_HASH.slice(0, 16));
    expect(output).not.toContain("123456");
  }, 60_000);

  it("flags a malformed hash", async () => {
    const output = await checkAuth({ STORE_PASSWORD_HASH: "khong-phai-hash" });

    expect(output).toContain("STORE_PASSWORD_HASH: SAI ĐỊNH DẠNG");
    expect(output).not.toContain("khong-phai-hash");
  }, 60_000);

  it("warns that a published fixture hash is refused in production", async () => {
    const output = await checkAuth({ STORE_PASSWORD_HASH: FIXTURE_HASH });

    expect(output).toContain(
      "STORE_PASSWORD_HASH: là hash mẫu đã công khai hoặc của mật khẩu dễ đoán",
    );
    expect(output).not.toContain(FIXTURE_HASH.slice(0, 16));
    expect(output).not.toContain("123456");
  }, 60_000);

  it("flags an owner hash identical to the store hash", async () => {
    const store = hashOf("mat-khau-cua-hang-rieng");

    const output = await checkAuth({
      STORE_PASSWORD_HASH: store,
      OWNER_PASSWORD_HASH: store,
    });

    expect(output).toContain("OWNER_PASSWORD_HASH: TRÙNG STORE_PASSWORD_HASH");
  }, 60_000);

  it("does not print the Upstash REST URL, only a masked host", async () => {
    const output = await checkAuth({
      UPSTASH_REDIS_REST_URL: `https://${FAKE_UPSTASH_HOST}/duong-dan-rieng`,
    });

    expect(output).toContain(
      "UPSTASH_REDIS_REST_URL: Đã cấu hình (***.upstash.io)",
    );
    expect(output).not.toContain("check-auth-test-host");
    expect(output).not.toContain("duong-dan-rieng");
  }, 60_000);

  it("still names the weak and the malformed hash when production would refuse to start", async () => {
    const output = await checkAuth({
      NODE_ENV: "production",
      STORE_PASSWORD_HASH: FIXTURE_HASH,
      OWNER_PASSWORD_HASH: "khong-phai-hash",
    });

    expect(output).toContain(
      "STORE_PASSWORD_HASH: là hash mẫu đã công khai hoặc của mật khẩu dễ đoán",
    );
    expect(output).toContain("OWNER_PASSWORD_HASH: SAI ĐỊNH DẠNG");
    expect(output).not.toContain(FIXTURE_HASH.slice(0, 16));
    expect(output).not.toContain(FIXTURE_HASH.slice(-16));
    expect(output).not.toContain("khong-phai-hash");
    expect(output).not.toContain("123456");
  }, 60_000);

  it("prints only the scheme and host of a server DATABASE_URL", async () => {
    const output = await checkAuth({
      DATABASE_URL:
        "postgresql://ten-dang-nhap:mat-khau-db@db.check-auth.example:5432/ten-db?sslmode=require",
    });

    expect(output).toContain(
      "DATABASE_URL: postgresql://db.check-auth.example",
    );
    for (const secret of [
      "ten-dang-nhap",
      "mat-khau-db",
      "ten-db",
      "sslmode",
      "5432",
    ]) {
      expect(output).not.toContain(secret);
    }
  }, 60_000);

  it("prints the file path of a SQLite DATABASE_URL without its parameters", async () => {
    // DB test (vitest.config.ts), de script khong tao file SQLite moi.
    const dbFile = (process.env.DATABASE_URL ?? "file:./prisma/test.db").split(
      "?",
    )[0];
    const output = await checkAuth({
      DATABASE_URL: `${dbFile}?socket_timeout=10`,
    });

    expect(output).toContain(`DATABASE_URL: ${dbFile}\n`);
    expect(output).not.toContain("socket_timeout");
  }, 60_000);
});
