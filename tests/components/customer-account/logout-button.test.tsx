import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CustomerLogoutButton } from "@/features/customer-account/logout-button";
import { rememberPendingClaim } from "@/features/customer-account/pending-claim";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

const CUSTOMER_KEYS = [
  "online-cart-v1",
  "online-voucher-v1",
  "online-wishlist-v1",
  "pos_store_recently_viewed",
];

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

it("xoá dữ liệu khách trên máy trước khi về cửa hàng (WB-4)", async () => {
  for (const key of CUSTOMER_KEYS) localStorage.setItem(key, '["x"]');
  rememberPendingClaim("guest-token");
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(null, { status: 204 }));
  let leftAtRedirect: Array<string | null> = [];
  replace.mockImplementation(() => {
    leftAtRedirect = [
      ...CUSTOMER_KEYS.map((key) => localStorage.getItem(key)),
      sessionStorage.getItem("an-phat-pending-claim"),
    ];
  });

  render(<CustomerLogoutButton />);
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/shop"));
  expect(fetchMock).toHaveBeenCalledWith("/api/customer-auth/logout", {
    method: "POST",
  });
  expect(leftAtRedirect).toEqual([null, null, null, null, null]);
  expect(refresh).toHaveBeenCalled();
});
