import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutForm } from "@/features/online-store/checkout-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

const mockCartItems = [
  {
    id: "p1",
    name: "Hạt điều rang muối 500g",
    price: 150_000,
    quantity: 1,
    stock: 10,
    unit: "hộp",
  },
];

describe("CheckoutForm - Scheduled Delivery & Voucher", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("online-cart-v1", JSON.stringify(mockCartItems));
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  it("cho phép chọn khung giờ giao hàng mong muốn", () => {
    render(<CheckoutForm />);

    expect(screen.getByText(/thời gian nhận hàng/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/khung giờ giao/i);
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "08:00 - 11:30" } });
    expect((select as HTMLSelectElement).value).toBe("08:00 - 11:30");
  });

  function mockValidate(data: Record<string, unknown>) {
    return vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data }),
    } as Response);
  }

  it("áp dụng mã qua API validate và hiển thị giảm giá", async () => {
    const fetchSpy = mockValidate({
      ok: true,
      code: "GIAM10",
      type: "percent",
      value: 10,
      maxDiscount: 30_000,
      minOrderTotal: 0,
      discount: 15_000,
      shippingDiscount: 0,
      message: "Đã áp dụng mã GIAM10: giảm 15.000 ₫",
    });
    render(<CheckoutForm />);

    fireEvent.change(screen.getByPlaceholderText(/nhập mã voucher/i), {
      target: { value: " giam10 " },
    });
    fireEvent.click(screen.getByRole("button", { name: /áp dụng/i }));

    expect(
      await screen.findByText(/Đã áp dụng mã GIAM10: giảm 15\.000/),
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/online/vouchers/validate",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({ code: "GIAM10", subtotal: 150_000 });
    expect(screen.getByText(/Giảm giá \(GIAM10\)/)).toBeInTheDocument();
    expect(screen.getByText("135.000 ₫")).toBeInTheDocument();
    expect(localStorage.getItem("online-voucher-v1")).toBe("GIAM10");
  });

  it("tính lại giảm giá bằng engine khi đổi số lượng, không gọi lại API", async () => {
    const fetchSpy = mockValidate({
      ok: true,
      code: "GIAM10",
      type: "percent",
      value: 10,
      maxDiscount: 30_000,
      minOrderTotal: 0,
      discount: 15_000,
      shippingDiscount: 0,
      message: "ok",
    });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByPlaceholderText(/nhập mã voucher/i), {
      target: { value: "GIAM10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /áp dụng/i }));
    await screen.findByText(/giảm 15\.000/);

    fireEvent.change(screen.getByLabelText(/số lượng hạt điều/i), {
      target: { value: "3" },
    });
    // 10% của 450k = 45k, chặn trần 30k.
    await waitFor(() => {
      expect(screen.getByText(/giảm 30\.000/)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("hiển thị lỗi khi mã không hợp lệ", async () => {
    mockValidate({
      ok: false,
      code: "SAIMA",
      message: "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng",
    });
    render(<CheckoutForm />);
    fireEvent.change(screen.getByPlaceholderText(/nhập mã voucher/i), {
      target: { value: "saima" },
    });
    fireEvent.click(screen.getByRole("button", { name: /áp dụng/i }));

    expect(
      await screen.findByText(/không tồn tại hoặc đã ngừng áp dụng/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Giảm giá \(/)).not.toBeInTheDocument();
  });

  it("gửi voucherCode và deliverySlot trong payload đặt hàng", async () => {
    const fetchSpy = mockValidate({
      ok: true,
      code: "GIAM10",
      type: "percent",
      value: 10,
      maxDiscount: null,
      minOrderTotal: 0,
      discount: 15_000,
      shippingDiscount: 0,
      message: "ok",
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          order: {
            code: "DH0001",
            total: 135_000,
            status: "pending",
            fulfillmentStatus: "new",
            receiptUrl: "/order-success/abc",
          },
          duplicated: false,
        },
      }),
    } as Response);

    render(<CheckoutForm />);
    fireEvent.change(screen.getByPlaceholderText(/nhập mã voucher/i), {
      target: { value: "GIAM10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /áp dụng/i }));
    await screen.findByText(/giảm 15\.000/);

    fireEvent.click(screen.getByLabelText(/nhận tại cửa hàng/i));
    fireEvent.change(screen.getByLabelText(/họ và tên/i), {
      target: { value: "Nguyễn Văn B" },
    });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), {
      target: { value: "0912345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xác nhận đặt hàng/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const orderBody = JSON.parse(fetchSpy.mock.calls[1]?.[1]?.body as string);
    expect(orderBody.voucherCode).toBe("GIAM10");
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/order-success/abc"),
    );
    expect(localStorage.getItem("online-voucher-v1")).toBeNull();
  });

  it("khôi phục mã đã lưu từ giỏ hàng khi mở trang thanh toán", async () => {
    localStorage.setItem("online-voucher-v1", "GIAM10");
    const fetchSpy = mockValidate({
      ok: true,
      code: "GIAM10",
      type: "fixed",
      value: 20_000,
      maxDiscount: null,
      minOrderTotal: 0,
      discount: 20_000,
      shippingDiscount: 0,
      message: "ok",
    });
    render(<CheckoutForm />);

    expect(await screen.findByText(/giảm 20\.000/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
