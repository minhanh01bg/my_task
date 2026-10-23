import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsForm } from "@/app/(management)/admin/settings/settings-form";
import { ToastProvider } from "@/components/ui/toast";

const saveSettingsAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(management)/admin/settings/actions", () => ({
  saveSettingsAction,
}));

function renderForm(ownerPasswordConfigured: boolean) {
  render(
    <ToastProvider>
      <SettingsForm
        storeProfile={{ name: "Cửa hàng" }}
        account={{
          bankBin: "970423",
          accountNumber: "123456",
          accountName: "NGUYEN VAN A",
        }}
        shipping={{ shippingFee: 0, freeShippingThreshold: 0 }}
        ownerPasswordConfigured={ownerPasswordConfigured}
      />
    </ToastProvider>,
  );
}

beforeEach(() => vi.resetAllMocks());

describe("SettingsForm — mật khẩu chủ cửa hàng", () => {
  it("hiện ô mật khẩu chủ không cho trình duyệt tự điền khi đã cấu hình", () => {
    renderForm(true);

    const input = screen.getByLabelText("Mật khẩu chủ cửa hàng");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("name", "ownerPassword");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).not.toBeRequired();
  });

  it("chưa cấu hình thì không có ô nhập và báo không thể đổi tài khoản", () => {
    renderForm(false);

    expect(screen.queryByLabelText("Mật khẩu chủ cửa hàng")).toBeNull();
    expect(screen.getByText(/OWNER_PASSWORD_HASH/)).toBeInTheDocument();
  });

  it("gửi mật khẩu chủ rồi xoá khỏi ô nhập sau mỗi lần lưu", async () => {
    saveSettingsAction.mockResolvedValue({
      ok: false,
      error: "Mật khẩu chủ cửa hàng không đúng.",
    });
    renderForm(true);
    const user = userEvent.setup();

    const input = screen.getByLabelText("Mật khẩu chủ cửa hàng");
    await user.type(input, "chu-cua-hang");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(saveSettingsAction).toHaveBeenCalledTimes(1));
    const formData = saveSettingsAction.mock.calls[0][1] as FormData;
    expect(formData.get("ownerPassword")).toBe("chu-cua-hang");
    expect(input).toHaveValue("");
    expect(screen.getByLabelText("Số tài khoản *")).toHaveValue("123456");
  });
});
