import { describe, expect, it } from "vitest";

import { resolveDefaultStoreName } from "@/config/store-name";

describe("resolveDefaultStoreName", () => {
  it("ưu tiên NEXT_PUBLIC_STORE_NAME", () => {
    expect(
      resolveDefaultStoreName({
        NEXT_PUBLIC_STORE_NAME: "Cửa hàng An Phát",
        STORE_NAME: "An Phát POS",
      }),
    ).toBe("Cửa hàng An Phát");
  });

  it("dùng STORE_NAME khi không có NEXT_PUBLIC_STORE_NAME", () => {
    expect(resolveDefaultStoreName({ STORE_NAME: " Tạp hoá Minh An " })).toBe(
      "Tạp hoá Minh An",
    );
  });

  it("bỏ qua giá trị rỗng/khoảng trắng và quay về 'Cửa hàng'", () => {
    expect(
      resolveDefaultStoreName({ NEXT_PUBLIC_STORE_NAME: "  ", STORE_NAME: "" }),
    ).toBe("Cửa hàng");
    expect(resolveDefaultStoreName({})).toBe("Cửa hàng");
  });

  it("không dùng NEXT_PUBLIC_APP_NAME làm tên cửa hàng", () => {
    expect(
      resolveDefaultStoreName({
        NEXT_PUBLIC_APP_NAME: "Next.js with Agent",
      } as Record<string, string | undefined>),
    ).toBe("Cửa hàng");
  });
});
