import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAuthForm } from "@/features/customer-account/auth-form";
import {
  rememberPendingClaim,
  takePendingClaimPath,
} from "@/features/customer-account/pending-claim";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

describe("CustomerAuthForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    refresh.mockReset();
  });
  it("hiển thị lỗi từng trường thay cho bong bóng required", async () => {
    render(<CustomerAuthForm mode="login" />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Đăng nhập" }).closest("form")!,
    );
    expect(
      await screen.findByText("Vui lòng nhập số điện thoại."),
    ).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập mật khẩu.")).toBeInTheDocument();
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Số điện thoại")).toHaveFocus();
  });
  it("khôi phục nút gửi khi mất kết nối", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    render(<CustomerAuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0901234567" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "a-secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(
      await screen.findByText("Không thể kết nối. Vui lòng thử lại."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
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

it("login quay lại đơn đang lưu và link đăng ký giữ next", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 200 }),
  );
  render(
    <CustomerAuthForm mode="login" returnTo="/orders/guest/fixture-token" />,
  );
  expect(screen.getByRole("link", { name: "Đăng ký" })).toHaveAttribute(
    "href",
    "/account/register?next=%2Forders%2Fguest%2Ffixture-token",
  );
  fireEvent.change(screen.getByLabelText("Số điện thoại"), {
    target: { value: "0901234567" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: "a-secure-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith("/orders/guest/fixture-token"),
  );
});

describe("đơn khách chờ lưu sau đăng nhập (WB-1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
  });

  async function login() {
    render(<CustomerAuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0901234567" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "a-secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
  }

  it("quay lại đơn đã giữ trong sessionStorage rồi xoá nó", async () => {
    rememberPendingClaim("fixture-token");

    await login();

    expect(replace).toHaveBeenCalledWith("/orders/guest/fixture-token");
    expect(takePendingClaimPath()).toBeNull();
  });

  it("bỏ qua đơn chờ đã quá hạn", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now - 31 * 60_000);
    rememberPendingClaim("fixture-token");
    vi.mocked(Date.now).mockReturnValue(now);

    await login();

    expect(replace).toHaveBeenCalledWith("/account/orders");
  });

  it("từ chối token sai định dạng trong sessionStorage", async () => {
    sessionStorage.setItem(
      "an-phat-pending-claim",
      JSON.stringify({ token: "../../admin", savedAt: Date.now() }),
    );

    await login();

    expect(replace).toHaveBeenCalledWith("/account/orders");
  });
});
