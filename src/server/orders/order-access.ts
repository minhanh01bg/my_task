import { digestOpaqueToken } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import { canonicalizeVietnamesePhone } from "@/types/customer-auth";

export const GUEST_CAPABILITY_LIFETIME_DAYS = 7;
export const GUEST_CAPABILITY_LIFETIME_MS =
  GUEST_CAPABILITY_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export const customerOrderSelect = {
  id: true,
  code: true,
  createdAt: true,
  status: true,
  total: true,
  fulfillmentStatus: true,
  fulfillmentType: true,
  paymentMethod: true,
  contactName: true,
  contactPhone: true,
  deliveryAddress: true,
  deliveryWard: true,
  deliveryDistrict: true,
  deliveryProvince: true,
  note: true,
  items: {
    select: {
      id: true,
      nameSnapshot: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
} as const;

export function listCustomerOrders(accountId: string) {
  return prisma.order.findMany({
    where: { customerAccountId: accountId, channel: "online" },
    orderBy: { createdAt: "desc" },
    select: customerOrderSelect,
  });
}

export function findOwnedCustomerOrder(accountId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerAccountId: accountId, channel: "online" },
    select: customerOrderSelect,
  });
}

export function findGuestOrder(token: string) {
  return prisma.guestOrderAccess.findFirst({
    where: {
      tokenHash: digestOpaqueToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { order: { select: customerOrderSelect } },
  });
}

export interface ClaimGuestOrderParams {
  customerAccountId: string;
  guestToken: string;
}

export type ClaimGuestOrderResult =
  | { ok: true; orderId: string }
  | { ok: false };

/**
 * Atomically claims an unowned guest order to an authenticated, verified customer account.
 * Rejects wrong, expired, revoked, already claimed, or phone-mismatched tokens
 * with indistinguishable outcomes.
 */
export async function claimGuestOrder(
  params: ClaimGuestOrderParams,
): Promise<ClaimGuestOrderResult> {
  // 1. Verify customer account exists and phone is verified
  const account = await prisma.customerAccount.findUnique({
    where: { id: params.customerAccountId, disabledAt: null },
    select: { id: true, phoneNormalized: true, phoneVerifiedAt: true },
  });

  if (!account || !account.phoneVerifiedAt) {
    return { ok: false };
  }

  const tokenHash = digestOpaqueToken(params.guestToken);

  return prisma.$transaction(async (tx) => {
    // 2. Locate active guest access capability
    const guestAccess = await tx.guestOrderAccess.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, orderId: true },
    });

    if (!guestAccess) {
      return { ok: false };
    }

    // 3. Ensure order is unowned
    const order = await tx.order.findUnique({
      where: { id: guestAccess.orderId },
      select: { id: true, customerAccountId: true, contactPhone: true },
    });

    if (!order || order.customerAccountId !== null) {
      return { ok: false };
    }

    // 4. Strong ownership proof: phone verification match
    if (order.contactPhone) {
      const normalizedContactPhone = canonicalizeVietnamesePhone(
        order.contactPhone,
      );
      if (normalizedContactPhone !== account.phoneNormalized) {
        return { ok: false };
      }
    }

    // 5. Atomically attach order to account
    const updateCount = await tx.order.updateMany({
      where: {
        id: order.id,
        customerAccountId: null,
      },
      data: {
        customerAccountId: account.id,
      },
    });

    if (updateCount.count !== 1) {
      return { ok: false };
    }

    // 6. Revoke guest access capability immediately
    await tx.guestOrderAccess.update({
      where: { id: guestAccess.id },
      data: { revokedAt: new Date() },
    });

    // 7. Clear guest capability recovery from idempotency
    await tx.checkoutIdempotency.updateMany({
      where: { orderId: order.id },
      data: { encryptedGuestToken: null },
    });

    return { ok: true, orderId: order.id };
  });
}

export interface RevokeGuestAccessParams {
  customerAccountId: string;
  orderId: string;
}

export type RevokeGuestAccessResult = { ok: boolean };

/**
 * Allows the verified order owner to explicitly revoke any remaining guest capability
 * so the old guest URL immediately stops working.
 */
export async function revokeGuestAccess(
  params: RevokeGuestAccessParams,
): Promise<RevokeGuestAccessResult> {
  return prisma.$transaction(async (tx) => {
    // Verify caller owns this order
    const order = await tx.order.findFirst({
      where: {
        id: params.orderId,
        customerAccountId: params.customerAccountId,
      },
      select: { id: true },
    });

    if (!order) {
      return { ok: false };
    }

    // Revoke any active guest capabilities
    await tx.guestOrderAccess.updateMany({
      where: {
        orderId: params.orderId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Clear encrypted recovery state
    await tx.checkoutIdempotency.updateMany({
      where: { orderId: params.orderId },
      data: { encryptedGuestToken: null },
    });

    return { ok: true };
  });
}

/**
 * Cleans up expired guest access records and stale idempotency recovery digests.
 */
export async function cleanupExpiredGuestAccess(): Promise<{
  deletedAccess: number;
  deletedIdempotency: number;
}> {
  const now = new Date();
  const [accessResult, idempResult] = await Promise.all([
    prisma.guestOrderAccess.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.checkoutIdempotency.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
  ]);

  return {
    deletedAccess: accessResult.count,
    deletedIdempotency: idempResult.count,
  };
}
