import { calculateCart } from "@/lib/pricing/calculate";
import type { CartLine } from "@/lib/pricing/types";
import { prisma } from "@/server/db/prisma";

import { generateOrderCode } from "./order-code";

export interface CreateOrderLine {
  productId: string | null;
  name: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  discount: number;
  unit: string;
  isService: boolean;
}

export interface CreateOrderPayment {
  method: "cash" | "transfer" | "debt";
  amount: number;
  receivedAt?: Date | null;
  note?: string | null;
}

export interface CreateOrderInput {
  clientId: string;
  /** Ma do may ban dat truoc de gan vao noi dung QR. Trung thi server tu doi. */
  preferredCode?: string | null;
  channel?: "pos" | "online";
  lines: CreateOrderLine[];
  orderDiscount?: number;
  payments: CreateOrderPayment[];
  customerId?: string | null;
  customerAccountId?: string | null;
  guestAccess?: { tokenHash: string; expiresAt: Date };
  note?: string | null;
  initialStatus?: string;
  autoReceiveCash?: boolean;
  online?: {
    fulfillmentStatus: "new";
    fulfillmentType: "delivery" | "pickup";
    paymentMethod: "cod" | "bank_transfer";
    contactName: string;
    contactPhone: string;
    deliveryAddress?: string | null;
    deliveryWard?: string | null;
    deliveryDistrict?: string | null;
    deliveryProvince?: string | null;
    shippingFee?: number;
  };
}

export interface CreateOrderResult {
  order: {
    id: string;
    code: string;
    subtotal: number;
    discount: number;
    total: number;
    status: string;
    hasStockWarning: boolean;
  };
  /** true khi don da ton tai tu truoc (gui lai lan hai) — khong tao moi. */
  duplicated: boolean;
}

function resolveStatus(payments: CreateOrderPayment[]): string {
  if (payments.some((payment) => payment.method === "debt")) return "debt";
  if (
    payments.some(
      (payment) => payment.method === "transfer" && !payment.receivedAt,
    )
  ) {
    return "pending";
  }
  return "paid";
}

/**
 * Tao don hang. Day la NOI DUY NHAT duoc phep tao don — POS goi qua
 * /api/orders, don online sau nay goi truc tiep.
 *
 * Ba dam bao quan trong:
 * 1. Server tinh lai toan bo tien bang calculateCart — khong tin so client gui.
 * 2. Idempotent theo clientId — mang chap chon gui hai lan chi tao mot don.
 * 3. Khong bao gio tu choi don vi het hang — cho ton am va danh dau canh bao.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  if (input.lines.length === 0) {
    throw new Error("Giỏ hàng rỗng");
  }

  const existing = await prisma.order.findUnique({
    where: { clientId: input.clientId },
  });

  if (existing) {
    return {
      order: {
        id: existing.id,
        code: existing.code,
        subtotal: existing.subtotal,
        discount: existing.discount,
        total: existing.total,
        status: existing.status,
        hasStockWarning: existing.hasStockWarning,
      },
      duplicated: true,
    };
  }

  const cartLines: CartLine[] = input.lines.map((line, index) => ({
    id: String(index),
    productId: line.productId,
    name: line.name,
    unitPrice: line.unitPrice,
    originalPrice: line.originalPrice,
    quantity: line.quantity,
    discount: line.discount,
    unit: line.unit,
    isService: line.isService,
  }));

  const totals = calculateCart(cartLines, input.orderDiscount ?? 0);
  const status = input.initialStatus ?? resolveStatus(input.payments);

  const stockLines = input.lines.filter(
    (line) => !line.isService && line.productId,
  );
  const productIds = stockLines.map((line) => line.productId as string);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stock: true },
  });
  const stockById = new Map(products.map((p) => [p.id, p.stock]));

  const hasStockWarning = stockLines.some(
    (line) => (stockById.get(line.productId as string) ?? 0) < line.quantity,
  );

  return prisma.$transaction(async (tx) => {
    const sequence = (await tx.order.count()) + 1;

    // Ma dat truoc chi duoc dung neu chua ai chiem — tranh vi pham unique.
    let code = generateOrderCode(sequence);
    if (input.preferredCode) {
      const taken = await tx.order.findUnique({
        where: { code: input.preferredCode },
        select: { id: true },
      });
      if (!taken) code = input.preferredCode;
    }

    const order = await tx.order.create({
      data: {
        code,
        channel: input.channel ?? "pos",
        status,
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        customerId: input.customerId ?? null,
        customerAccountId: input.customerAccountId ?? null,
        note: input.note ?? null,
        clientId: input.clientId,
        syncedAt: new Date(),
        hasStockWarning,
        fulfillmentStatus: input.online?.fulfillmentStatus ?? null,
        fulfillmentType: input.online?.fulfillmentType ?? null,
        paymentMethod: input.online?.paymentMethod ?? null,
        contactName: input.online?.contactName ?? null,
        contactPhone: input.online?.contactPhone ?? null,
        deliveryAddress: input.online?.deliveryAddress ?? null,
        deliveryWard: input.online?.deliveryWard ?? null,
        deliveryDistrict: input.online?.deliveryDistrict ?? null,
        deliveryProvince: input.online?.deliveryProvince ?? null,
        shippingFee: input.online?.shippingFee ?? 0,
        items: {
          create: totals.lines.map((line) => ({
            productId: line.productId,
            nameSnapshot: line.name,
            unitPrice: line.unitPrice,
            originalPrice: line.originalPrice,
            quantity: line.quantity,
            discount: line.discount,
            lineTotal: line.lineTotal,
            unit: line.unit,
            isService: line.isService,
          })),
        },
        payments: {
          create: input.payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            receivedAt:
              payment.receivedAt ??
              (payment.method === "cash" && input.autoReceiveCash !== false
                ? new Date()
                : null),
            note: payment.note ?? null,
          })),
        },
        guestAccess: input.guestAccess
          ? { create: input.guestAccess }
          : undefined,
      },
    });

    for (const line of stockLines) {
      const productId = line.productId as string;
      await tx.product.update({
        where: { id: productId },
        data: {
          stock: { decrement: line.quantity },
          soldCount: { increment: 1 },
        },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          delta: -line.quantity,
          reason: "sale",
          refId: order.id,
        },
      });
    }

    return {
      order: {
        id: order.id,
        code: order.code,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        status: order.status,
        hasStockWarning: order.hasStockWarning,
      },
      duplicated: false,
    };
  });
}
