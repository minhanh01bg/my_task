import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutForm } from "@/features/online-store/checkout-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/shop/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

const mockCartItems = [
  {
    id: "p1",
    name: "Cà phê Robusta",
    price: 50_000,
    quantity: 2,
    stock: 10,
    unit: "gói",
  },
];

describe("CheckoutForm - Structured Address & Experience", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("online-cart-v1", JSON.stringify(mockCartItems));
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  it("mở thanh toán được trên HTTP khi crypto.randomUUID không tồn tại", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });

    render(<CheckoutForm />);
    expect(
      screen.getByRole("button", { name: /xác nhận đặt hàng/i }),
    ).toBeInTheDocument();
  });

  async function selectDropdown(
    triggerLabel: RegExp,
    optionText: RegExp,
    user: ReturnType<typeof userEvent.setup>,
  ) {
    const trigger = screen.getByRole("combobox", { name: triggerLabel });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: optionText });
    await user.click(option);
  }

  it("chọn tỉnh trực tiếp mở xã/phường và đổi tỉnh xóa xã cũ, không còn huyện", async () => {
    const user = userEvent.setup();
    render(<CheckoutForm />);
    const ward = screen.getByRole("combobox", { name: /phường\/xã/i });
    expect(
      screen.queryByRole("combobox", { name: /quận\/huyện/i }),
    ).not.toBeInTheDocument();
    expect(ward).toBeDisabled();
    await selectDropdown(/tỉnh\/thành phố/i, /Thành phố Bắc Ninh/i, user);
    expect(ward).not.toBeDisabled();
    await selectDropdown(/phường\/xã/i, /^Phường Bắc Giang$/, user);
    expect(ward).toHaveValue("Phường Bắc Giang");
    await selectDropdown(/tỉnh\/thành phố/i, /Thành phố Hà Nội/i, user);
    expect(ward).toHaveValue("");
    expect(ward).not.toBeDisabled();
    await selectDropdown(/phường\/xã/i, /^Phường Ba Đình$/, user);
    expect(ward).toHaveValue("Phường Ba Đình");
  }, 20_000);

  it("summary địa chỉ hai cấp không có huyện", async () => {
    const user = userEvent.setup();
    render(<CheckoutForm />);
    await selectDropdown(/tỉnh\/thành phố/i, /Thành phố Bắc Ninh/i, user);
    await selectDropdown(/phường\/xã/i, /^Phường Bắc Giang$/, user);
    fireEvent.change(screen.getByLabelText(/địa chỉ cụ thể|số nhà/i), {
      target: { value: "123 Lê Lợi" },
    });
    const summary = screen.getByTestId("address-summary");
    expect(summary).toHaveTextContent(
      "123 Lê Lợi, Phường Bắc Giang, Thành phố Bắc Ninh",
    );
  }, 15_000);

  it("chuyển sang nhận tại cửa hàng ẩn địa chỉ và không gửi address trong payload", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          order: {
            code: "DH0001",
            total: 100_000,
            status: "pending",
            fulfillmentStatus: "new",
            accessUrl: "/orders/guest/mock-token",
          },
          duplicated: false,
        },
      }),
    } as Response);

    render(<CheckoutForm />);

    // Chuyển sang nhận tại cửa hàng
    const pickupRadio = screen.getByLabelText(/nhận tại cửa hàng/i);
    fireEvent.click(pickupRadio);

    // Không còn phần nhập địa chỉ
    expect(screen.queryByLabelText(/tỉnh\/thành phố/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/địa chỉ cụ thể|số nhà/i),
    ).not.toBeInTheDocument();

    // Điền liên hệ
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: "Nguyễn Văn B" },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: "0912345678" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /xác nhận đặt hàng/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.fulfillmentType).toBe("pickup");
    expect(callBody.deliveryAddress).toBe("");
    expect(callBody.deliveryProvince).toBe("");
    expect(callBody.deliveryDistrict).toBe("");
    expect(callBody.deliveryWard).toBe("");
  });

  it("chế độ fallback nhập tay cho phép gõ địa chỉ trực tiếp mà không khóa checkout", () => {
    render(<CheckoutForm />);

    // Nhấp nút chuyển sang nhập tay
    const toggleManualBtn = screen.getByRole("button", {
      name: /nhập thủ công|nhập tay/i,
    });
    fireEvent.click(toggleManualBtn);

    // Các trường select chuyển thành input text
    const provinceInput = screen.getByLabelText(/tỉnh\/thành phố/i);
    expect(provinceInput.tagName).toBe("INPUT");

    fireEvent.change(provinceInput, { target: { value: "Tỉnh Mới" } });
    expect((provinceInput as HTMLInputElement).value).toBe("Tỉnh Mới");

    const streetInput = screen.getByLabelText(/địa chỉ cụ thể|số nhà/i);
    fireEvent.change(streetInput, { target: { value: "Thôn 1" } });

    const summary = screen.getByTestId("address-summary");
    expect(summary.textContent).toContain("Thôn 1");
    expect(summary.textContent).toContain("Tỉnh Mới");
  });

  it("chọn nhận tại cửa hàng hiển thị thông tin địa chỉ và giờ mở cửa của cửa hàng", () => {
    const storeProfile = {
      name: "Tạp Hóa Xanh",
      hotline: "0901234567",
      address: "123 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
      openingHours: "07:30 - 21:30 hàng ngày",
      mapUrl: "https://maps.google.com/?q=test",
    };

    render(<CheckoutForm storeProfile={storeProfile} />);

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));

    const pickupCard = screen.getByTestId("pickup-store-info");
    expect(pickupCard).toBeInTheDocument();
    expect(pickupCard.textContent).toContain("123 Lê Lợi, Quận 1");
    expect(pickupCard.textContent).toContain("07:30 - 21:30");
    expect(
      screen.getByRole("link", { name: /bản đồ|chỉ đường/i }),
    ).toHaveAttribute("href", "https://maps.google.com/?q=test");
  });

  it("chọn nhận tại cửa hàng khi chưa cấu hình địa chỉ hiển thị thông báo trung thực", () => {
    const storeProfile = {
      name: "Cửa Hàng Mới",
    };

    render(<CheckoutForm storeProfile={storeProfile} />);

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));

    const pickupCard = screen.getByTestId("pickup-store-info");
    expect(pickupCard).toBeInTheDocument();
    expect(pickupCard.textContent).toContain("chưa cập nhật địa chỉ");
  });

  it("phí giao hàng chỉ hiện khi giao tận nơi và được cộng vào tổng", () => {
    render(
      <CheckoutForm
        shipping={{ shippingFee: 20_000, freeShippingThreshold: 500_000 }}
      />,
    );

    expect(screen.getByTestId("checkout-shipping-fee")).toHaveTextContent(
      "20.000",
    );
    // 2 x 50.000 + 20.000 phí ship
    expect(screen.getByText("120.000 ₫")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));
    expect(
      screen.queryByTestId("checkout-shipping-fee"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("100.000 ₫").length).toBeGreaterThan(0);
  });

  it("mã freeship: dòng miễn phí ship chỉ khi giao tận nơi; nhận tại cửa hàng thì báo đã miễn phí", async () => {
    localStorage.setItem("online-voucher-v1", "FREESHIP");
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ok: true,
          code: "FREESHIP",
          type: "freeship",
          value: 0,
          maxDiscount: null,
          minOrderTotal: 0,
          discount: 0,
          shippingDiscount: 20_000,
          message: "ok",
        },
      }),
    } as Response);

    render(
      <CheckoutForm
        shipping={{ shippingFee: 20_000, freeShippingThreshold: 500_000 }}
      />,
    );

    expect(
      await screen.findByTestId("checkout-shipping-discount"),
    ).toHaveTextContent("20.000");

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));
    expect(
      screen.queryByTestId("checkout-shipping-discount"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Đơn này đã được miễn phí giao hàng"),
    ).toBeInTheDocument();
  });

  it("409 VOUCHER_INVALID: gỡ mã đang áp và báo lỗi tại ô voucher", async () => {
    localStorage.setItem("online-voucher-v1", "GIAM10");
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ok: true,
            code: "GIAM10",
            type: "fixed",
            value: 10_000,
            maxDiscount: null,
            minOrderTotal: 0,
            discount: 10_000,
            shippingDiscount: 0,
            message: "ok",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "VOUCHER_INVALID",
          message: "Mã giảm giá đã hết lượt sử dụng",
        }),
      } as Response);

    render(<CheckoutForm />);
    expect(await screen.findByText(/Giảm giá \(GIAM10\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: "Nguyễn Văn B" },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xác nhận đặt hàng/i }));

    const message = await screen.findByText("Mã giảm giá đã hết lượt sử dụng");
    expect(message.closest("[aria-live]")).not.toBeNull();
    expect(screen.queryByText(/Giảm giá \(GIAM10\)/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem("online-voucher-v1")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Ô voucher mở lại để khách nhập mã khác.
    expect(screen.getByLabelText(/mã ưu đãi/i)).not.toBeDisabled();
  });
});
