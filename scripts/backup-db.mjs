import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const TELEGRAM_LIMIT = 49_000_000;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIRECTORY = join(homedir(), ".local/state/my-task-backups");

export async function loadBackupConfig(file = join(ROOT, ".env.backup")) {
  const values = parseEnv(await readFile(file, "utf8"));
  for (const key of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "BACKUP_ENCRYPTION_PASSWORD",
  ]) {
    if (!values[key]) throw new Error(`Thiếu ${key} trong .env.backup`);
  }
  if (values.BACKUP_ENCRYPTION_PASSWORD.length < 16) {
    throw new Error("BACKUP_ENCRYPTION_PASSWORD phải dài ít nhất 16 ký tự");
  }
  return values;
}

export function getDatabasePath(url, root = ROOT) {
  if (!url?.startsWith("file:"))
    throw new Error("DATABASE_URL phải là SQLite (file:).");
  const path = url.slice(5).split("?")[0];
  if (!path) throw new Error("Đường dẫn SQLite trống.");
  return isAbsolute(path) ? path : resolve(root, "prisma", path);
}

// Format: DQRBACK1 (8 bytes) | salt (16) | nonce (12) | ciphertext | GCM tag (16).
export async function encryptArchive(source, destination, password) {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    scryptSync(password, salt, 32),
    nonce,
  );
  const output = createWriteStream(destination, { mode: 0o600, flags: "wx" });
  async function* encrypted() {
    yield Buffer.concat([Buffer.from("DQRBACK1"), salt, nonce]);
    for await (const chunk of source) yield cipher.update(chunk);
    yield cipher.final();
    yield cipher.getAuthTag();
  }
  await pipeline(encrypted(), output);
}

export async function telegram(method, fields, token, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      body: fields,
      signal: AbortSignal.timeout(180_000),
    },
  );
  // Never include Telegram's response in logs: it may contain sensitive details.
  if (!response.ok)
    throw new Error(`Telegram ${method} thất bại (HTTP ${response.status})`);
  const result = await response.json();
  if (!result.ok || (method === "sendDocument" && !result.result?.document)) {
    throw new Error(`Telegram ${method} chưa xác nhận thành công.`);
  }
  return result.result;
}

async function notify(token, chatId, message, fetchImpl = fetch) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("text", message);
  await telegram("sendMessage", form, token, fetchImpl);
}

export async function pruneBackups(directory) {
  const cutoff = Date.now() - 7 * 86400 * 1000;
  for (const name of await readdir(directory)) {
    if (!/^shop-backup-.*\.sqlite3\.gz\.enc$/.test(name)) continue;
    const path = join(directory, name);
    const marker = `${path}.sent`;
    try {
      if (
        !(await stat(marker)).isFile() ||
        (await stat(path)).mtimeMs >= cutoff
      )
        continue;
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    await rm(path);
    await rm(marker);
  }
}

export async function backup({
  noSend = false,
  directory = BACKUP_DIRECTORY,
  configFile = join(ROOT, ".env.backup"),
  databaseUrl,
  fetchImpl = fetch,
} = {}) {
  const configValues = await loadBackupConfig(configFile);
  let output;
  let encrypted = false;
  try {
    const url =
      databaseUrl ??
      configValues.DATABASE_URL ??
      parseEnv(await readFile(join(ROOT, ".env"), "utf8")).DATABASE_URL;
    const source = getDatabasePath(url);
    await mkdir(directory, { mode: 0o700, recursive: true });
    await chmod(directory, 0o700);
    const filename = `shop-backup-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.sqlite3.gz.enc`;
    output = join(directory, filename);
    const dump = spawn(
      "/usr/bin/python3",
      [join(ROOT, "scripts/sqlite-snapshot.py"), source],
      {
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const finished = new Promise((resolve, reject) => {
      dump.once("error", () => reject(new Error("SQLite snapshot thất bại")));
      dump.once("close", (code) =>
        code === 0 ? resolve() : reject(new Error("SQLite snapshot thất bại")),
      );
    });
    const outcome = finished.then(
      () => null,
      (error) => error,
    );
    try {
      await encryptArchive(
        dump.stdout,
        output,
        configValues.BACKUP_ENCRYPTION_PASSWORD,
      );
    } catch (error) {
      dump.kill();
      await outcome;
      throw error;
    }
    const dumpError = await outcome;
    if (dumpError) throw dumpError;
    encrypted = true;
    const size = (await stat(output)).size;
    if (noSend) {
      console.log(
        `Đã kiểm tra và mã hóa ${filename} (${size} bytes), chưa gửi Telegram.`,
      );
      return output;
    }
    if (size > TELEGRAM_LIMIT)
      throw new Error("Bản sao lưu vượt giới hạn Telegram.");
    const form = new FormData();
    form.set("chat_id", configValues.TELEGRAM_CHAT_ID);
    form.set(
      "caption",
      `Sao lưu SQLite Tạp hóa Tuấn Toàn - ${new Date().toISOString()} (${size} bytes). Lưu mật khẩu mã hóa riêng.`,
    );
    form.set("document", new Blob([await readFile(output)]), filename);
    await telegram(
      "sendDocument",
      form,
      configValues.TELEGRAM_BOT_TOKEN,
      fetchImpl,
    );
    await writeFile(`${output}.sent`, "", { mode: 0o600, flag: "wx" });
    await pruneBackups(directory);
    console.log(
      `Đã gửi bản sao lưu mã hóa ${filename} (${size} bytes) lên Telegram.`,
    );
    return output;
  } catch {
    if (output && !encrypted) await rm(output, { force: true });
    try {
      if (!noSend)
        await notify(
          configValues.TELEGRAM_BOT_TOKEN,
          configValues.TELEGRAM_CHAT_ID,
          `❌ Sao lưu SQLite Tạp hóa Tuấn Toàn thất bại (${new Date().toISOString()}). Kiểm tra service/log trên máy chủ.`,
          fetchImpl,
        );
    } catch {
      console.error("Không gửi được cảnh báo Telegram.");
    }
    throw new Error(
      "Sao lưu thất bại; kiểm tra SQLite, cấu hình và kết nối Telegram. Bản mã hóa hoàn chỉnh được giữ trên máy nếu gửi lỗi.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.umask(0o077);
  if (!process.argv.includes("--locked")) {
    await mkdir(BACKUP_DIRECTORY, { mode: 0o700, recursive: true });
    const child = spawn(
      "/usr/bin/flock",
      [
        "-n",
        join(BACKUP_DIRECTORY, ".lock"),
        process.execPath,
        fileURLToPath(import.meta.url),
        "--locked",
        ...process.argv.slice(2),
      ],
      { stdio: "inherit" },
    );
    child.once("error", () => {
      console.error("Không khởi chạy được khóa backup.");
      process.exitCode = 1;
    });
    child.once("close", (code) => {
      process.exitCode = code ?? 1;
    });
  } else {
    backup({ noSend: process.argv.includes("--no-send") }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
