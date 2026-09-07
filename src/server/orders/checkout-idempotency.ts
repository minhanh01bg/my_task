import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { OnlineCheckoutInput } from "@/types/online-order";

export const CHECKOUT_RECOVERY_COOKIE = "checkout_recovery";
export const RECOVERY_TTL_MS = 30 * 60 * 1000; // 30 minutes

const HKDF_INFO = Buffer.from("online_store_checkout_recovery_v1", "utf-8");
const HKDF_SALT = Buffer.alloc(0);

/**
 * Computes a deterministic SHA-256 fingerprint of the security-relevant
 * online checkout payload fields.
 */
export function computeCheckoutFingerprint(input: OnlineCheckoutInput): string {
  const sortedLines = [...input.lines]
    .map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const canonical = {
    contactName: (input.contactName ?? "").trim(),
    contactPhone: (input.contactPhone ?? "").trim(),
    fulfillmentType: input.fulfillmentType,
    paymentMethod: input.paymentMethod,
    deliveryAddress: (input.deliveryAddress ?? "").trim(),
    deliveryWard: (input.deliveryWard ?? "").trim(),
    deliveryDistrict: (input.deliveryDistrict ?? "").trim(),
    deliveryProvince: (input.deliveryProvince ?? "").trim(),
    note: (input.note ?? "").trim(),
    lines: sortedLines,
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Generates an unguessable recovery secret (32 bytes hex).
 */
export function createRecoverySecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes SHA-256 digest of the recovery secret for safe database persistence.
 */
export function digestRecoverySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Derives an AES-256 key from the recovery secret using HKDF-SHA256.
 */
function deriveRecoveryKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf-8"), HKDF_SALT, HKDF_INFO, 32),
  );
}

/**
 * Encrypts a guest capability token using AES-256-GCM keyed by the recovery secret.
 * Plaintext guest tokens are never stored in the database.
 */
export function encryptGuestToken(guestToken: string, secret: string): string {
  const key = deriveRecoveryKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(guestToken, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts an encrypted guest token using the recovery secret.
 * Returns null if the secret is wrong or the payload has been tampered with.
 */
export function decryptGuestToken(
  encrypted: string,
  secret: string,
): string | null {
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, tagHex, cipherHex] = parts;
    if (!ivHex || !tagHex || !cipherHex) return null;

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(cipherHex, "hex");

    if (iv.length !== 12 || tag.length !== 16) return null;

    const key = deriveRecoveryKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Safely verifies if a candidate recovery secret matches a stored digest
 * using timing-safe equality.
 */
export function verifyRecoverySecret(
  secret: string,
  expectedDigest: string,
): boolean {
  if (!secret || !expectedDigest) return false;
  const candidateDigest = digestRecoverySecret(secret);
  const candidateBuf = Buffer.from(candidateDigest, "hex");
  const expectedBuf = Buffer.from(expectedDigest, "hex");

  if (candidateBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(candidateBuf, expectedBuf);
}
