import { prisma } from "@/server/db/prisma";
import {
  computeCheckoutFingerprint,
  decryptGuestToken,
  digestRecoverySecret,
  encryptGuestToken,
  RECOVERY_TTL_MS,
  verifyRecoverySecret,
} from "@/server/orders/checkout-idempotency";
import { createReceiptNonce } from "@/server/orders/public-receipt";
import {
  OnlineOrderError,
  type OnlineCheckoutInput,
} from "@/types/online-order";
import { validateVoucher } from "@/server/vouchers/validate-voucher";

import { createOrder, type CreateOrderResult } from "./create-order";

export interface OnlineOrderAccessContext {
  customerAccountId?: string | null;
  guestAccess?: { tokenHash: string; expiresAt: Date };
  guestRecovery?: {
    secret?: string;
    guestToken?: string;
  };
}

export interface CreateOnlineOrderResult extends CreateOrderResult {
  recoveredGuestToken?: string;
  receiptNonce?: string;
}

async function replayIdempotentOrder(
  idempotency: {
    id: string;
    requestFingerprint: string;
    recoveryDigest: string | null;
    encryptedGuestToken: string | null;
    responsePayload: string;
    recoveredAt: Date | null;
    expiresAt: Date;
    order: {
      id: string;
      code: string;
      subtotal: number;
      discount: number;
      total: number;
      status: string;
      hasStockWarning: boolean;
    };
  },
  currentFingerprint: string,
  access: OnlineOrderAccessContext,
): Promise<CreateOnlineOrderResult> {
  if (idempotency.requestFingerprint !== currentFingerprint) {
    throw new OnlineOrderError(
      "IDEMPOTENCY_CONFLICT",
      "Mã giao dịch đã được sử dụng cho đơn hàng khác",
    );
  }

  let recoveredGuestToken: string | undefined;
  if (
    access.guestRecovery?.secret &&
    idempotency.recoveryDigest &&
    idempotency.encryptedGuestToken &&
    idempotency.recoveredAt === null &&
    new Date() <= idempotency.expiresAt
  ) {
    if (
      verifyRecoverySecret(
        access.guestRecovery.secret,
        idempotency.recoveryDigest,
      )
    ) {
      const decrypted = decryptGuestToken(
        idempotency.encryptedGuestToken,
        access.guestRecovery.secret,
      );
      if (decrypted) {
        // Atomic conditional update ensuring strictly one-time consumption:
        // Only the request that successfully transitions recoveredAt from null to now gets the token
        const updateResult = await prisma.checkoutIdempotency.updateMany({
          where: {
            id: idempotency.id,
            recoveredAt: null,
          },
          data: {
            recoveredAt: new Date(),
            encryptedGuestToken: null,
            recoveryDigest: null,
          },
        });
        if (updateResult.count === 1) {
          recoveredGuestToken = decrypted;
        }
      }
    }
  }

  let receiptNonce: string | undefined;
  try {
    const payload = JSON.parse(idempotency.responsePayload) as {
      receiptNonce?: string;
    };
    if (typeof payload?.receiptNonce === "string") {
      receiptNonce = payload.receiptNonce;
    }
  } catch {}

  return {
    order: idempotency.order,
    duplicated: true,
    recoveredGuestToken,
    receiptNonce,
  };
}

