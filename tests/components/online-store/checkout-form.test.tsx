import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("chọn tỉnh reset quận/huyện và phường/xã cũ; chọn quận reset phường/xã cũ", async () => {
    render(<CheckoutForm />);

    const provinceSelect = screen.getByLabelText(/tỉnh\/thành phố/i);
    const districtSelect = screen.getByLabelText(/quận\/huyện/i);
    const wardSelect = screen.getByLabelText(/phường\/xã/i);

    // Ban đầu chưa chọn tỉnh thì quận/phường bị disabled
    expect(districtSelect).toBeDisabled();
    expect(wardSelect).toBeDisabled();

    // 1. Chọn Hà Nội (01)
    fireEvent.change(provinceSelect, { target: { value: "01" } });
    expect(districtSelect).not.toBeDisabled();
    expect(wardSelect).toBeDisabled();

    // 2. Chọn Ba Đình
    const baDinhOption = Array.from(
      (districtSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Ba Đình"));
    expect(baDinhOption).toBeDefined();
    fireEvent.change(districtSelect, {
      target: { value: baDinhOption!.value },
    });
    expect(wardSelect).not.toBeDisabled();

    // 3. Chọn một phường trong Ba Đình
    const wardOption = (wardSelect as HTMLSelectElement).options[1];
    expect(wardOption).toBeDefined();
    fireEvent.change(wardSelect, { target: { value: wardOption.value } });
    expect((wardSelect as HTMLSelectElement).value).toBe(wardOption.value);

    // 4. Đổi sang TP. Hồ Chí Minh (79) -> quận và phường phải được reset về rỗng
    fireEvent.change(provinceSelect, { target: { value: "79" } });
    expect((districtSelect as HTMLSelectElement).value).toBe("");
    expect((wardSelect as HTMLSelectElement).value).toBe("");
    expect(wardSelect).toBeDisabled();

    // 5. Chọn Quận 1 trong TP.HCM
    const q1Option = Array.from(
      (districtSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Quận 1"));
    expect(q1Option).toBeDefined();
    fireEvent.change(districtSelect, { target: { value: q1Option!.value } });
    expect(wardSelect).not.toBeDisabled();

    // 6. Chọn phường Bến Nghé trong Quận 1
    const benNgheOption = Array.from(
      (wardSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Bến Nghé"));
    expect(benNgheOption).toBeDefined();
    fireEvent.change(wardSelect, { target: { value: benNgheOption!.value } });
    expect((wardSelect as HTMLSelectElement).value).toBe(benNgheOption!.value);

    // 7. Đổi sang quận khác trong TP.HCM -> phường phải reset
    const binhThanhOption = Array.from(
      (districtSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Bình Thạnh"));
    expect(binhThanhOption).toBeDefined();
    fireEvent.change(districtSelect, {
      target: { value: binhThanhOption!.value },
    });
    expect((wardSelect as HTMLSelectElement).value).toBe("");
  });

  it("hiển thị address summary trực quan trước submit", () => {
    render(<CheckoutForm />);

    const provinceSelect = screen.getByLabelText(/tỉnh\/thành phố/i);
    const districtSelect = screen.getByLabelText(/quận\/huyện/i);
    const wardSelect = screen.getByLabelText(/phường\/xã/i);
    const streetInput = screen.getByLabelText(/địa chỉ cụ thể|số nhà/i);

    fireEvent.change(provinceSelect, { target: { value: "79" } });
    const q1Option = Array.from(
      (districtSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Quận 1"))!;
    fireEvent.change(districtSelect, { target: { value: q1Option.value } });

    const benNgheOption = Array.from(
      (wardSelect as HTMLSelectElement).options,
    ).find((opt) => opt.text.includes("Bến Nghé"))!;
    fireEvent.change(wardSelect, { target: { value: benNgheOption.value } });

    fireEvent.change(streetInput, { target: { value: "123 Lê Lợi" } });

    // Summary địa chỉ hiển thị đầy đủ
    const summary = screen.getByTestId("address-summary");
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toContain("123 Lê Lợi");
    expect(summary.textContent).toContain("Phường Bến Nghé");
    expect(summary.textContent).toContain("Quận 1");
    expect(summary.textContent).toContain("TP. Hồ Chí Minh");
  });

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
});
