import { createDecipheriv, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat, rm, link, mkdtemp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const [source, destination] = process.argv.slice(2);
if (!source || !destination || !process.env.BACKUP_ENCRYPTION_PASSWORD) {
  console.error(
    "Cách dùng: BACKUP_ENCRYPTION_PASSWORD=... node scripts/decrypt-backup.mjs input.enc output.archive.gz",
  );
  process.exit(1);
}

let file;
try {
  const { size } = await stat(source);
  if (size < 52) throw new Error("Tệp sao lưu không hợp lệ");
  file = await open(source, "r");
  const header = Buffer.alloc(36);
  const tag = Buffer.alloc(16);
  await file.read(header, 0, 36, 0);
  await file.read(tag, 0, 16, size - 16);
  if (header.subarray(0, 8).toString() !== "DQRBACK1")
    throw new Error("Định dạng sao lưu không hợp lệ");
  const key = scryptSync(
    process.env.BACKUP_ENCRYPTION_PASSWORD,
    header.subarray(8, 24),
    32,
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    header.subarray(24, 36),
  );
  decipher.setAuthTag(tag);
  await file.close();
  file = null;
  // Write to a private temporary file; never expose a partially decrypted archive.
  const directory = await mkdtemp(join(dirname(destination), ".restore-"));
  const temporary = join(directory, "archive.gz");
  try {
    await pipeline(
      createReadStream(source, { start: 36, end: size - 17 }),
      decipher,
      createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    );
    await link(temporary, destination);
    console.log(`Đã giải mã: ${destination}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
} catch {
  console.error(
    "Giải mã thất bại: kiểm tra mật khẩu, tệp đầu vào và đường dẫn đầu ra.",
  );
  process.exitCode = 1;
} finally {
  await file?.close();
}
