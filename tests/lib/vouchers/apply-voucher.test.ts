import { describe, expect, it } from "vitest";

import {
  applyVoucher,
  normalizeVoucherCode,
  voucherReasonMessage,
  type VoucherRule,
} from "@/lib/vouchers/validate-voucher";

const NOW = new Date("2026-09-24T05:00:00.000Z");

function rule(overrides: Partial<VoucherRule> = {}): VoucherRule {
  return {
    code: "TEST",
    type: "fixed",
    value: 20_000,
    maxDiscount: null,
    minOrderTotal: 0,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

describe("normalizeVoucherCode", () => {
  it("trim và viết hoa", () => {
    expect(normalizeVoucherCode("  giam10 ")).toBe("GIAM10");
    expect(normalizeVoucherCode("   ")).toBe("");
  });
});

describe("applyVoucher", () => {
  it("percent có maxDiscount: giảm theo % và chặn trần", () => {
    const voucher = rule({ type: "percent", value: 10, maxDiscount: 30_000 });
    expect(
      applyVoucher(voucher, { subtotal: 200_000, shippingFee: 0, now: NOW }),
    ).toEqual({ ok: true, discount: 20_000, shippingDiscount: 0 });
    expect(
      applyVoucher(voucher, { subtotal: 500_000, shippingFee: 0, now: NOW }),
    ).toEqual({ ok: true, discount: 30_000, shippingDiscount: 0 });
  });

  it("percent làm tròn xuống thành số nguyên VND", () => {
    const voucher = rule({ type: "percent", value: 15 });
    const result = applyVoucher(voucher, {
      subtotal: 33_333,
      shippingFee: 0,
      now: NOW,
    });
    expect(result.discount).toBe(4_999);
    expect(Number.isInteger(result.discount)).toBe(true);
  });

  it("fixed: giảm đúng số tiền, không vượt tạm tính", () => {
    const voucher = rule({ type: "fixed", value: 50_000 });
    expect(
      applyVoucher(voucher, { subtotal: 120_000, shippingFee: 0, now: NOW }),
    ).toEqual({ ok: true, discount: 50_000, shippingDiscount: 0 });
    expect(
      applyVoucher(voucher, { subtotal: 30_000, shippingFee: 0, now: NOW })
        .discount,
    ).toBe(30_000);
  });

  it("freeship: chỉ giảm phí ship, không giảm tiền hàng", () => {
    const voucher = rule({
      type: "freeship",
      value: 0,
      minOrderTotal: 200_000,
    });
    expect(
      applyVoucher(voucher, {
        subtotal: 250_000,
        shippingFee: 25_000,
        now: NOW,
      }),
    ).toEqual({ ok: true, discount: 0, shippingDiscount: 25_000 });
  });

  it("freeship có maxDiscount chỉ giảm tối đa phần trần phí ship", () => {
    const voucher = rule({ type: "freeship", value: 0, maxDiscount: 15_000 });
    expect(
      applyVoucher(voucher, {
        subtotal: 100_000,
        shippingFee: 25_000,
        now: NOW,
      }),
    ).toEqual({ ok: true, discount: 0, shippingDiscount: 15_000 });
  });

  it("hết hạn", () => {
    const voucher = rule({ endsAt: new Date("2026-09-23T00:00:00.000Z") });
    expect(
      applyVoucher(voucher, { subtotal: 100_000, shippingFee: 0, now: NOW }),
    ).toEqual({
      ok: false,
      discount: 0,
      shippingDiscount: 0,
      reason: "expired",
    });
  });

  it("chưa bắt đầu", () => {
    const voucher = rule({ startsAt: new Date("2026-09-25T00:00:00.000Z") });
    expect(
      applyVoucher(voucher, { subtotal: 100_000, shippingFee: 0, now: NOW })
        .reason,
    ).toBe("not_started");
  });

  it("hết lượt", () => {
    const voucher = rule({ maxUses: 5, usedCount: 5 });
    expect(
      applyVoucher(voucher, { subtotal: 100_000, shippingFee: 0, now: NOW }),
    ).toEqual({
      ok: false,
      discount: 0,
      shippingDiscount: 0,
      reason: "exhausted",
    });
    expect(
      applyVoucher(rule({ maxUses: 5, usedCount: 4 }), {
        subtotal: 100_000,
        shippingFee: 0,
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("dưới giá trị đơn tối thiểu", () => {
    const voucher = rule({ minOrderTotal: 200_000 });
    expect(
      applyVoucher(voucher, { subtotal: 199_999, shippingFee: 0, now: NOW })
        .reason,
    ).toBe("min_order");
    expect(
      applyVoucher(voucher, { subtotal: 200_000, shippingFee: 0, now: NOW }).ok,
    ).toBe(true);
  });

  it("voucher đã tắt hoặc không tồn tại", () => {
    expect(
      applyVoucher(rule({ isActive: false }), {
        subtotal: 100_000,
        shippingFee: 0,
        now: NOW,
      }).reason,
    ).toBe("inactive");
    expect(
      applyVoucher(null, { subtotal: 100_000, shippingFee: 0, now: NOW })
        .reason,
    ).toBe("not_found");
  });

  it("thông báo lý do bằng tiếng Việt", () => {
    expect(
      voucherReasonMessage("min_order", rule({ minOrderTotal: 200_000 })),
    ).toMatch(/tối thiểu 200\.000/);
    expect(voucherReasonMessage("expired")).toMatch(/hết hạn/);
    expect(voucherReasonMessage("exhausted")).toMatch(/hết lượt/);
  });
});
