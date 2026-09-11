export interface VoucherRule {
  code: string;
  type: "percent" | "fixed";
  amount: number;
  maxDiscount?: number;
  minOrderValue: number;
  description: string;
  isActive: boolean;
}

export const KNOWN_VOUCHERS: VoucherRule[] = [
  {
    code: "CHAOBAN",
    type: "percent",
    amount: 10,
    maxDiscount: 30_000,
    minOrderValue: 100_000,
    description: "Giảm 10% tối đa 30k cho đơn từ 100k",
    isActive: true,
  },
  {
    code: "FREESHIP",
    type: "fixed",
    amount: 25_000,
    minOrderValue: 150_000,
    description: "Giảm 25.000đ phí ship cho đơn từ 150k",
    isActive: true,
  },
  {
    code: "GIAM20K",
    type: "fixed",
    amount: 20_000,
    minOrderValue: 120_000,
    description: "Giảm 20.000đ trực tiếp cho đơn từ 120k",
    isActive: true,
  },
  {
    code: "TAPHOA50",
    type: "fixed",
    amount: 50_000,
    minOrderValue: 300_000,
    description: "Giảm 50.000đ cho đơn hàng từ 300k",
    isActive: true,
  },
];

export interface VoucherValidationResult {
  valid: boolean;
  code?: string;
  discount: number;
  message: string;
}

export function validateVoucher(
  code: string | undefined | null,
  subtotal: number,
): VoucherValidationResult {
  if (!code || !code.trim()) {
    return { valid: false, discount: 0, message: "Chưa nhập mã khuyến mãi" };
  }

  const normalized = code.trim().toUpperCase();
  const voucher = KNOWN_VOUCHERS.find(
    (v) => v.code === normalized && v.isActive,
  );

  if (!voucher) {
    return {
      valid: false,
      discount: 0,
      message: "Mã khuyến mãi không tồn tại hoặc đã hết hạn",
    };
  }

  if (subtotal < voucher.minOrderValue) {
    return {
      valid: false,
      discount: 0,
      message: `Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString("vi-VN")} ₫ để áp dụng mã này`,
    };
  }

  let discount = 0;
  if (voucher.type === "percent") {
    discount = Math.round((subtotal * voucher.amount) / 100);
    if (voucher.maxDiscount && discount > voucher.maxDiscount) {
      discount = voucher.maxDiscount;
    }
  } else {
    discount = voucher.amount;
  }

  discount = Math.min(discount, subtotal);

  return {
    valid: true,
    code: voucher.code,
    discount,
    message: `Đã áp dụng mã ${voucher.code}: giảm ${discount.toLocaleString("vi-VN")} ₫`,
  };
}
