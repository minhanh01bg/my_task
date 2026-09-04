import { env } from "@/config/env";

export const SESSION_COOKIE = "pos_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** So sanh hai chuoi hex trong thoi gian hang so — tranh timing attack. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt);
  return `${toHex(salt.buffer)}:${derived}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [saltHex, expected] = hash.split(":");
  if (!saltHex || !expected) return false;
  const derived = await derive(password, fromHex(saltHex));
  return safeEqual(derived, expected);
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toHex(signature);
}

export async function signSession(payload: {
  issuedAt: number;
}): Promise<string> {
  const body = String(payload.issuedAt);
  return `${body}.${await hmac(body)}`;
}

/**
 * Phien song 30 ngay va KHONG tu het han giua ca ban — dang xuat luc dang
 * co khach la loi nghiem trong.
 */
export async function verifySession(token: string): Promise<boolean> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = await hmac(body);
  if (!safeEqual(signature, expected)) return false;

  const issuedAt = Number(body);
  if (!Number.isFinite(issuedAt)) return false;

  const ageSeconds = (Date.now() - issuedAt) / 1000;
  return ageSeconds >= 0 && ageSeconds < SESSION_MAX_AGE_SECONDS;
}
