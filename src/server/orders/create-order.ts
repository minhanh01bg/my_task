import { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { MAX_INT_VND, multiplyMoney, roundVnd } from "@/lib/money";
import { calculateCart } from "@/lib/pricing/calculate";
import type { CartLine } from "@/lib/pricing/types";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { createCustomerOrderCreatedNotification } from "@/server/customer-notifications/create-customer-notification";
import { prisma } from "@/server/db/prisma";
import { createOnlineOrderNotification } from "@/server/notifications/create-admin-notification";
import { OnlineOrderError } from "@/types/online-order";

import { assertOpenOnlineOrderLimit } from "./open-online-orders";
import { generateOrderCode } from "./order-code";
import { nextOrderSequence } from "./order-sequence";
import { OrderValidationError } from "./order-validation-error";

/** So lan chay transaction toi da khi dung unique `Order.code`. */
const MAX_CODE_ATTEMPTS = 3;

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

/**
 * Voucher da duoc kiem tra phia server (xem `createOnlineOrder`). `discount`
 * giam tien hang, `shippingDiscount` giam phi ship. createOrder chan lai hai
 * so nay theo tien hang/phi ship that va tang `usedCount` nguyen tu.
 */
export interface CreateOrderVoucher {
  code: string;
  discount: number;
  shippingDiscount: number;
}

export interface CreateOrderInput {
  clientId: string;
  /** Ma do may ban dat truoc de gan vao noi dung QR. Trung thi server tu doi. */
  preferredCode?: string | null;
  channel?: "pos" | "online";
  lines: CreateOrderLine[];
  /** Giam gia thu cong toan don (POS). Voucher di qua `voucher`. */
  orderDiscount?: number;
  voucher?: CreateOrderVoucher | null;
  payments: CreateOrderPayment[];
  customerId?: string | null;
  customerAccountId?: string | null;
  guestAccess?: { tokenHash: string; expiresAt: Date };
  receiptNonceHash?: string | null;
  idempotency?: {
    requestFingerprint: string;
    recoveryDigest?: string | null;
    encryptedGuestToken?: string | null;
    responsePayload: string;
    expiresAt: Date;
  };
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
    deliverySlot?: string | null;
    /** Phi ship TRUOC khi ap voucher freeship. */
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

/**
 * Giam gia khong am va khong vuot so tien no giam (thanh tien dong / tien
 * hang): `discount` luu lai luon la so that, `subtotal - discount = total`.
 */
function clampDiscount(discount: number, max: number): number {
  return Math.min(Math.max(0, roundVnd(discount)), Math.max(0, max));
}

/**
 * Doi chieu thanh toan voi tong do server tinh lai: tong cac khoan phai du tong
 * don. Phan du chi duoc la tien thua cua tien mat — tru vao khoan tien mat (tu
 * khoan cuoi) de so tien luu lai bang dung so da thu, cong no/bao cao khong bi
 * thoi phong. Chuyen khoan/ghi no du thi tu choi. Khoan tien mat bi tru het
 * thi bo, khong luu dong 0d.
 */
function settlePayments(
  payments: CreateOrderPayment[],
  total: number,
): CreateOrderPayment[] {
  if (
    payments.some(
      (payment) => !Number.isSafeInteger(payment.amount) || payment.amount < 0,
    )
  ) {
    throw new OrderValidationError(
      "PAYMENT_INVALID",
      "Số tiền thanh toán không hợp lệ",
    );
  }

  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (paid < total) {
    throw new OrderValidationError(
      "PAYMENT_SHORT",
      "Số tiền thanh toán chưa đủ tổng đơn",
    );
  }

  let change = paid - total;
  const cash = payments
    .filter((payment) => payment.method === "cash")
    .reduce((sum, payment) => sum + payment.amount, 0);
  if (change > cash) {
    throw new OrderValidationError(
      "PAYMENT_OVERPAID",
      "Chuyển khoản hoặc ghi nợ vượt quá tổng đơn",
    );
  }

  const settled = [...payments];
  for (let index = settled.length - 1; index >= 0 && change > 0; index -= 1) {
    const payment = settled[index]!;
    if (payment.method !== "cash") continue;
    const deducted = Math.min(payment.amount, change);
    settled[index] = { ...payment, amount: payment.amount - deducted };
    change -= deducted;
  }
  return settled.filter(
    (payment, index) => payment.amount > 0 || payments[index]!.amount === 0,
  );
}

/**
 * Moi so tien ghi vao cot `Int` phai <= MAX_INT_VND. Moi dong duoi tran van co
 * the cong lai vuot tran, nen kiem tra tren so server tinh lai — tu choi bang
 * loi nghiep vu truoc khi ghi thay vi de Prisma nem 500 (may ban gui lai mai).
 */
function assertAmountsFit(amounts: number[]): void {
  if (amounts.some((amount) => amount > MAX_INT_VND)) {
    throw new OrderValidationError(
      "AMOUNT_TOO_LARGE",
      "Số tiền của đơn quá lớn, vui lòng tách thành nhiều đơn nhỏ hơn",
    );
  }
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

function isUniqueViolationOn(error: unknown, field: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  const matches = (value: string): boolean =>
    value === field || value.endsWith(`_${field}_key`);
  return Array.isArray(target)
    ? target.some((value) => typeof value === "string" && matches(value))
    : typeof target === "string" && matches(target);
}

async function isCodeTaken(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<boolean> {
  const taken = await tx.order.findUnique({
    where: { code },
    select: { id: true },
  });
  return taken !== null;
}

/**
 * Ma dat truoc chi duoc dung neu chua ai chiem — tranh vi pham unique.
 * Ma dat truoc cua may POS (`DH` + 6 so) co the chiem truoc so cua bo dem,
 * nen bo qua cac so da bi dung.
 */
async function resolveOrderCode(
  tx: Prisma.TransactionClient,
  sequence: number,
  preferredCode: string | null | undefined,
): Promise<string> {
  if (preferredCode && !(await isCodeTaken(tx, preferredCode))) {
    return preferredCode;
  }
  let code = generateOrderCode(sequence);
  while (await isCodeTaken(tx, code)) {
    code = generateOrderCode(await nextOrderSequence(tx));
  }
  return code;
}

interface OrderMoney {
  /** Giam thu cong + giam tien hang cua voucher. */
  discount: number;
  voucherCode: string | null;
  voucherDiscount: number;
  /** Phi ship SAU khi ap voucher. */
  shippingFee: number;
  /** subtotal - discount thu cong - voucherDiscount + shippingFee. */
  total: number;
}

function applyVoucherToTotals(
  totals: { discount: number; total: number },
  voucher: CreateOrderVoucher | null | undefined,
  baseShippingFee: number,
): OrderMoney {
  const shippingBefore = Math.max(0, roundVnd(baseShippingFee));
  const voucherDiscount = voucher
    ? Math.min(Math.max(0, roundVnd(voucher.discount)), totals.total)
    : 0;
  const shippingDiscount = voucher
    ? Math.min(Math.max(0, roundVnd(voucher.shippingDiscount)), shippingBefore)
    : 0;
  const shippingFee = shippingBefore - shippingDiscount;

  return {
    discount: totals.discount + voucherDiscount,
    voucherCode: voucher ? voucher.code : null,
    voucherDiscount,
    shippingFee,
    total: totals.total - voucherDiscount + shippingFee,
  };
}

/**
 * Tang `usedCount` NGUYEN TU voi dieu kien con luot — hai don dong thoi dung
 * voucher con 1 luot thi chi mot don cap nhat duoc dong nay. Prisma khong so
 * sanh hai cot duoc nen dung `$executeRaw`.
 */
async function consumeVoucherUse(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<void> {
  const updated = await tx.$executeRaw`
    UPDATE "Voucher"
    SET "usedCount" = "usedCount" + 1
    WHERE "code" = ${code}
      AND "isActive" = 1
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
  if (updated === 0) {
    throw new OnlineOrderError(
      "VOUCHER_INVALID",
      "Mã giảm giá đã hết lượt sử dụng hoặc ngừng áp dụng",
    );
  }
}

/**
 * Tao don hang. Day la NOI DUY NHAT duoc phep tao don — POS goi qua
 * /api/orders, don online sau nay goi truc tiep.
 *
 * Ba dam bao quan trong:
 * 1. Server tinh lai toan bo tien bang calculateCart — khong tin so client gui;
 *    thanh toan phai du tong da tinh lai (xem `settlePayments`).
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
    discount: clampDiscount(
      line.discount,
      multiplyMoney(line.unitPrice, line.quantity),
    ),
    unit: line.unit,
    isService: line.isService,
  }));

  const totals = calculateCart(
    cartLines,
    clampDiscount(input.orderDiscount ?? 0, calculateCart(cartLines).subtotal),
  );
  const money = applyVoucherToTotals(
    totals,
    input.voucher,
    input.online?.shippingFee ?? 0,
  );
  assertAmountsFit([
    ...totals.lines.flatMap((line) => [
      line.unitPrice,
      line.originalPrice,
      line.discount,
      line.lineTotal,
    ]),
    totals.subtotal,
    money.discount,
    money.voucherDiscount,
    money.shippingFee,
    money.total,
  ]);
  const payments = settlePayments(input.payments, money.total);
  assertAmountsFit(payments.map((payment) => payment.amount));
  const status = input.initialStatus ?? resolveStatus(payments);

  if (input.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new OrderValidationError(
        "CUSTOMER_NOT_FOUND",
        "Không tìm thấy khách hàng",
      );
    }
  }

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

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lenh GHI dau tien: giu khoa ghi ngay, khong doc-roi-nang-cap khoa.
        const sequence = await nextOrderSequence(tx);
        if (input.channel === "online" && input.online) {
          await assertOpenOnlineOrderLimit(tx, {
            contactPhone: input.online.contactPhone,
            customerAccountId: input.customerAccountId,
          });
        }
        const code = await resolveOrderCode(tx, sequence, input.preferredCode);

        // Sau khóa ghi, chụp cả giá vốn dịch vụ bằng chính transaction client.
        const costProducts = await tx.product.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  input.lines.flatMap((line) =>
                    line.productId ? [line.productId] : [],
                  ),
                ),
              ],
            },
          },
          select: { id: true, costPrice: true },
        });
        const costById = new Map(
          costProducts.map((product) => [product.id, product.costPrice]),
        );

        if (money.voucherCode) {
          await consumeVoucherUse(tx, money.voucherCode);
        }

        const order = await tx.order.create({
          data: {
            code,
            channel: input.channel ?? "pos",
            status,
            subtotal: totals.subtotal,
            discount: money.discount,
            total: money.total,
            voucherCode: money.voucherCode,
            voucherDiscount: money.voucherDiscount,
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
            deliverySlot: input.online?.deliverySlot ?? null,
            shippingFee: money.shippingFee,
            receiptNonceHash: input.receiptNonceHash ?? null,
            items: {
              create: totals.lines.map((line) => ({
                productId: line.productId,
                nameSnapshot: line.name,
                unitPrice: line.unitPrice,
                originalPrice: line.originalPrice,
                costPriceSnapshot: line.productId
                  ? (costById.get(line.productId) ?? null)
                  : null,
                quantity: line.quantity,
                discount: line.discount,
                lineTotal: line.lineTotal,
                unit: line.unit,
                isService: line.isService,
              })),
            },
            payments: {
              create: payments.map((payment) => ({
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
            idempotency: input.idempotency
              ? {
                  create: {
                    clientId: input.clientId,
                    requestFingerprint: input.idempotency.requestFingerprint,
                    recoveryDigest: input.idempotency.recoveryDigest,
                    encryptedGuestToken: input.idempotency.encryptedGuestToken,
                    responsePayload: input.idempotency.responsePayload,
                    expiresAt: input.idempotency.expiresAt,
                  },
                }
              : undefined,
          },
        });

        for (const line of stockLines) {
          const productId = line.productId as string;
          if (input.channel === "online") {
            const updatedCount = await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" - ${line.quantity},
              "soldCount" = "soldCount" + 1
          WHERE "id" = ${productId} AND "stock" >= ${line.quantity}
        `;
            if (updatedCount === 0) {
              throw new OnlineOrderError(
                "OUT_OF_STOCK",
                "Một số sản phẩm không đủ tồn kho",
                [productId],
              );
            }
          } else {
            await tx.product.update({
              where: { id: productId },
              data: {
                stock: { decrement: line.quantity },
                soldCount: { increment: 1 },
              },
            });
          }
        }

        if (stockLines.length > 0) {
          await tx.stockMovement.createMany({
            data: stockLines.map((line) => ({
              productId: line.productId as string,
              delta: -line.quantity,
              reason: "sale",
              refId: order.id,
            })),
          });
        }

        if (input.channel === "online") {
          await createOnlineOrderNotification(tx, order);
          await createCustomerOrderCreatedNotification(tx, order);
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
      // Sau commit (khong trong transaction): ton kho/soldCount da doi.
      if (stockLines.length > 0) revalidatePublic(CACHE_TAGS.catalog);
      if (money.voucherCode) revalidatePublic(CACHE_TAGS.vouchers);
      return result;
    } catch (error: unknown) {
      if (isUniqueViolationOn(error, "code")) {
        if (attempt >= MAX_CODE_ATTEMPTS) throw error;
        logger.warn("Trùng mã đơn, thử lại transaction", {
          clientId: input.clientId,
          attempt,
        });
        continue;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
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
      }
      throw error;
    }
  }
}
