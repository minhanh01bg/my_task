import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "@/app/(management)/admin/products/product-form";
import { QuickProductEdit } from "@/app/(management)/admin/products/quick-product-edit";
import { SettingsForm } from "@/app/(management)/admin/settings/settings-form";
import { ToastProvider } from "@/components/ui/toast";

const actions = vi.hoisted(() => ({
  settings: vi.fn(),
  product: vi.fn(),
  quick: vi.fn(),
}));
vi.mock("@/app/(management)/admin/settings/actions", () => ({
  saveSettingsAction: actions.settings,
}));
vi.mock("@/app/(management)/admin/products/actions", () => ({
  saveProductAction: actions.product,
  quickUpdateProductAction: actions.quick,
}));

const product = {
  id: "p1",
  name: "Đường",
  aliases: null,
  sku: null,
  categoryId: null,
  unit: "kg",
  stock: 2,
  price: 10000,
  costPrice: 5000,
  imageUrl: null,
};

async function expectToast(title: string, type: string) {
  await waitFor(() => {
    const titles = screen.getAllByText(title);
    expect(
      titles.some(
        (element) =>
          element.closest("[data-slot='toast']")?.getAttribute("data-type") ===
          type,
      ),
    ).toBe(true);
  });
}

beforeEach(() => vi.resetAllMocks());

describe("Thông báo sau khi lưu", () => {
  it.each([true, false])(
    "cài đặt hiển thị toast khi ok=%s, kể cả lưu lại cùng kết quả",
    async (ok) => {
      const title = ok ? "Đã lưu cài đặt" : "Thông tin không hợp lệ";
      actions.settings.mockImplementation(async () =>
        ok ? { ok, message: title } : { ok, error: title },
      );
      render(
        <ToastProvider>
          <SettingsForm
            storeProfile={{
              name: "Cửa hàng",
              hotline: undefined,
              address: undefined,
              openingHours: undefined,
              mapUrl: undefined,
            }}
            account={{
              bankBin: "970423",
              accountNumber: "123456",
              accountName: "NGUYEN VAN A",
            }}
            shipping={{ shippingFee: 0, freeShippingThreshold: 0 }}
          />
        </ToastProvider>,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
      await expectToast(title, ok ? "success" : "error");
      await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
      await waitFor(() =>
        expect(document.querySelectorAll("[data-slot='toast']")).toHaveLength(
          2,
        ),
      );
    },
  );

  it.each([true, false, "throw"])(
    "sản phẩm hiển thị toast khi kết quả=%s",
    async (result) => {
      if (result === "throw")
        actions.product.mockRejectedValue(new Error("private server error"));
      else
        actions.product.mockResolvedValue({
          ok: result,
          message: "Không thể lưu sản phẩm",
        });
      render(
        <ToastProvider>
          <ProductForm categories={[]} product={product} />
        </ToastProvider>,
      );
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Lưu thay đổi" }));
      await expectToast(
        result === true
          ? "Đã lưu sản phẩm thành công"
          : result === false
            ? "Không thể lưu sản phẩm"
            : "Không thể lưu sản phẩm. Vui lòng thử lại.",
        result === true ? "success" : "error",
      );
      expect(
        screen.getByRole("button", { name: "Lưu thay đổi" }),
      ).toBeEnabled();
      expect(
        screen.queryByText("private server error"),
      ).not.toBeInTheDocument();
    },
  );

  it.each([true, false, "throw"])(
    "sửa nhanh hiển thị toast khi kết quả=%s",
    async (result) => {
      if (result === "throw")
        actions.quick.mockRejectedValue(new Error("private server error"));
      else
        actions.quick.mockResolvedValue({
          ok: result,
          message: "Không thể lưu sản phẩm",
        });
      render(
        <ToastProvider>
          <QuickProductEdit product={product} />
        </ToastProvider>,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Sửa nhanh giá/ }));
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
      await expectToast(
        result === true
          ? "Đã lưu sản phẩm thành công"
          : result === false
            ? "Không thể lưu sản phẩm"
            : "Không thể lưu sản phẩm. Vui lòng thử lại.",
        result === true ? "success" : "error",
      );
      if (result === true)
        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "Sửa nhanh Đường" }),
          ).not.toBeInTheDocument(),
        );
      else
        expect(
          screen.getByRole("button", { name: "Lưu thay đổi" }),
        ).toBeEnabled();
    },
  );
});

