import { prisma } from "@/server/db/prisma";
import {
  OnlineOrderError,
  type OnlineCheckoutInput,
} from "@/types/online-order";

import { createOrder } from "./create-order";

export interface OnlineOrderAccessContext {
  customerAccountId?: string | null;
  guestAccess?: { tokenHash: string; expiresAt: Date };
}

export async function createOnlineOrder(
  input: OnlineCheckoutInput,
  access: OnlineOrderAccessContext = {},
) {
  const existing = await prisma.order.findUnique({
    where: { clientId: input.clientId },
    select: { id: true },
  });
  if (existing) {
    return createOrder({
      clientId: input.clientId,
      channel: "online",
      lines: [
        {
          productId: null,
          name: "idempotent",
          unitPrice: 0,
          originalPrice: 0,
          quantity: 1,
          discount: 0,
          unit: "cái",
          isService: true,
        },
      ],
      payments: [{ method: "transfer", amount: 0 }],
      customerAccountId: access.customerAccountId,
    });
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

  return createOrder({
    clientId: input.clientId,
    channel: "online",
    lines,
    payments: [
      {
        method: input.paymentMethod === "cod" ? "cash" : "transfer",
        amount: total,
      },
    ],
    customerAccountId: access.customerAccountId,
    guestAccess: access.customerAccountId ? undefined : access.guestAccess,
    initialStatus: "pending",
    autoReceiveCash: false,
    note: input.note || null,
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
}
