import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAuthForm } from "@/features/customer-account/auth-form";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

describe("CustomerAuthForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    refresh.mockReset();
  });
  it("gửi đúng boundary login và điều hướng account", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { account: { displayName: "An" } } }),
          { status: 200 },
        ),
      );
    render(<CustomerAuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0901234567" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "a-secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/account/orders"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/customer-auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
