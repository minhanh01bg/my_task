import { describe, expect, it } from "vitest";

import { validateVoucher } from "@/server/vouchers/validate-voucher";

describe("validateVoucher logic", () => {
  it("từ chối khi không có mã voucher", () => {
    expect(validateVoucher("", 150000).valid).toBe(false);
    expect(validateVoucher(null, 150000).valid).toBe(false);
  });

  it("từ chối khi mã không tồn tại", () => {
    const result = validateVoucher("MAKHONGTONTAI", 150000);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("không tồn tại");
  });

  it("từ chối khi chưa đạt giá trị đơn tối thiểu", () => {
    // GIAM20K requires min 120,000đ
    const result = validateVoucher("GIAM20K", 80000);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("tối thiểu");
  });

  it("áp dụng thành công mã giảm tiền cố định", () => {
    // GIAM20K reduces 20,000đ on orders >= 120,000đ
    const result = validateVoucher("giam20k", 150000); // Case insensitive
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20000);
    expect(result.code).toBe("GIAM20K");
  });

  it("áp dụng mã giảm theo phần trăm có trần tối đa", () => {
    // CHAOBAN: 10% max 30,000đ for orders >= 100,000đ
    const res1 = validateVoucher("CHAOBAN", 200000); // 10% of 200k = 20k
    expect(res1.valid).toBe(true);
    expect(res1.discount).toBe(20000);

    const res2 = validateVoucher("CHAOBAN", 500000); // 10% of 500k = 50k -> capped at 30k
    expect(res2.valid).toBe(true);
    expect(res2.discount).toBe(30000);
  });
});