export async function createOnlineOrder(
  input: OnlineCheckoutInput,
  access: OnlineOrderAccessContext = {},
): Promise<CreateOnlineOrderResult> {
  const currentFingerprint = computeCheckoutFingerprint(input);

  const existingIdempotency = await prisma.checkoutIdempotency.findUnique({
    where: { clientId: input.clientId },
    include: { order: true },
  });

  if (existingIdempotency) {
    return replayIdempotentOrder(
      existingIdempotency,
      currentFingerprint,
      access,
    );
  }

  const existingOrder = await prisma.order.findUnique({
    where: { clientId: input.clientId },
  });
  if (existingOrder) {
    return {
      order: {
        id: existingOrder.id,
        code: existingOrder.code,
        subtotal: existingOrder.subtotal,
        discount: existingOrder.discount,
        total: existingOrder.total,
        status: existingOrder.status,
        hasStockWarning: existingOrder.hasStockWarning,
      },
      duplicated: true,
    };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.lines.map((line) => line.productId) } },
    select: {
      id: true,
      name: true,
      price: true,
      unit: true,
      stock: true,
      isActive: true,
      isService: true,
      deletedAt: true,
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const unavailable = input.lines
    .filter((line) => {
      const product = byId.get(line.productId);
      return (
        !product || !product.isActive || product.isService || product.deletedAt
      );
    })
    .map((line) => line.productId);
  if (unavailable.length) {
    throw new OnlineOrderError(
      "PRODUCT_UNAVAILABLE",
      "Một số sản phẩm không còn bán",
      unavailable,
    );
  }

  const outOfStock = input.lines
    .filter((line) => (byId.get(line.productId)?.stock ?? 0) < line.quantity)
    .map((line) => line.productId);
  if (outOfStock.length) {
    throw new OnlineOrderError(
      "OUT_OF_STOCK",
      "Một số sản phẩm không đủ tồn kho",
      outOfStock,
    );
  }

  const lines = input.lines.map((line) => {
    const product = byId.get(line.productId)!;
    return {
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      originalPrice: product.price,
      quantity: line.quantity,
      discount: 0,
      unit: product.unit,
      isService: false,
    };
  });
  const total = lines.reduce(
    (sum, line) => sum + Math.round(line.unitPrice * line.quantity),
    0,
  );

  let voucherDiscount = 0;
  if (input.voucherCode) {
    const voucherRes = validateVoucher(input.voucherCode, total);
    if (voucherRes.valid) {
      voucherDiscount = voucherRes.discount;
    }
  }
  const finalTotal = Math.max(0, total - voucherDiscount);

  const noteParts = [
    input.deliverySlot ? `[Khung giờ: ${input.deliverySlot}]` : null,
    input.voucherCode ? `[Voucher: ${input.voucherCode.toUpperCase()}]` : null,
    input.note,
  ]
    .filter(Boolean)
    .join(" ");

  let recoveryDigest: string | null = null;
  let encryptedGuestToken: string | null = null;

  if (
    !access.customerAccountId &&
    access.guestRecovery?.secret &&
    access.guestRecovery.guestToken
  ) {
    recoveryDigest = digestRecoverySecret(access.guestRecovery.secret);
    encryptedGuestToken = encryptGuestToken(
      access.guestRecovery.guestToken,
      access.guestRecovery.secret,
    );
  }

  const { nonce: receiptNonce, nonceHash: receiptNonceHash } =
    createReceiptNonce();

  const expiresAt = new Date(Date.now() + RECOVERY_TTL_MS);
  const responsePayload = JSON.stringify({
    fulfillmentStatus: "new",
    fulfillmentType: input.fulfillmentType,
    receiptNonce,
  });

  try {
    const result = await createOrder({
      clientId: input.clientId,
      channel: "online",
      lines,
      orderDiscount: voucherDiscount,
      payments: [
        {
          method: input.paymentMethod === "cod" ? "cash" : "transfer",
          amount: finalTotal,
        },
      ],
      note: noteParts || undefined,
      customerAccountId: access.customerAccountId,
      guestAccess: access.customerAccountId ? undefined : access.guestAccess,
      receiptNonceHash,
      idempotency: {
        requestFingerprint: currentFingerprint,
        recoveryDigest,
        encryptedGuestToken,
        responsePayload,
        expiresAt,
      },
      initialStatus: "pending",
      autoReceiveCash: false,
      online: {
        fulfillmentStatus: "new",
        fulfillmentType: input.fulfillmentType,
        paymentMethod: input.paymentMethod,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        deliveryAddress: input.deliveryAddress || null,
        deliveryWard: input.deliveryWard || null,
        deliveryDistrict: input.deliveryDistrict || null,
        deliveryProvince: input.deliveryProvince || null,
        shippingFee: 0,
      },
    });

    if (result.duplicated) {
      const committed = await prisma.checkoutIdempotency.findUnique({
        where: { clientId: input.clientId },
        include: { order: true },
      });
      if (committed) {
        return replayIdempotentOrder(committed, currentFingerprint, access);
      }
    }

    return {
      order: result.order,
      duplicated: result.duplicated,
      receiptNonce,
    };
  } catch (error: unknown) {
    const committed = await prisma.checkoutIdempotency.findUnique({
      where: { clientId: input.clientId },
      include: { order: true },
    });
    if (committed) {
      return replayIdempotentOrder(committed, currentFingerprint, access);
    }
    const orderFallback = await prisma.order.findUnique({
      where: { clientId: input.clientId },
    });
    if (orderFallback) {
      return {
        order: {
          id: orderFallback.id,
          code: orderFallback.code,
          subtotal: orderFallback.subtotal,
          discount: orderFallback.discount,
          total: orderFallback.total,
          status: orderFallback.status,
          hasStockWarning: orderFallback.hasStockWarning,
        },
        duplicated: true,
      };
    }
    throw error;
  }
}
