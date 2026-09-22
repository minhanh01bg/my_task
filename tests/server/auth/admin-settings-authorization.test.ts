import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveSettingsAction } from "@/app/admin/settings/actions";
import SettingsPage from "@/app/admin/settings/page";
import AdminLayout from "@/app/admin/layout";
import { createAdminSession, SESSION_COOKIE } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

const mockCookies = new Map<string, string>();
const mockRedirect = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const val = mockCookies.get(name);
      return val ? { name, value: val } : undefined;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/settings",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Admin Settings Authorization & Protection", () => {
  beforeEach(() => {
    mockCookies.clear();
    mockRedirect.mockClear();
    vi.clearAllMocks();
  });

  it("saveSettingsAction: từ chối và trả về lỗi quyền khi chưa đăng nhập", async () => {
    const formData = new FormData();
    formData.set("storeName", "Hacker Store");
    formData.set("bankBin", "970423");
    formData.set("accountNumber", "999999999");
    formData.set("accountName", "HACKER NAME");

    const result = await saveSettingsAction(null, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("quản trị");
    }

    // Xác minh thông tin ngân hàng trong DB không bị sửa đổi
    const bankBin = await prisma.setting.findUnique({
      where: { key: "bank.bin" },
    });
    expect(bankBin?.value).not.toBe("970423");
  });

  it("saveSettingsAction: lưu thành công và ghi audit log khi có phiên admin hợp lệ", async () => {
    const { token } = await createAdminSession();
    mockCookies.set(SESSION_COOKIE, token);

    const formData = new FormData();
    formData.set("storeName", "Cửa Hàng Chính Hãng");
    formData.set("bankBin", "970407");
    formData.set("accountNumber", "0123456789");
    formData.set("accountName", "CHỦ CỬA HÀNG");

    const result = await saveSettingsAction(null, formData);

    expect(result.ok).toBe(true);

    // Kiểm tra DB đã cập nhật
    const bankAccount = await prisma.setting.findUnique({
      where: { key: "bank.accountNumber" },
    });
    expect(bankAccount?.value).toBe("0123456789");

    // Kiểm tra audit log
    const auditLog = await prisma.adminAuditEvent.findFirst({
      where: { action: "settings.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.entityType).toBe("store_settings");
  });

  it("SettingsPage: chuyển hướng đến /login khi chưa có phiên đăng nhập", async () => {
    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("AdminLayout: chuyển hướng đến /login khi chưa có phiên đăng nhập", async () => {
    await expect(AdminLayout({ children: "content" })).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
