import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/features/admin-navigation/admin-nav";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/features/admin-search/admin-search-button", () => ({
  AdminSearchButton: () => null,
}));
vi.mock("@/features/admin-notifications/notification-button", () => ({
  NotificationButton: ({ placement }: { placement?: string }) => (
    <button type="button">Thông báo {placement}</button>
  ),
}));

beforeEach(() => {
  localStorage.removeItem("admin-sidebar-width");
  localStorage.removeItem("admin-sidebar-expanded-width");
});

describe("AdminNav", () => {
  it("công cụ chung nằm trên navbar, sidebar chỉ giữ chức năng", () => {
    const { container } = render(<AdminNav />);
    const header = container.querySelector("header")!;
    expect(header).not.toHaveClass("md:hidden");
    expect(
      within(header).getByRole("button", { name: "Thông báo mobile" }),
    ).toBeInTheDocument();
    expect(
      within(container.querySelector("aside")!).queryByRole("button", {
        name: /Thông báo/,
      }),
    ).not.toBeInTheDocument();
  });
  it("có top bar, bottom navigation và trạng thái trang hiện tại", () => {
    render(<AdminNav />);

    expect(screen.getByText("Quản lý")).toBeInTheDocument();
    const mobileNav = screen.getByRole("navigation", {
      name: "Điều hướng quản lý trên điện thoại",
    });
    expect(within(mobileNav).getByText("Bán hàng")).toBeInTheDocument();
    expect(
      within(mobileNav).getByRole("link", { name: "Tổng quan" }),
    ).toHaveAttribute("href", "/admin");
    expect(
      screen.queryByRole("link", { name: "Báo cáo" }),
    ).not.toBeInTheDocument();
    expect(
      within(mobileNav).getByText("Đơn hàng").closest("a"),
    ).toHaveAttribute("aria-current", "page");
  });

  it("mở menu đầy đủ và đóng sau khi chọn chức năng", () => {
    render(<AdminNav />);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Menu quản lý",
    });
    expect(within(dialog).getByText("Công nợ")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("link", { name: /Công nợ/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("có skip link đến nội dung chính", () => {
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "Bỏ qua menu" })).toHaveAttribute(
      "href",
      "#admin-main-content",
    );
  });

  it("sidebar desktop có md:z-40 để nằm trên nội dung bảng chính", () => {
    const { container } = render(<AdminNav />);
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("md:z-40");
  });

  it("menu sidebar cuộn riêng trên màn hình chiều cao nhỏ", () => {
    const { container } = render(<AdminNav />);
    const nav = within(container.querySelector("aside")!).getByRole(
      "navigation",
      {
        name: "Điều hướng quản lý",
      },
    );
    expect(nav).toHaveClass("overflow-y-auto");
  });

  it("đổi chiều rộng sidebar bằng bàn phím và ghi nhớ lựa chọn", () => {
    localStorage.removeItem("admin-sidebar-width");
    localStorage.removeItem("admin-sidebar-expanded-width");
    const { container } = render(<AdminNav />);
    const aside = container.querySelector("aside");
    const handle = screen.getByRole("separator", {
      name: "Thay đổi chiều rộng thanh điều hướng",
    });

    expect(aside).toHaveStyle({ width: "250px" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(aside).toHaveStyle({ width: "266px" });
    expect(localStorage.getItem("admin-sidebar-width")).toBe("266");

    fireEvent.keyDown(handle, { key: "Home" });
    expect(aside).toHaveStyle({ width: "72px" });
    expect(aside).toHaveAttribute("data-compact", "true");
    expect(
      within(aside!).getByRole("link", { name: "Đơn hàng" }),
    ).toHaveAttribute("href", "/admin/orders");
    fireEvent.keyDown(handle, { key: "End" });
    expect(aside).toHaveStyle({ width: "360px" });
  });

  it("thu gọn vẫn giữ menu icon và mở rộng về chiều rộng đã chọn", () => {
    const { container } = render(<AdminNav />);
    const aside = container.querySelector("aside")!;
    const handle = screen.getByRole("separator", {
      name: "Thay đổi chiều rộng thanh điều hướng",
    });
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.click(
      screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }),
    );
    expect(aside).toHaveStyle({ width: "72px" });
    expect(localStorage.getItem("admin-sidebar-width")).toBe("72");
    expect(
      within(aside).getByRole("link", { name: "Đơn hàng" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(
      screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }),
    );
    expect(aside).toHaveStyle({ width: "360px" });
  });

  it("thu gọn rồi tải lại vẫn mở rộng đúng chiều rộng đã chọn trước đó", async () => {
    const first = render(<AdminNav />);
    fireEvent.keyDown(
      screen.getByRole("separator", {
        name: "Thay đổi chiều rộng thanh điều hướng",
      }),
      { key: "End" },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }),
    );
    first.unmount();
    const second = render(<AdminNav />);
    await waitFor(() =>
      expect(second.container.querySelector("aside")).toHaveStyle({
        width: "72px",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }),
    );
    expect(second.container.querySelector("aside")).toHaveStyle({
      width: "360px",
    });
  });

  it("ghi nhớ chế độ icon sau khi tải lại và giữ tên chức năng truy cập được", async () => {
    localStorage.setItem("admin-sidebar-width", "72");
    const { container } = render(<AdminNav />);
    const aside = container.querySelector("aside")!;
    await waitFor(() => expect(aside).toHaveStyle({ width: "72px" }));
    expect(aside).toHaveAttribute("data-compact", "true");
    expect(
      within(aside).getByRole("link", { name: "Cài đặt" }),
    ).toHaveAttribute("href", "/admin/settings");
  });

  it("liên kết cửa hàng online nằm trên navbar và không lặp trong menu", () => {
    const { container } = render(<AdminNav />);
    expect(
      within(container.querySelector("header")!).getByRole("link", {
        name: "Xem cửa hàng online",
      }),
    ).toHaveAttribute("href", "/shop");
    expect(
      within(container.querySelector("aside")!).queryByRole("link", {
        name: "Xem cửa hàng online",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    expect(
      within(screen.getByRole("dialog", { name: "Menu quản lý" })).queryByRole(
        "link",
        {
          name: "Xem cửa hàng online",
        },
      ),
    ).not.toBeInTheDocument();
  });

  it("đóng menu bằng phím Escape và trả focus về nút mở", async () => {
    render(<AdminNav />);
    const trigger = screen.getByRole("button", {
      name: "Mở toàn bộ menu quản lý",
    });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("đăng xuất admin, đóng menu và chuyển về trang đăng nhập", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AdminNav />);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Menu quản lý" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));

    expect(fetchMock).not.toHaveBeenCalled();
    const confirmation = screen.getByRole("dialog", {
      name: "Đăng xuất khỏi quản lý?",
    });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Hủy" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đăng xuất" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Đăng xuất khỏi quản lý?" }),
      ).getByRole("button", { name: "Đăng xuất" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
      });
      expect(replace).toHaveBeenCalledWith("/login");
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fetchMock.mockRestore();
  });

  it("menu đầy đủ là Sheet trượt lên từ cạnh dưới", () => {
    render(<AdminNav />);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Menu quản lý" });
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(dialog).toHaveAttribute("data-side", "bottom");
    expect(dialog).not.toHaveAttribute("id", "mobile-admin-menu");
    expect(within(dialog).getByText("Đơn hàng").closest("a")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("đóng menu bằng nút Đóng menu", async () => {
    render(<AdminNav />);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Đóng menu" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("gan huy hieu ton kho thap vao muc San pham khi server truyen vao", () => {
    render(<AdminNav productsBadge={<span data-testid="low-stock">3</span>} />);
    const badge = screen.getByTestId("low-stock");
    expect(badge.closest("a")).toHaveAttribute("href", "/admin/products");
  });
  it("giữ số hàng sắp hết trong tên truy cập của menu khi thu gọn", () => {
    render(<AdminNav productsBadge={<span>4 sản phẩm sắp hết hàng</span>} />);
    expect(
      screen.getByRole("link", { name: /Sản phẩm\s*4 sản phẩm sắp hết hàng/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Thu gọn thanh điều hướng" }),
    );
    expect(
      screen.getByRole("link", { name: /Sản phẩm\s*4 sản phẩm sắp hết hàng/ }),
    ).toBeInTheDocument();
  });
});
