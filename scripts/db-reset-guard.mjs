// `pnpm db:reset` xóa sạch DB rồi seed lại. Script chặn trước khi chạy:
// - NODE_ENV=production: luôn từ chối.
// - DATABASE_URL phải có sẵn trong môi trường. Script không đọc .env: nếu thiếu,
//   Prisma sẽ tự lấy từ .env (trên server là DB thật) mà không ai thấy trước.
// - Phải xác nhận bằng CONFIRM_DB_RESET=1 hoặc --yes; chỉ in đường dẫn file DB.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { getDatabasePath } from "./backup-db.mjs";

const COMMANDS = [
  ["pnpm", ["exec", "prisma", "db", "push", "--force-reset"]],
  ["pnpm", ["db:seed"]],
];

export function resetTarget(env = process.env, argv = process.argv.slice(2)) {
  if (env.NODE_ENV === "production") {
    throw new Error("NODE_ENV=production: không reset DB.");
  }
  if (!env.DATABASE_URL) {
    throw new Error(
      "Đặt DATABASE_URL trong môi trường (vd DATABASE_URL=file:./dev.db) để biết DB nào bị xóa; script không đọc .env.",
    );
  }
  const path = getDatabasePath(env.DATABASE_URL);
  if (env.CONFIRM_DB_RESET !== "1" && !argv.includes("--yes")) {
    throw new Error(
      `Lệnh sẽ XÓA toàn bộ dữ liệu trong ${path}. Chạy lại với CONFIRM_DB_RESET=1 hoặc --yes.`,
    );
  }
  return path;
}

function run(command, args, env) {
  return spawnSync(command, args, { stdio: "inherit", env }).status ?? 1;
}

export function main({
  env = process.env,
  argv = process.argv.slice(2),
  exec = run,
  log = console.log,
  error = console.error,
} = {}) {
  let path;
  try {
    path = resetTarget(env, argv);
  } catch (refusal) {
    error(refusal.message);
    return 1;
  }
  log(`Reset DB: ${path}`);
  for (const [command, args] of COMMANDS) {
    const status = exec(command, args, env);
    if (status !== 0) return status;
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
