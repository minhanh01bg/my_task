import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import { resolveTrustedClientIp } from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";

export interface PublicReceipt {
  code: string;
  total: number;
  paymentMethod: string | null;
}

let defaultReceiptLimiter: RateLimiter | null = null;
export function setReceiptRateLimiter(limiter: RateLimiter | null): void {
  defaultReceiptLimiter = limiter;
}

function getReceiptLimiter(): RateLimiter {
  if (defaultReceiptLimiter) return defaultReceiptLimiter;
  defaultReceiptLimiter = createRateLimiter();
  return defaultReceiptLimiter;
}

export function createReceiptNonce(): { nonce: string; nonceHash: string } {
  const nonce = randomBytes(32).toString("hex");
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  return { nonce, nonceHash };
}

export function isValidReceiptNonce(nonce: string): boolean {
  if (typeof nonce !== "string") return false;
  return /^[0-9a-fA-F]{64}$/.test(nonce);
}

export async function getPublicReceipt(
  nonce: string,
  request?: Request,
): Promise<PublicReceipt | null> {
  // Layer 1: Strict 256-bit format validation (reject sequential codes, non-hex immediately)
  if (!isValidReceiptNonce(nonce)) {
    return null;
  }

  // Layer 2: Lightweight rate limit check on lookup misses/enumeration
  const limiter = getReceiptLimiter();
  if (request) {
    const ipResolution = resolveTrustedClientIp(request);
    if (ipResolution.ok) {
      const { ip, subnet } = ipResolution;
      const rateLimitResult = await limiter.check(POLICIES.receiptLookup, [
        { bucketName: "ip-misses", dimension: "ip", identifier: ip },
        {
          bucketName: "subnet-misses",
          dimension: "subnet",
          identifier: subnet,
        },
      ]);
      if (!rateLimitResult.allowed) {
        const error = new Error(
          "Quá nhiều yêu cầu tra cứu biên nhận. Vui lòng thử lại sau.",
        );
        Object.assign(error, { status: 429 });
        throw error;
      }
    }
  }

  const hash = createHash("sha256").update(nonce.toLowerCase()).digest("hex");

  const order = await prisma.order.findUnique({
    where: { receiptNonceHash: hash },
    select: {
      code: true,
      total: true,
      paymentMethod: true,
      channel: true,
    },
  });

  if (!order || order.channel !== "online") {
    return null;
  }

  return {
    code: order.code,
    total: order.total,
    paymentMethod: order.paymentMethod,
  };
}
