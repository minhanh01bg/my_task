import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage, { generateMetadata } from "@/app/login/page";
import { LoginForm } from "@/app/login/login-form";
import * as storeSettings from "@/server/settings/store-settings";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("LoginPage & LoginForm (Dynamic Store Name)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
    refresh.mockReset();
  });

  it("generateMetadata: trả về title chứa tên cửa hàng động", async () => {
    vi.spyOn(storeSettings, "getStoreName").mockResolvedValue(
      "Tiệm Bách Hóa ABC",
    );
    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({
      absolute: "Đăng nhập | Tiệm Bách Hóa ABC",
    });
    expect(metadata.description).toContain("Tiệm Bách Hóa ABC");
  });

  it("LoginPage: nạp và hiển thị tên cửa hàng động trên giao diện", async () => {
    vi.spyOn(storeSettings, "getStoreName").mockResolvedValue(
      "Tạp Hóa Minh Anh",
    );

    const jsx = await LoginPage();
    render(jsx);

    // Kiểm tra tên cửa hàng hiển thị ở cả phần desktop brand và login card eyebrow
    const storeNameElements = screen.getAllByText("Tạp Hóa Minh Anh");
    expect(storeNameElements.length).toBeGreaterThanOrEqual(2);
  });

  it("LoginForm: hiển thị tên cửa hàng từ props truyền vào", () => {
    render(<LoginForm storeName="Cửa Hàng Xanh" />);

    expect(screen.getByText("Cửa Hàng Xanh")).toBeDefined();
    expect(screen.getByLabelText("Mật khẩu cửa hàng")).toBeDefined();
  });

  it("LoginForm: fallback về biến môi trường NEXT_PUBLIC_STORE_NAME khi storeName rỗng", () => {
    const originalEnv = process.env.NEXT_PUBLIC_STORE_NAME;
    try {
      process.env.NEXT_PUBLIC_STORE_NAME = "Siêu Thị Mini";
      render(<LoginForm storeName="" />);

      expect(screen.getByText("Siêu Thị Mini")).toBeDefined();
    } finally {
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_STORE_NAME = originalEnv;
      } else {
        delete process.env.NEXT_PUBLIC_STORE_NAME;
      }
    }
  });

  it("LoginForm: có nút đổi giao diện sáng/tối ở góc trên thẻ đăng nhập", () => {
    render(<LoginForm storeName="Cửa Hàng Xanh" />);

    expect(
      screen.getByRole("button", {
        name: /chuyển sang giao diện (tối|sáng)|đổi giao diện/i,
      }),
    ).toBeInTheDocument();
  });
});
