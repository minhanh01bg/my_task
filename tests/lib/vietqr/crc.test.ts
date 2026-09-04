import { describe, expect, it } from "vitest";

import { crc16CcittFalse } from "@/lib/vietqr/crc";

describe("crc16CcittFalse", () => {
  it("khop vector chuan cua CRC-16/CCITT-FALSE", () => {
    // Vector kiem thu chinh thuc cua thuat toan
    expect(crc16CcittFalse("123456789")).toBe("29B1");
  });

  it("chuoi rong tra ve gia tri khoi tao", () => {
    expect(crc16CcittFalse("")).toBe("FFFF");
  });

  it("luon tra ve dung 4 ky tu hex hoa", () => {
    const result = crc16CcittFalse("DH0001");
    expect(result).toMatch(/^[0-9A-F]{4}$/);
  });

  it("doi mot ky tu thi doi ket qua", () => {
    expect(crc16CcittFalse("DH0001")).not.toBe(crc16CcittFalse("DH0002"));
  });
});
