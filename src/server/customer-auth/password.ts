import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

function scrypt(
  password: string,
  salt: Buffer,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    nodeScrypt(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
const VERSION = "scrypt-v1";
const KEY_LENGTH = 64;
const OPTIONS = { N: 16_384, r: 8, p: 1 } as const;

export async function hashCustomerPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, OPTIONS);
  return [
    VERSION,
    OPTIONS.N,
    OPTIONS.r,
    OPTIONS.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyCustomerPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [version, n, r, p, saltText, digestText] = encoded.split("$");
  if (version !== VERSION || !saltText || !digestText) return false;
  const expected = Buffer.from(digestText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const actual = await scrypt(password, Buffer.from(saltText, "base64url"), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
