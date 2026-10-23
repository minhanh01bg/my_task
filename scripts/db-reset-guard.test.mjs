import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, resetTarget } from "./db-reset-guard.mjs";

function capture(options) {
  const commands = [];
  const errors = [];
  const logs = [];
  const status = main({
    exec: (command, args) => {
      commands.push([command, ...args].join(" "));
      return 0;
    },
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
    ...options,
  });
  return { status, commands, errors, logs };
}

test("không xác nhận thì không chạy gì, nhưng cho biết file sẽ bị xóa", () => {
  const { status, commands, errors } = capture({
    env: { DATABASE_URL: "file:/data/dev.db?connection_limit=1" },
    argv: [],
  });
  assert.equal(status, 1);
  assert.deepEqual(commands, []);
  assert.match(errors.join("\n"), /\/data\/dev\.db/);
  assert.match(errors.join("\n"), /CONFIRM_DB_RESET=1|--yes/);
  assert.doesNotMatch(errors.join("\n"), /connection_limit/);
});

test("CONFIRM_DB_RESET=1 hoặc --yes thì reset rồi seed", () => {
  for (const options of [
    { env: { DATABASE_URL: "file:./dev.db", CONFIRM_DB_RESET: "1" }, argv: [] },
    { env: { DATABASE_URL: "file:./dev.db" }, argv: ["--yes"] },
  ]) {
    const { status, commands, logs } = capture(options);
    assert.equal(status, 0);
    assert.deepEqual(commands, [
      "pnpm exec prisma db push --force-reset",
      "pnpm db:seed",
    ]);
    assert.match(logs.join("\n"), /prisma\/dev\.db$/m);
  }
});

test("NODE_ENV=production luôn từ chối, kể cả khi đã xác nhận", () => {
  const { status, commands, errors } = capture({
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "file:./live.db",
      CONFIRM_DB_RESET: "1",
    },
    argv: ["--yes"],
  });
  assert.equal(status, 1);
  assert.deepEqual(commands, []);
  assert.match(errors.join("\n"), /production/);
});

test("thiếu DATABASE_URL trong môi trường thì từ chối, không đọc .env", () => {
  assert.throws(
    () => resetTarget({ CONFIRM_DB_RESET: "1" }, []),
    /DATABASE_URL/,
  );
});

test("DATABASE_URL không phải SQLite thì từ chối và không in URL", () => {
  const { status, commands, errors } = capture({
    env: {
      DATABASE_URL: "postgresql://user:hunter2@db/app",
      CONFIRM_DB_RESET: "1",
    },
    argv: [],
  });
  assert.equal(status, 1);
  assert.deepEqual(commands, []);
  assert.doesNotMatch(errors.join("\n"), /hunter2/);
});

test("prisma lỗi thì dừng, không seed", () => {
  const commands = [];
  const status = main({
    env: { DATABASE_URL: "file:./dev.db", CONFIRM_DB_RESET: "1" },
    argv: [],
    exec: (command, args) => {
      commands.push(args[0]);
      return 2;
    },
    log: () => {},
    error: () => {},
  });
  assert.equal(status, 2);
  assert.deepEqual(commands, ["exec"]);
});

test("CLI: thư mục có .env nhưng môi trường không có DATABASE_URL thì từ chối", async () => {
  const dir = await mkdtemp(join(tmpdir(), "db-reset-guard-"));
  try {
    await writeFile(join(dir, ".env"), "DATABASE_URL=file:./live.db\n");
    const env = { ...process.env, CONFIRM_DB_RESET: "1" };
    delete env.DATABASE_URL;
    delete env.NODE_ENV;
    const result = spawnSync(
      process.execPath,
      [join(import.meta.dirname, "db-reset-guard.mjs")],
      { cwd: dir, env, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
