import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  getPublicStoreProfile,
  saveStoreProfile,
} from "@/server/settings/store-settings";
import { adminSettingsSchema } from "@/app/admin/settings/actions";

describe("Store Settings & Public Profile", () => {
  beforeEach(async () => {
    await prisma.setting.deleteMany({
      where: {
        key: {
          in: [
            "store.name",
            "store.hotline",
            "store.address",
            "store.openingHours",
            "store.mapUrl",
            "bank.bin",
            "bank.accountNumber",
            "bank.accountName",
          ],
        },
      },
    });
  });

  it("getPublicStoreProfile: trả về profile mặc định khi chưa có dữ liệu", async () => {
    const profile = await getPublicStoreProfile();
    expect(profile).toEqual({
      name: "Cửa hàng",
    });
  });

  it("getPublicStoreProfile: chỉ trả về các trường allowlist công khai, không lộ bank info hay raw setting rows", async () => {
    // Lưu cả cài đặt ngân hàng bí mật và thông tin cửa hàng
    await prisma.setting.createMany({
      data: [
        { key: "store.name", value: "Tạp Hóa Xanh" },
        { key: "store.hotline", value: "0901234567" },
        { key: "store.address", value: "123 Đường Số 1, Quận 1, TP.HCM" },
        { key: "store.openingHours", value: "08:00 - 21:00 hàng ngày" },
        {
          key: "store.mapUrl",
          value: "https://maps.google.com/?q=10.7,106.6",
        },
        { key: "bank.bin", value: "970423" },
        { key: "bank.accountNumber", value: "0123456789" },
        { key: "bank.accountName", value: "SECRET OWNER" },
      ],
    });

    const profile = await getPublicStoreProfile();
    expect(profile.name).toBe("Tạp Hóa Xanh");
    expect(profile.hotline).toBe("0901234567");
    expect(profile.address).toBe("123 Đường Số 1, Quận 1, TP.HCM");
    expect(profile.openingHours).toBe("08:00 - 21:00 hàng ngày");
    expect(profile.mapUrl).toBe("https://maps.google.com/?q=10.7,106.6");

    // Tuyệt đối không chứa trường ngân hàng hay raw keys
    expect(profile).not.toHaveProperty("bankBin");
    expect(profile).not.toHaveProperty("accountNumber");
    expect(profile).not.toHaveProperty("accountName");
    expect(profile).not.toHaveProperty("bank.bin");
  });

  it("saveStoreProfile: lưu các trường namespaced chuẩn xác", async () => {
    await saveStoreProfile({
      name: "Cửa Hàng Tiện Lợi",
      hotline: "0912345678",
      address: "456 Lê Duẩn, Đà Nẵng",
      openingHours: "07:00 - 22:00",
      mapUrl: "https://maps.app.goo.gl/xyz",
    });

    const profile = await getPublicStoreProfile();
    expect(profile.name).toBe("Cửa Hàng Tiện Lợi");
    expect(profile.hotline).toBe("0912345678");
    expect(profile.address).toBe("456 Lê Duẩn, Đà Nẵng");
    expect(profile.openingHours).toBe("07:00 - 22:00");
    expect(profile.mapUrl).toBe("https://maps.app.goo.gl/xyz");
  });

  it("adminSettingsSchema: validate store name, hotline, address, hours và map URL", () => {
    const valid = {
      storeName: "Tạp Hóa ABC",
      hotline: "0901234567",
      address: "123 Phố Huế, Hà Nội",
      openingHours: "08:00 - 22:00",
      mapUrl: "https://maps.google.com/test",
      bankBin: "970423",
      accountNumber: "123456789",
      accountName: "NGUYEN VAN A",
    };

    expect(adminSettingsSchema.safeParse(valid).success).toBe(true);

    // Không có mapUrl vẫn hợp lệ (optional)
    expect(
      adminSettingsSchema.safeParse({ ...valid, mapUrl: "" }).success,
    ).toBe(true);

    // mapUrl không phải HTTPS bị từ chối
    expect(
      adminSettingsSchema.safeParse({
        ...valid,
        mapUrl: "http://maps.google.com/insecure",
      }).success,
    ).toBe(false);

    // mapUrl là javascript: bị từ chối
    expect(
      adminSettingsSchema.safeParse({
        ...valid,
        mapUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);

    // hotline quá ngắn bị từ chối
    expect(
      adminSettingsSchema.safeParse({
        ...valid,
        hotline: "123",
      }).success,
    ).toBe(false);

    // storeName rỗng bị từ chối
    expect(
      adminSettingsSchema.safeParse({
        ...valid,
        storeName: "",
      }).success,
    ).toBe(false);
  });
});
