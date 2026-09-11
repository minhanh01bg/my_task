import { fireEvent, render, screen } from "@testing-library/react";
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

  it("cho phép nhập và áp dụng mã voucher hợp lệ", () => {
    render(<CheckoutForm />);

    expect(screen.getByPlaceholderText(/nhập mã voucher/i)).toBeInTheDocument();
    const voucherInput = screen.getByPlaceholderText(/nhập mã voucher/i);
    const applyBtn = screen.getByRole("button", { name: /áp dụng/i });

    // Áp dụng mã FREESHIP (đơn từ 150k giảm 25k)
    fireEvent.change(voucherInput, { target: { value: "FREESHIP" } });
    fireEvent.click(applyBtn);

    expect(screen.getByText(/giảm 25.000/i)).toBeInTheDocument();
  });
});
