import assert from "node:assert/strict";
import { createDecipheriv, scryptSync } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  readdir,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  backup,
  encryptArchive,
  getDatabasePath,
  loadBackupConfig,
  pruneBackups,
} from "./backup-db.mjs";

test("cấu hình backup riêng ghi đè biến đang chạy; không đọc .env ứng dụng", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-config-test-"));
  try {
    const file = join(dir, ".env.backup");
    await writeFile(
      file,
      'MONGODB_URI="mongodb://host/backup_db"\nTELEGRAM_BOT_TOKEN="backup-token"\nTELEGRAM_CHAT_ID="123"\nBACKUP_ENCRYPTION_PASSWORD="abcdefghijklmnop"\n',
    );
    const config = await loadBackupConfig(file);
    assert.equal(config.TELEGRAM_BOT_TOKEN, "backup-token");
    assert.equal(config.TELEGRAM_BOT_TOKEN, "backup-token");
    assert.equal(config.TELEGRAM_CHAT_ID, "123");
    assert.equal(config.BACKUP_ENCRYPTION_PASSWORD, "abcdefghijklmnop");
    await writeFile(file, 'MONGODB_URI="mongodb://host/backup_db"\n');
    await assert.rejects(loadBackupConfig(file), /TELEGRAM_BOT_TOKEN/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("đọc đường dẫn SQLite của Prisma, từ chối MongoDB", () => {
  assert.equal(
    getDatabasePath("file:./dev.db", "/project"),
    "/project/prisma/dev.db",
  );
  assert.equal(
    getDatabasePath("file:/data/live.db", "/project"),
    "/data/live.db",
  );
  assert.throws(
    () => getDatabasePath("mongodb://host/admin", "/project"),
    /SQLite/,
  );
});

test("mã hóa archive theo luồng và xác thực bằng AES-256-GCM", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-test-"));
  try {
    const file = join(dir, "dump.enc");
    await encryptArchive(
      Readable.from([Buffer.from("mongo archive")]),
      file,
      "a strong password",
    );
    const data = await readFile(file);
    assert.equal(data.subarray(0, 8).toString(), "DQRBACK1");
    const key = scryptSync("a strong password", data.subarray(8, 24), 32);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      data.subarray(24, 36),
    );
    decipher.setAuthTag(data.subarray(data.length - 16));
    assert.equal(
      Buffer.concat([
        decipher.update(data.subarray(36, -16)),
        decipher.final(),
      ]).toString(),
      "mongo archive",
    );
    assert.throws(() => {
      const wrong = createDecipheriv(
        "aes-256-gcm",
        scryptSync("wrong", data.subarray(8, 24), 32),
        data.subarray(24, 36),
      );
      wrong.setAuthTag(data.subarray(-16));
      wrong.update(data.subarray(36, -16));
      wrong.final();
    });
    const restored = join(dir, "restored.archive.gz");
    const decoded = spawnSync(
      process.execPath,
      ["scripts/decrypt-backup.mjs", file, restored],
      {
        env: {
          ...process.env,
          BACKUP_ENCRYPTION_PASSWORD: "a strong password",
        },
      },
    );
    assert.equal(decoded.status, 0, decoded.stderr.toString());
    assert.equal((await readFile(restored)).toString(), "mongo archive");
    const invalid = join(dir, "invalid.archive.gz");
    const rejected = spawnSync(
      process.execPath,
      ["scripts/decrypt-backup.mjs", file, invalid],
      {
        env: { ...process.env, BACKUP_ENCRYPTION_PASSWORD: "wrong password" },
      },
    );
    assert.equal(rejected.status, 1);
    await assert.rejects(readFile(invalid), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), "sqlite-backup-test-"));
  try {
    const configFile = join(dir, ".env.backup");
    await writeFile(
      configFile,
      "TELEGRAM_BOT_TOKEN=secret-token\nTELEGRAM_CHAT_ID=123\nBACKUP_ENCRYPTION_PASSWORD=abcdefghijklmnop\n",
    );
    const source = join(dir, "live.db");
    const created = spawnSync("/usr/bin/python3", [
      "-c",
      'import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); db.execute("CREATE TABLE orders(amount INTEGER)"); db.execute("INSERT INTO orders VALUES(120000)"); db.commit(); db.close()',
      source,
    ]);
    assert.equal(created.status, 0);
    await run({
      dir,
      configFile,
      databaseUrl: `file:${source}`,
      directory: join(dir, "backups"),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("sao lưu SQLite thật, gửi Telegram và khôi phục đúng số tiền", async () => {
  await fixture(async (options) => {
    const calls = [];
    const output = await backup({
      ...options,
      fetchImpl: async (url, request) => {
        calls.push(url.split("/").at(-1));
        assert.equal(request.body.get("chat_id"), "123");
        assert.ok(request.body.get("document") instanceof Blob);
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { document: { file_id: "abc" } },
          }),
        };
      },
    });
    assert.deepEqual(calls, ["sendDocument"]);
    await readFile(`${output}.sent`);
    const restored = join(options.dir, "restored.gz");
    const decoded = spawnSync(
      process.execPath,
      ["scripts/decrypt-backup.mjs", output, restored],
      {
        env: { ...process.env, BACKUP_ENCRYPTION_PASSWORD: "abcdefghijklmnop" },
      },
    );
    assert.equal(decoded.status, 0);
    const verified = spawnSync("/usr/bin/python3", [
      "-c",
      'import gzip,sqlite3,sys,pathlib; data=gzip.open(sys.argv[1],"rb").read(); path=pathlib.Path(sys.argv[1]+".db"); path.write_bytes(data); db=sqlite3.connect(path); assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"; assert db.execute("SELECT amount FROM orders").fetchone()[0]==120000',
      restored,
    ]);
    assert.equal(verified.status, 0, verified.stderr.toString());
  });
});

test("gửi lỗi thì giữ bản mã hóa, gửi cảnh báo và không lộ token", async () => {
  await fixture(async (options) => {
    const calls = [];
    await assert.rejects(
      backup({
        ...options,
        fetchImpl: async (url) => {
          const method = url.split("/").at(-1);
          calls.push(method);
          if (method === "sendDocument") throw new Error("secret-token");
          return { ok: true, json: async () => ({ ok: true }) };
        },
      }),
      (error) => !error.message.includes("secret-token"),
    );
    assert.deepEqual(calls, ["sendDocument", "sendMessage"]);
    const files = await readdir(options.directory);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(".enc"));
  });
});

test("snapshot lỗi thì không gửi file hoặc giữ archive không hoàn chỉnh", async () => {
  await fixture(async (options) => {
    const calls = [];
    await assert.rejects(
      backup({
        ...options,
        databaseUrl: `file:${join(options.dir, "missing.db")}`,
        fetchImpl: async (url) => {
          calls.push(url.split("/").at(-1));
          return { ok: true, json: async () => ({ ok: true }) };
        },
      }),
    );
    assert.deepEqual(calls, ["sendMessage"]);
    assert.deepEqual(await readdir(options.directory), []);
  });
});

test("chỉ xóa backup quá 7 ngày đã gửi thành công", async () => {
  await fixture(async ({ directory }) => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(directory);
    for (const name of [
      "shop-backup-old.sqlite3.gz.enc",
      "shop-backup-unsent.sqlite3.gz.enc",
      "other.enc",
    ]) {
      const path = join(directory, name);
      await writeFile(path, "data");
      await utimes(path, 1, 1);
    }
    await writeFile(join(directory, "shop-backup-old.sqlite3.gz.enc.sent"), "");
    await pruneBackups(directory);
    assert.deepEqual((await readdir(directory)).sort(), [
      "other.enc",
      "shop-backup-unsent.sqlite3.gz.enc",
    ]);
  });
});

