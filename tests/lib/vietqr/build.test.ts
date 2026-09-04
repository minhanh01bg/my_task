import { describe, expect, it } from "vitest";

import { buildVietQrPayload } from "@/lib/vietqr/build";
import { crc16CcittFalse } from "@/lib/vietqr/crc";
import type { BankAccount } from "@/lib/vietqr/types";

const account: BankAccount = {
  bankBin: "970423",
  accountNumber: "0011012345678",
  accountName: "NGUYEN VAN A",
};

describe("buildVietQrPayload", () => {
  it("sinh dung payload da biet truoc", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 400000,
      description: "DH0001",
    });

    expect(payload).toBe(
      "00020101021238570010A00000072701270006970423011300110123456780208QRIBFTTA530370454064000005802VN62100806DH00016304A28F",
    );
  });

  it("CRC cuoi payload luon tu nhat quan", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 123456,
      description: "DH9999",
    });

    const body = payload.slice(0, -4);
    const checksum = payload.slice(-4);
    expect(crc16CcittFalse(body)).toBe(checksum);
  });

  it("mo dau bang payload format 000201 va QR dong 010212", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH1",
    });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("010212");
  });

  it("chua ma ngan hang va so tai khoan", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH1",
    });
    expect(payload).toContain("970423");
    expect(payload).toContain("0011012345678");
  });

  it("gan so tien vao truong 54 khong co so thap phan", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 400000,
      description: "DH1",
    });
    expect(payload).toContain("5406400000");
  });

  it("gan noi dung chuyen khoan la ma don", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH1042",
    });
    expect(payload).toContain("0806DH1042");
  });

  it("bo qua truong so tien khi amount bang 0 (QR tinh)", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 0,
      description: "DH1",
    });
    expect(payload).not.toContain("5400");
    expect(payload).toContain("5802VN");
  });

  it("luon ket thuc bang 6304 + 4 ky tu CRC", () => {
    const payload = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH1",
    });
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(payload.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
  });

  it("do dai truong tu tinh dung khi noi dung dai ngan khac nhau", () => {
    const short = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH1",
    });
    const long = buildVietQrPayload({
      account,
      amount: 1000,
      description: "DH123456",
    });
    expect(short).toContain("0803DH1");
    expect(long).toContain("0808DH123456");
  });
});
