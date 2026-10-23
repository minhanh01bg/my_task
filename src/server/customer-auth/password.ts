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
// OWASP minimum for 16 MiB of memory (N=2^14, r=8 needs that much); older
// hashes carry their own parameters and are upgraded at the next login.
const OPTIONS = { N: 16_384, r: 8, p: 5 } as const;

/**
 * Hash of a random, discarded password made with OPTIONS. Login verifies
 * against it when the phone has no usable account, so a missing or disabled
 * account costs the same scrypt run as a real one. Regenerate it whenever
 * OPTIONS change.
 */
export const DUMMY_CUSTOMER_PASSWORD_HASH =
  "scrypt-v1$16384$8$5$WkFjaaqL1kZ2Dp8KqdnJ_g$7zB0e-lej6KcTOFaxDA9_mz3YQbNnRbEsi4fksQFutjaEWPTLGK8Yz_qqQikLOLeK4S0zvN-uD7rklxIWIcqoQ";

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
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  try {
    const salt = Buffer.from(saltText, "base64url");
    const actual = await scrypt(password, salt, params);
    // Cost grows linearly with p: top a not-yet-upgraded hash up to the
    // current cost so its wrong guesses take as long as the dummy hash's.
    if (
      params.N === OPTIONS.N &&
      params.r === OPTIONS.r &&
      params.p < OPTIONS.p
    ) {
      await scrypt(password, salt, { ...OPTIONS, p: OPTIONS.p - params.p });
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True when a hash was made with other parameters than new hashes use. */
export function customerPasswordNeedsRehash(encoded: string): boolean {
  const [version, n, r, p] = encoded.split("$");
  return (
    version !== VERSION ||
    Number(n) !== OPTIONS.N ||
    Number(r) !== OPTIONS.r ||
    Number(p) !== OPTIONS.p
  );
}
