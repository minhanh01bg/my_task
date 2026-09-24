import { formatVnd } from "@/lib/money";

export const VOUCHER_TYPES = ["percent", "fixed", "freeship"] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

/** Dữ liệu voucher engine cần — khớp các cột của model `Voucher`. */
export interface VoucherRule {
  code: string;
  type: VoucherType;
  /** percent: 1-100; fixed: số tiền VND; freeship: không dùng. */
  value: number;
  /** Trần giảm tiền hàng (percent) hoặc trần giảm phí ship (freeship). */
  maxDiscount: number | null;
  minOrderTotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export type VoucherRejectReason =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "min_order"
  | "no_shipping_fee";

export interface ApplyVoucherContext {
  /** Tạm tính tiền hàng (VND, số nguyên) do server tính. */
  subtotal: number;
  /** Phí ship trước khi giảm (VND). */
  shippingFee: number;
  now: Date;
}

export interface ApplyVoucherResult {
  ok: boolean;
  /** Phần giảm vào tiền hàng. */
  discount: number;
  /** Phần giảm vào phí ship. */
  shippingDiscount: number;
  reason?: VoucherRejectReason;
}

export function isVoucherType(value: string): value is VoucherType {
  return (VOUCHER_TYPES as readonly string[]).includes(value);
}

/** Chuẩn hoá mã: `trim().toUpperCase()`. */
export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase();
}

function reject(reason: VoucherRejectReason): ApplyVoucherResult {
  return { ok: false, discount: 0, shippingDiscount: 0, reason };
}

/**
 * Engine thuần: tính phần giảm của một voucher. Không đọc DB, không nhớ danh
 * sách mã — dùng chung cho API kiểm tra mã và đường ghi đơn phía server.
 */
export function applyVoucher(
  voucher: VoucherRule | null,
  context: ApplyVoucherContext,
): ApplyVoucherResult {
  if (!voucher) return reject("not_found");
  if (!voucher.isActive) return reject("inactive");

  const now = context.now.getTime();
  if (voucher.startsAt && voucher.startsAt.getTime() > now) {
    return reject("not_started");
  }
  if (voucher.endsAt && voucher.endsAt.getTime() < now) {
    return reject("expired");
  }
  if (voucher.maxUses !== null && voucher.usedCount >= voucher.maxUses) {
    return reject("exhausted");
  }

  const subtotal = Math.max(0, Math.round(context.subtotal));
  const shippingFee = Math.max(0, Math.round(context.shippingFee));
  if (subtotal < voucher.minOrderTotal) return reject("min_order");

  if (voucher.type === "freeship") {
    // Don da mien phi ship (nhan tai cua hang / dat nguong) — ma freeship vo
    // nghia, tu choi de khong "tieu" mot luot dung ma khong giam gi.
    if (shippingFee === 0) return reject("no_shipping_fee");
    const cap = voucher.maxDiscount ?? shippingFee;
    return {
      ok: true,
      discount: 0,
      shippingDiscount: Math.max(0, Math.min(shippingFee, cap)),
    };
  }

  let discount =
    voucher.type === "percent"
      ? Math.floor((subtotal * voucher.value) / 100)
      : voucher.value;
  if (voucher.type === "percent" && voucher.maxDiscount !== null) {
    discount = Math.min(discount, voucher.maxDiscount);
  }

  return {
    ok: true,
    discount: Math.max(0, Math.min(discount, subtotal)),
    shippingDiscount: 0,
  };
}

/** Câu thông báo tiếng Việt cho lý do từ chối. */
export function voucherReasonMessage(
  reason: VoucherRejectReason,
  voucher?: Pick<VoucherRule, "minOrderTotal"> | null,
): string {
  switch (reason) {
    case "not_found":
    case "inactive":
      return "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng";
    case "not_started":
      return "Mã giảm giá chưa đến thời gian áp dụng";
    case "expired":
      return "Mã giảm giá đã hết hạn";
    case "exhausted":
      return "Mã giảm giá đã hết lượt sử dụng";
    case "min_order":
      return voucher
        ? `Đơn hàng tối thiểu ${formatVnd(voucher.minOrderTotal)} ₫ để dùng mã này`
        : "Đơn hàng chưa đạt giá trị tối thiểu để dùng mã này";
    case "no_shipping_fee":
      return "Đơn này đã được miễn phí giao hàng";
  }
}

/** Mô tả ngắn cho admin/khách: "Giảm 10% tối đa 30.000 ₫"... */
export function describeVoucher(
  voucher: Pick<
    VoucherRule,
    "type" | "value" | "maxDiscount" | "minOrderTotal"
  >,
): string {
  const parts: string[] = [];
  if (voucher.type === "percent") {
    parts.push(`Giảm ${voucher.value}%`);
    if (voucher.maxDiscount !== null) {
      parts.push(`tối đa ${formatVnd(voucher.maxDiscount)} ₫`);
    }
  } else if (voucher.type === "fixed") {
    parts.push(`Giảm ${formatVnd(voucher.value)} ₫`);
  } else {
    parts.push("Miễn phí giao hàng");
    if (voucher.maxDiscount !== null) {
      parts.push(`tối đa ${formatVnd(voucher.maxDiscount)} ₫`);
    }
  }
  if (voucher.minOrderTotal > 0) {
    parts.push(`cho đơn từ ${formatVnd(voucher.minOrderTotal)} ₫`);
  }
  return parts.join(" ");
}
