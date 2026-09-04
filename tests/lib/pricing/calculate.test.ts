import { describe, expect, it } from "vitest";

import { calculateCart } from "@/lib/pricing/calculate";
import type { CartLine } from "@/lib/pricing/types";

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "l1",
    productId: "p1",
    name: "Đường trắng",
    unitPrice: 15000,
    originalPrice: 15000,
    quantity: 1,
    discount: 0,
    unit: "kg",
    isService: false,
    ...overrides,
  };
}

describe("calculateCart", () => {
  it("gio rong tra ve tong bang 0", () => {
    const result = calculateCart([]);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it("tinh mot dong don gian", () => {
    const result = calculateCart([line({ unitPrice: 15000, quantity: 2 })]);
    expect(result.lines[0]?.lineTotal).toBe(30000);
    expect(result.total).toBe(30000);
  });

  it("tinh so luong le va lam tron ve dong", () => {
    const result = calculateCart([line({ unitPrice: 15000, quantity: 2.5 })]);
    expect(result.lines[0]?.lineTotal).toBe(37500);
  });

  it("tru giam gia theo dong", () => {
    const result = calculateCart([
      line({ unitPrice: 15000, quantity: 2, discount: 5000 }),
    ]);
    expect(result.lines[0]?.lineTotal).toBe(25000);
    expect(result.total).toBe(25000);
  });

  it("giam gia dong khong lam lineTotal am", () => {
    const result = calculateCart([
      line({ unitPrice: 15000, quantity: 1, discount: 99000 }),
    ]);
    expect(result.lines[0]?.lineTotal).toBe(0);
  });

  it("dung unitPrice da de gia, khong dung originalPrice", () => {
    const result = calculateCart([
      line({ unitPrice: 12000, originalPrice: 15000, quantity: 2 }),
    ]);
    expect(result.lines[0]?.lineTotal).toBe(24000);
  });

  it("cong don nhieu dong", () => {
    const result = calculateCart([
      line({ id: "l1", unitPrice: 15000, quantity: 2 }),
      line({ id: "l2", unitPrice: 8000, quantity: 3 }),
    ]);
    expect(result.subtotal).toBe(54000);
  });

  it("dong dich vu tinh nhu dong thuong", () => {
    const result = calculateCart([
      line({ id: "l1", unitPrice: 15000, quantity: 1 }),
      line({
        id: "l2",
        productId: null,
        name: "Công thay nhớt",
        unitPrice: 20000,
        originalPrice: 20000,
        quantity: 1,
        isService: true,
      }),
    ]);
    expect(result.total).toBe(35000);
  });

  it("tru giam gia toan don", () => {
    const result = calculateCart(
      [line({ unitPrice: 100000, quantity: 1 })],
      10000,
    );
    expect(result.subtotal).toBe(100000);
    expect(result.discount).toBe(10000);
    expect(result.total).toBe(90000);
  });

  it("giam gia toan don khong lam total am", () => {
    const result = calculateCart(
      [line({ unitPrice: 10000, quantity: 1 })],
      99000,
    );
    expect(result.total).toBe(0);
  });

  it("moi so tien tra ve deu la so nguyen", () => {
    const result = calculateCart([
      line({ unitPrice: 12345, quantity: 0.37 }),
      line({ id: "l2", unitPrice: 999, quantity: 1.11 }),
    ]);
    expect(Number.isInteger(result.subtotal)).toBe(true);
    expect(Number.isInteger(result.total)).toBe(true);
    for (const calculated of result.lines) {
      expect(Number.isInteger(calculated.lineTotal)).toBe(true);
    }
  });
});
