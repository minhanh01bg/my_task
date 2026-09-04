import { describe, expect, it } from "vitest";

import {
  hashPassword,
  signSession,
  verifyPassword,
  verifySession,
} from "@/server/auth/session";

describe("hashPassword / verifyPassword", () => {
  it("xac nhan dung mat khau", async () => {
    const hash = await hashPassword("matkhau-cua-hang");
    expect(await verifyPassword("matkhau-cua-hang", hash)).toBe(true);
  });

  it("tu choi sai mat khau", async () => {
    const hash = await hashPassword("matkhau-cua-hang");
    expect(await verifyPassword("sai-roi", hash)).toBe(false);
  });

  it("moi lan hash ra chuoi khac nhau (co salt)", async () => {
    const a = await hashPassword("x");
    const b = await hashPassword("x");
    expect(a).not.toBe(b);
  });

  it("hash rong luon bi tu choi", async () => {
    expect(await verifyPassword("bat ky", "")).toBe(false);
  });
});

describe("signSession / verifySession", () => {
  it("chap nhan token do chinh minh ky", async () => {
    const token = await signSession({ issuedAt: Date.now() });
    expect(await verifySession(token)).toBe(true);
  });

  it("tu choi token bi sua", async () => {
    const token = await signSession({ issuedAt: Date.now() });
    expect(await verifySession(`${token}x`)).toBe(false);
  });

  it("tu choi token rac", async () => {
    expect(await verifySession("khong-phai-token")).toBe(false);
  });

  it("tu choi token qua han 30 ngay", async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const token = await signSession({ issuedAt: thirtyOneDaysAgo });
    expect(await verifySession(token)).toBe(false);
  });
});
