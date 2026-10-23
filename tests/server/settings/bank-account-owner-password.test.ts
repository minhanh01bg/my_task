import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { saveSettingsAction } from "@/app/(management)/admin/settings/actions";
import { env } from "@/config/env";
import {
  createAdminSession,
  hashPassword,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import { setOwnerPasswordLimiter } from "@/server/settings/owner-password";

const mockCookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookies.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

class MemoryStore implements RateLimitStore {
  private map = new Map<string, number>();

  async incrementAndGetTtl(key: string, windowSeconds: number) {
    const count = (this.map.get(key) ?? 0) + 1;
    this.map.set(key, count);
    return { count, ttlSeconds: windowSeconds };
  }

  async delete(key: string) {
    this.map.delete(key);
  }

  async decrement(key: string) {
    const count = this.map.get(key);
    if (count) this.map.set(key, count - 1);
  }
}

const OWNER_PASSWORD = "chu-cua-hang-2026";
const SETTING_KEYS = [
  "store.name",
  "bank.bin",
  "bank.accountNumber",
  "bank.accountName",
];
const CURRENT_BANK = {
  bankBin: "970407",
  accountNumber: "0123456789",
  accountName: "CHU CUA HANG",
};
const ATTACKER_BANK = {
  bankBin: "970423",
  accountNumber: "9999994321",
  accountName: "NGUOI LA",
};

let ownerHash: string;
let originalOwnerHash: string | undefined;

function settingsForm(
  bank: typeof CURRENT_BANK,
  extra: Record<string, string> = {},
) {
  const formData = new FormData();
  formData.set("storeName", "Cửa Hàng Chính Hãng");
  formData.set("bankBin", bank.bankBin);
  formData.set("accountNumber", bank.accountNumber);
  formData.set("accountName", bank.accountName);
  for (const [key, value] of Object.entries(extra)) formData.set(key, value);
  return formData;
}

async function readSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: SETTING_KEYS } },
    orderBy: { key: "asc" },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function bankNotifications() {
  return prisma.adminNotification.findMany({
    where: { kind: "bank_account_changed" },
  });
}

function setOwnerHash(value: string | undefined) {
  (env as Record<string, unknown>).OWNER_PASSWORD_HASH = value;
}

beforeAll(async () => {
  originalOwnerHash = env.OWNER_PASSWORD_HASH;
  ownerHash = await hashPassword(OWNER_PASSWORD);
});

beforeEach(async () => {
  mockCookies.clear();
  setOwnerHash(ownerHash);
  setOwnerPasswordLimiter(
    createRateLimiter({ store: new MemoryStore(), secret: "s".repeat(32) }),
  );
  await prisma.adminNotification.deleteMany({
    where: { kind: "bank_account_changed" },
  });
  await prisma.setting.deleteMany({ where: { key: { in: SETTING_KEYS } } });
  await prisma.setting.createMany({
    data: [
      { key: "store.name", value: "Cửa hàng cũ" },
      { key: "bank.bin", value: CURRENT_BANK.bankBin },
      { key: "bank.accountNumber", value: CURRENT_BANK.accountNumber },
      { key: "bank.accountName", value: CURRENT_BANK.accountName },
    ],
  });
  const { token } = await createAdminSession();
  mockCookies.set(SESSION_COOKIE, token);
});

afterEach(() => {
  setOwnerPasswordLimiter(null);
});

afterAll(async () => {
  setOwnerHash(originalOwnerHash);
  await prisma.adminNotification.deleteMany({
    where: { kind: "bank_account_changed" },
  });
  await prisma.setting.deleteMany({ where: { key: { in: SETTING_KEYS } } });
});

