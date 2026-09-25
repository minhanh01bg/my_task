import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("online-cart-v1", JSON.stringify(mockCartItems));
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  async function selectDropdown(
    triggerLabel: RegExp,
    optionText: RegExp,
    user: ReturnType<typeof userEvent.setup>,
  ) {
    const trigger = screen.getByRole("combobox", { name: triggerLabel });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    const option = await screen.findByRole("option", { name: optionText });
    await user.click(option);
  }

  it("chọn tỉnh reset quận/huyện và phường/xã cũ; chọn quận reset phường/xã cũ", async () => {
    const user = userEvent.setup();
    render(<CheckoutForm />);

    const districtTrigger = screen.getByRole("combobox", {
      name: /quận\/huyện/i,
    });
    const wardTrigger = screen.getByRole("combobox", { name: /phường\/xã/i });

    // Ban đầu chưa chọn tỉnh thì quận/phường bị disabled
    expect(districtTrigger).toBeDisabled();
    expect(wardTrigger).toBeDisabled();

    // 1. Chọn Hà Nội
    await selectDropdown(/tỉnh\/thành phố/i, /Hà Nội/i, user);
    expect(districtTrigger).not.toBeDisabled();
    expect(wardTrigger).toBeDisabled();

    // 2. Chọn Ba Đình
    await selectDropdown(/quận\/huyện/i, /Ba Đình/i, user);
    expect(wardTrigger).not.toBeDisabled();

    // 3. Chọn một phường trong Ba Đình (Phúc Xá)
    await selectDropdown(/phường\/xã/i, /Phúc Xá/i, user);
    expect(wardTrigger).toHaveTextContent("Phúc Xá");

    // 4. Đổi sang TP. Hồ Chí Minh -> quận và phường phải được reset về rỗng
    await selectDropdown(/tỉnh\/thành phố/i, /TP\. Hồ Chí Minh/i, user);
    expect(districtTrigger).not.toHaveTextContent("Ba Đình");
    expect(wardTrigger).toBeDisabled();

    // 5. Chọn Quận 1 trong TP.HCM
    await selectDropdown(/quận\/huyện/i, /^Quận 1$/, user);
    expect(wardTrigger).not.toBeDisabled();

    // 6. Chọn phường Bến Nghé trong Quận 1
    await selectDropdown(/phường\/xã/i, /Bến Nghé/i, user);
    expect(wardTrigger).toHaveTextContent("Bến Nghé");

    // 7. Đổi sang quận khác trong TP.HCM -> phường phải reset
    await selectDropdown(/quận\/huyện/i, /Bình Thạnh/i, user);
    expect(wardTrigger).not.toHaveTextContent("Bến Nghé");
    // 7 lan mo dropdown Base UI trong jsdom mat ~6-8s tren may cham/CI.
  }, 20_000);

  it("hiển thị address summary trực quan trước submit", async () => {
    const user = userEvent.setup();
    render(<CheckoutForm />);

    await selectDropdown(/tỉnh\/thành phố/i, /TP\. Hồ Chí Minh/i, user);
    await selectDropdown(/quận\/huyện/i, /^Quận 1$/, user);
    await selectDropdown(/phường\/xã/i, /Bến Nghé/i, user);

    const streetInput = screen.getByLabelText(/địa chỉ cụ thể|số nhà/i);
    fireEvent.change(streetInput, { target: { value: "123 Lê Lợi" } });

    // Summary địa chỉ hiển thị đầy đủ
    const summary = screen.getByTestId("address-summary");
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toContain("123 Lê Lợi");
    expect(summary.textContent).toContain("Phường Bến Nghé");
    expect(summary.textContent).toContain("Quận 1");
    expect(summary.textContent).toContain("TP. Hồ Chí Minh");
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