test("file bị sửa hoặc mật khẩu sai không tạo bản giải mã; không ghi đè file hiện có", async () => {
  await fixture(async ({ dir }) => {
    const encrypted = join(dir, "archive.enc");
    await encryptArchive(
      Readable.from([Buffer.from("private data")]),
      encrypted,
      "abcdefghijklmnop",
    );
    const destination = join(dir, "restored.gz");
    await writeFile(destination, "existing");
    let result = spawnSync(
      process.execPath,
      ["scripts/decrypt-backup.mjs", encrypted, destination],
      {
        env: { ...process.env, BACKUP_ENCRYPTION_PASSWORD: "abcdefghijklmnop" },
      },
    );
    assert.equal(result.status, 1);
    assert.equal((await readFile(destination)).toString(), "existing");
    await rm(destination);
    const changed = await readFile(encrypted);
    changed[36] ^= 1;
    await writeFile(encrypted, changed);
    result = spawnSync(
      process.execPath,
      ["scripts/decrypt-backup.mjs", encrypted, destination],
      {
        env: { ...process.env, BACKUP_ENCRYPTION_PASSWORD: "abcdefghijklmnop" },
      },
    );
    assert.equal(result.status, 1);
    await assert.rejects(readFile(destination), { code: "ENOENT" });
    assert.ok(
      !(await readdir(dir)).some((name) => name.startsWith(".restore-")),
    );
  });
});
