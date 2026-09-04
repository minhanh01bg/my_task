import { hashPassword } from "../src/server/auth/session";

const password = process.argv[2];

if (!password) {
  console.error("Usage: pnpm tsx scripts/hash-password.ts <mat khau>");
  process.exit(1);
}

hashPassword(password).then((hash) => {
  console.log(hash);
});
