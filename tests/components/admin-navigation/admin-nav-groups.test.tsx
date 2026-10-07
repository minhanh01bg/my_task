import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AdminNav } from "@/features/admin-navigation/admin-nav";

const route = vi.hoisted(() => ({ pathname: "/admin/orders" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/admin-search/admin-search-button", () => ({
  AdminSearchButton: () => null,
}));
vi.mock("@/features/admin-notifications/notification-button", () => ({
  NotificationButton: () => null,
}));

beforeEach(() => {
  route.pathname = "/admin/orders";
  localStorage.clear();
});
function sidebar() {
  return screen.getByRole("navigation", { name: "Điều hướng quản lý" });
}

it("opens and collapses promotion children using a separate toggle", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  const nav = within(sidebar());
  const parent = nav.getByRole("button", { name: "Mở/thu mục con Khuyến mãi" });
  expect(parent).toHaveAttribute("aria-expanded", "false");
  expect(
    nav.queryByRole("link", { name: "Mã giảm giá" }),
  ).not.toBeInTheDocument();
  await user.click(parent);
  expect(parent).toHaveAttribute("aria-expanded", "true");
  expect(
    nav.getByRole("link", { name: "Chiến dịch khuyến mãi" }),
  ).toHaveAttribute("href", "/admin/promotions");
  expect(nav.getByRole("link", { name: "Mã giảm giá" })).toHaveAttribute(
    "href",
    "/admin/promotions/vouchers",
  );
  await user.keyboard(" ");
  expect(parent).toHaveAttribute("aria-expanded", "false");
  expect(
    nav.queryByRole("link", { name: "Mã giảm giá" }),
  ).not.toBeInTheDocument();
  expect(parent).toHaveFocus();
});

it("automatically opens the active group on route changes and marks only the current child", () => {
  const view = render(<AdminNav />);
  route.pathname = "/admin/promotions/vouchers";
  view.rerender(<AdminNav />);
  const nav = within(sidebar());
  expect(
    nav.getByRole("button", { name: "Mở/thu mục con Khuyến mãi" }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(nav.getByRole("link", { name: "Mã giảm giá" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    nav.getByRole("link", { name: "Chiến dịch khuyến mãi" }),
  ).not.toHaveAttribute("aria-current");
});

it("opens a named flyout from the compact icon and returns focus on Escape", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  fireEvent.keyDown(screen.getByRole("separator"), { key: "Home" });
  const parent = within(sidebar()).getByRole("button", { name: "Khuyến mãi" });
  await user.click(parent);
  const menu = await screen.findByRole("dialog", { name: "Khuyến mãi" });
  expect(within(menu).getByRole("link", { name: "Mã giảm giá" })).toBeVisible();
  expect(
    within(sidebar()).queryByRole("link", { name: "Mã giảm giá" }),
  ).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Khuyến mãi" }),
    ).not.toBeInTheDocument(),
  );
  expect(parent).toHaveFocus();
});

it("keeps the group trigger focused while resizing and closes the mobile menu after selecting a child", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  const parent = within(sidebar()).getByRole("link", { name: "Khuyến mãi" });
  parent.focus();
  fireEvent.keyDown(screen.getByRole("separator"), { key: "Home" });
  expect(parent).toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
  );
  const menu = screen.getByRole("dialog", { name: "Menu quản lý" });
  await user.click(
    within(menu).getByRole("button", { name: "Mở/thu mục con Khuyến mãi" }),
  );
  fireEvent.click(within(menu).getByRole("link", { name: "Mã giảm giá" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Menu quản lý" }),
    ).not.toBeInTheDocument(),
  );
});

it("does not reopen an old flyout after expanding and collapsing the sidebar", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  const handle = screen.getByRole("separator");
  fireEvent.keyDown(handle, { key: "Home" });
  await user.click(
    within(sidebar()).getByRole("button", { name: "Khuyến mãi" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Khuyến mãi" }),
  ).toBeVisible();
  fireEvent.keyDown(handle, { key: "End" });
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Khuyến mãi" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.keyDown(handle, { key: "Home" });
  expect(
    within(sidebar()).getByRole("button", { name: "Khuyến mãi" }),
  ).toHaveAttribute("aria-expanded", "false");
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Khuyến mãi" }),
    ).not.toBeInTheDocument(),
  );
});

it("opens the campaign page in one click and reveals children from the parent link", async () => {
  render(<AdminNav />);
  const nav = within(sidebar());
  const parent = nav.getByRole("link", { name: "Khuyến mãi" });
  expect(parent).toHaveAttribute("href", "/admin/promotions");
  fireEvent.click(parent);
  expect(nav.getByRole("link", { name: "Mã giảm giá" })).toBeVisible();
  expect(
    nav.getByRole("button", { name: "Mở/thu mục con Khuyến mãi" }),
  ).toHaveAttribute("aria-expanded", "true");
});

it("closes the mobile menu when navigating directly from the parent link", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  await user.click(
    screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
  );
  const menu = screen.getByRole("dialog", { name: "Menu quản lý" });
  const parent = within(menu).getByRole("link", {
    name: "Khuyến mãi",
  });
  expect(parent).toHaveAttribute("href", "/admin/promotions");
  fireEvent.click(parent);
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Menu quản lý" }),
    ).not.toBeInTheDocument(),
  );
});

it("keeps Space as native link behavior in expanded mode and uses it to open the compact flyout", async () => {
  const user = userEvent.setup();
  render(<AdminNav />);
  const nav = within(sidebar());
  const parent = nav.getByRole("link", { name: "Khuyến mãi" });
  parent.focus();
  await user.keyboard(" ");
  expect(
    nav.getByRole("button", { name: "Mở/thu mục con Khuyến mãi" }),
  ).toHaveAttribute("aria-expanded", "false");
  fireEvent.keyDown(screen.getByRole("separator"), { key: "Home" });
  expect(parent).toHaveFocus();
  await user.keyboard(" ");
  expect(
    await screen.findByRole("dialog", { name: "Khuyến mãi" }),
  ).toBeVisible();
});