it("cài đặt: lỗi bất ngờ không lộ chi tiết, giữ dữ liệu và thử lại được", async () => {
  actions.settings
    .mockRejectedValueOnce(new Error("password=private-secret"))
    .mockResolvedValueOnce({ ok: true, message: "Lưu cài đặt thành công" });
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
      />
    </ToastProvider>,
  );
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText(/Tên cửa hàng/));
  await user.type(screen.getByLabelText(/Tên cửa hàng/), "Thông tin cần giữ");
  await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
  await expectToast("Không thể lưu cài đặt. Vui lòng thử lại.", "error");
  expect(screen.getByLabelText(/Tên cửa hàng/)).toHaveValue(
    "Thông tin cần giữ",
  );
  expect(screen.queryByText(/private-secret/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
  await expectToast("Lưu cài đặt thành công", "success");
});

it.each(["settings", "product", "quick"] as const)(
  "%s: khóa nút trong lúc lưu, không gửi lặp, lỗi vẫn giữ dữ liệu để thử lại",
  async (kind) => {
    type Result = { ok: false; error: string; message: string };
    let finish!: (result: Result) => void;
    actions[kind].mockImplementationOnce(
      () =>
        new Promise<Result>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ToastProvider>
        {kind === "settings" ? (
          <SettingsForm
            storeProfile={{ name: "Cửa hàng" }}
            account={{
              bankBin: "970423",
              accountNumber: "123456",
              accountName: "NGUYEN VAN A",
            }}
            shipping={{ shippingFee: 0, freeShippingThreshold: 0 }}
          />
        ) : kind === "product" ? (
          <ProductForm categories={[]} product={product} />
        ) : (
          <QuickProductEdit product={product} />
        )}
      </ToastProvider>,
    );
    const user = userEvent.setup();
    if (kind === "quick")
      await user.click(screen.getByRole("button", { name: /Sửa nhanh giá/ }));
    const field =
      kind === "settings"
        ? screen.getByLabelText(/Tên cửa hàng/)
        : kind === "product"
          ? screen.getByLabelText("Tên sản phẩm")
          : screen.getByRole("spinbutton", { name: /^Giá bán$/ });
    const value = kind === "quick" ? "7500" : "Nội dung đang sửa";
    await user.clear(field);
    await user.type(field, value);
    await user.click(
      screen.getByRole("button", {
        name: kind === "settings" ? "Lưu cài đặt" : "Lưu thay đổi",
      }),
    );
    const saving = screen.getByRole("button", {
      name: kind === "settings" ? "Đang lưu cài đặt…" : "Đang lưu…",
    });
    expect(saving).toBeDisabled();
    await user.click(saving);
    expect(actions[kind]).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("[data-slot='toast']")).toHaveLength(0);
    finish({ ok: false, error: "Không lưu được", message: "Không lưu được" });
    await expectToast("Không lưu được", "error");
    expect(field).toHaveValue(kind === "quick" ? 7500 : value);
    const retry = await screen.findByRole("button", {
      name: kind === "settings" ? "Lưu cài đặt" : "Lưu thay đổi",
    });
    expect(retry).toBeEnabled();
    if (kind === "quick")
      expect(
        screen.getByRole("dialog", { name: "Sửa nhanh Đường" }),
      ).toBeInTheDocument();
    actions[kind].mockResolvedValueOnce(
      kind === "settings"
        ? { ok: true, message: "Lưu cài đặt thành công" }
        : { ok: true },
    );
    await user.click(retry);
    await expectToast(
      kind === "settings"
        ? "Lưu cài đặt thành công"
        : "Đã lưu sản phẩm thành công",
      "success",
    );
  },
);
