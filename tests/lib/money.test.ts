import { describe, expect, it } from "vitest";

import { formatVnd, multiplyMoney, roundVnd } from "@/lib/money";

describe("roundVnd", () => {
  it("lam tron ve so nguyen dong", () => {
    expect(roundVnd(37499.6)).toBe(37500);
    expect(roundVnd(37499.4)).toBe(37499);
  });

  it("giu nguyen so nguyen san co", () => {
    expect(roundVnd(15000)).toBe(15000);
  });
});

describe("multiplyMoney", () => {
  it("nhan gia voi so luong le roi lam tron", () => {
    expect(multiplyMoney(15000, 2.5)).toBe(37500);
    expect(multiplyMoney(12000, 0.35)).toBe(4200);
  });

  it("khong bi sai so dau phay dong", () => {
    expect(multiplyMoney(10000, 0.1 + 0.2)).toBe(3000);
  });

  it("so luong 0 tra ve 0", () => {
    expect(multiplyMoney(15000, 0)).toBe(0);
  });
});

describe("formatVnd", () => {
  it("dung dau cham phan cach hang nghin", () => {
    expect(formatVnd(37500)).toBe("37.500");
    expect(formatVnd(1250000)).toBe("1.250.000");
    expect(formatVnd(0)).toBe("0");
  });
});
