// @vitest-environment node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/session";

// `node --import tsx` thay vi CLI tsx: CLI mo IPC socket, khong can o day.
const SCRIPT = [
  process.execPath,
  "--import",
  "tsx",
  "scripts/hash-password.ts",
];
const HASH = /pbkdf2-sha256:600000:[0-9a-f]{32}:[0-9a-f]{64}/;
const HAS_PTY = process.platform === "linux" && existsSync("/usr/bin/script");

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Chay script voi stdin la pipe (nhu khi tu dong hoa). */
function runPiped(input: string, args: string[] = []): Promise<Result> {
  return new Promise((resolve, reject) => {
    const child = spawn(SCRIPT[0], [...SCRIPT.slice(1), ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    // Script co the thoat truoc khi doc stdin (vd khi tu choi tham so).
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

/**
 * Chay script trong pty (util-linux `script`) va go tung cau tra loi sau moi
 * loi nhac, nhu nguoi dung o terminal. stdout va stderr gop chung qua pty.
 */
function runInTerminal(answers: string[]): Promise<Result> {
  return new Promise((resolve, reject) => {
    const command = SCRIPT.map((part) => JSON.stringify(part)).join(" ");
    const child = spawn("script", ["-qec", command, "/dev/null"]);
    let stdout = "";
    let answered = 0;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const prompts = stdout.split("mật khẩu: ").length - 1;
      while (answered < prompts && answered < answers.length) {
        child.stdin.write(`${answers[answered]}\r`);
        answered += 1;
      }
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr: "" }));
  });
}

describe("scripts/hash-password.ts", () => {
  it("hashes a password piped on stdin into the format hashPassword emits", async () => {
    const result = await runPiped("mat-khau-cua-hang-moi\n");

    expect(result.code).toBe(0);
    const hash = result.stdout.trim();
    expect(hash).toMatch(new RegExp(`^${HASH.source}$`));
    expect(hash.split(":").slice(0, 2)).toEqual(
      (await hashPassword("bat-ky")).split(":").slice(0, 2),
    );
    expect(await verifyPassword("mat-khau-cua-hang-moi", hash)).toBe(true);
    expect(result.stdout + result.stderr).not.toContain(
      "mat-khau-cua-hang-moi",
    );
  }, 60_000);

  it("keeps spaces but strips the line ending", async () => {
    const result = await runPiped("  co dau cach  \r\n");

    expect(result.code).toBe(0);
    expect(await verifyPassword("  co dau cach  ", result.stdout.trim())).toBe(
      true,
    );
  }, 60_000);

  it("refuses a password shorter than 8 characters", async () => {
    const result = await runPiped("1234567\n");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("ít nhất 8 ký tự");
    expect(result.stdout).toBe("");
  }, 60_000);

  it.each(["12345678", "password"])(
    "refuses the well-known password %s that production rejects",
    async (password) => {
      const result = await runPiped(`${password}\n`);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("dễ đoán");
      expect(result.stdout).toBe("");
    },
    60_000,
  );

  it("refuses a password given on the command line", async () => {
    const result = await runPiped("", ["mat-khau-tren-dong-lenh"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Không nhận mật khẩu qua tham số");
    expect(result.stdout).toBe("");
  }, 60_000);

  it.skipIf(!HAS_PTY)(
    "prompts twice on a terminal without echoing the password",
    async () => {
      const result = await runInTerminal([
        "mat-khau-tren-terminal",
        "mat-khau-tren-terminal",
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Nhập lại mật khẩu: ");
      expect(result.stdout).not.toContain("mat-khau-tren-terminal");
      const hash = HASH.exec(result.stdout)?.[0];
      expect(hash).toBeDefined();
      expect(await verifyPassword("mat-khau-tren-terminal", hash!)).toBe(true);
    },
    60_000,
  );

  it.skipIf(!HAS_PTY)(
    "refuses on a terminal when the two entries differ",
    async () => {
      const result = await runInTerminal([
        "mat-khau-lan-mot",
        "mat-khau-lan-hai",
      ]);

      expect(result.code).toBe(1);
      expect(result.stdout).toContain("không khớp");
      expect(result.stdout).not.toMatch(HASH);
    },
    60_000,
  );
});
