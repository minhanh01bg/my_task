import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ClaimOrderButton } from "@/features/customer-account/claim-order-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

it("chưa đăng nhập chuyển tới login và giữ đường dẫn đơn cần lưu", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
  render(<ClaimOrderButton guestToken="fixture-token" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Lưu đơn hàng vào tài khoản của bạn" }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      "/account/login?next=%2Forders%2Fguest%2Ffixture-token",
    ),
  );
});

it("khách chưa xác minh thấy hướng dẫn thay vì gửi yêu cầu bị từ chối", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<ClaimOrderButton guestToken="fixture-token" phoneVerified={false} />);
  expect(
    screen.getByRole("button", { name: "Lưu đơn hàng vào tài khoản của bạn" }),
  ).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "xác minh số điện thoại",
  );
  expect(fetch).not.toHaveBeenCalled();
});