describe("Đổi tài khoản nhận tiền cần mật khẩu chủ", () => {
  it("thiếu mật khẩu chủ: từ chối và không đổi Setting nào", async () => {
    const before = await readSettings();

    const result = await saveSettingsAction(null, settingsForm(ATTACKER_BANK));

    expect(result).toEqual({
      ok: false,
      error: "Nhập mật khẩu chủ cửa hàng để đổi tài khoản nhận tiền.",
    });
    expect(await readSettings()).toEqual(before);
    expect(await bankNotifications()).toHaveLength(0);
  });

  it("sai mật khẩu chủ: từ chối và không đổi Setting nào", async () => {
    const before = await readSettings();

    const result = await saveSettingsAction(
      null,
      settingsForm(ATTACKER_BANK, { ownerPassword: "123456" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Mật khẩu chủ cửa hàng không đúng.",
    });
    expect(await readSettings()).toEqual(before);
    expect(await bankNotifications()).toHaveLength(0);
  });

  it("đổi một trường bất kỳ (tên chủ tài khoản) cũng cần mật khẩu chủ", async () => {
    const before = await readSettings();

    const result = await saveSettingsAction(
      null,
      settingsForm({ ...CURRENT_BANK, accountName: "NGUOI LA" }),
    );

    expect(result.ok).toBe(false);
    expect(await readSettings()).toEqual(before);
  });

  it("đúng mật khẩu chủ: lưu, ghi audit và báo admin với số tài khoản đã che", async () => {
    const result = await saveSettingsAction(
      null,
      settingsForm(ATTACKER_BANK, { ownerPassword: OWNER_PASSWORD }),
    );

    expect(result).toEqual({ ok: true, message: "Lưu cài đặt thành công" });
    expect(await readSettings()).toEqual({
      "bank.accountName": ATTACKER_BANK.accountName,
      "bank.accountNumber": ATTACKER_BANK.accountNumber,
      "bank.bin": ATTACKER_BANK.bankBin,
      "store.name": "Cửa Hàng Chính Hãng",
    });

    const notifications = await bankNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].body).toContain("****6789");
    expect(notifications[0].body).toContain("****4321");
    expect(notifications[0].body).not.toContain(CURRENT_BANK.accountNumber);
    expect(notifications[0].body).not.toContain(ATTACKER_BANK.accountNumber);
    expect(notifications[0].href).toBe("/admin/settings");

    const audit = await prisma.adminAuditEvent.findFirst({
      where: { action: "settings.bank_account.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.metadata).toContain("****4321");
    expect(audit?.metadata).not.toContain(ATTACKER_BANK.accountNumber);
    expect(audit?.metadata).not.toContain(OWNER_PASSWORD);
  });

  it("mật khẩu chủ trùng mật khẩu cửa hàng: từ chối và không đổi Setting nào", async () => {
    const originalStoreHash = env.STORE_PASSWORD_HASH;
    // Cung mat khau, salt khac: hai hash khac nhau nhung nhan vien van biet.
    (env as Record<string, unknown>).STORE_PASSWORD_HASH =
      await hashPassword(OWNER_PASSWORD);
    try {
      const before = await readSettings();

      const result = await saveSettingsAction(
        null,
        settingsForm(ATTACKER_BANK, { ownerPassword: OWNER_PASSWORD }),
      );

      expect(result).toEqual({
        ok: false,
        error:
          "Mật khẩu chủ cửa hàng đang trùng mật khẩu đăng nhập cửa hàng. Hãy đặt OWNER_PASSWORD_HASH bằng một mật khẩu khác.",
      });
      expect(await readSettings()).toEqual(before);
      expect(await bankNotifications()).toHaveLength(0);
      const denied = await prisma.adminAuditEvent.findFirst({
        where: { action: "settings.bank_account.denied" },
        orderBy: { createdAt: "desc" },
      });
      expect(denied?.metadata).toContain("same_as_store");
    } finally {
      (env as Record<string, unknown>).STORE_PASSWORD_HASH = originalStoreHash;
    }
  });

  it("giữ nguyên tài khoản ngân hàng thì lưu được mà không cần mật khẩu chủ", async () => {
    const result = await saveSettingsAction(null, settingsForm(CURRENT_BANK));

    expect(result.ok).toBe(true);
    expect((await readSettings())["store.name"]).toBe("Cửa Hàng Chính Hãng");
    expect(await bankNotifications()).toHaveLength(0);
  });

  it("khoá sau 5 lần sai, kể cả khi lần sau nhập đúng", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await saveSettingsAction(
        null,
        settingsForm(ATTACKER_BANK, { ownerPassword: `sai-${attempt}` }),
      );
      expect(wrong).toEqual({
        ok: false,
        error: "Mật khẩu chủ cửa hàng không đúng.",
      });
    }
    const before = await readSettings();

    const locked = await saveSettingsAction(
      null,
      settingsForm(ATTACKER_BANK, { ownerPassword: OWNER_PASSWORD }),
    );

    expect(locked).toEqual({
      ok: false,
      error: "Nhập sai mật khẩu chủ quá nhiều lần. Vui lòng thử lại sau.",
    });
    expect(await readSettings()).toEqual(before);
  });

  it("lần nhập đúng không tính vào hạn mức sai", async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const bank = {
        ...CURRENT_BANK,
        accountNumber: `012345678${attempt}`,
      };
      const result = await saveSettingsAction(
        null,
        settingsForm(bank, { ownerPassword: OWNER_PASSWORD }),
      );
      expect(result.ok).toBe(true);
    }
  });

  describe("chưa cấu hình OWNER_PASSWORD_HASH", () => {
    beforeEach(() => setOwnerHash(undefined));

    it("từ chối đổi tài khoản nhận tiền với thông báo rõ ràng", async () => {
      const before = await readSettings();

      const result = await saveSettingsAction(
        null,
        settingsForm(ATTACKER_BANK, { ownerPassword: OWNER_PASSWORD }),
      );

      expect(result).toEqual({
        ok: false,
        error:
          "Chưa cấu hình mật khẩu chủ cửa hàng (OWNER_PASSWORD_HASH) nên không thể đổi tài khoản nhận tiền.",
      });
      expect(await readSettings()).toEqual(before);
    });

    it("vẫn lưu các cài đặt khác khi tài khoản ngân hàng giữ nguyên", async () => {
      const result = await saveSettingsAction(null, settingsForm(CURRENT_BANK));

      expect(result.ok).toBe(true);
      expect(await readSettings()).toEqual({
        "bank.accountName": CURRENT_BANK.accountName,
        "bank.accountNumber": CURRENT_BANK.accountNumber,
        "bank.bin": CURRENT_BANK.bankBin,
        "store.name": "Cửa Hàng Chính Hãng",
      });
    });
  });
});
