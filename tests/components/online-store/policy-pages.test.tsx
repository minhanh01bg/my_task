import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreFooter } from "@/features/online-store/store-footer";
import { CheckoutForm } from "@/features/online-store/checkout-form";
import DeliveryPolicyPage from "@/app/shop/delivery-policy/page";
import PaymentPolicyPage from "@/app/shop/payment-policy/page";
import ReturnPolicyPage from "@/app/shop/return-policy/page";
import PrivacyPolicyPage from "@/app/shop/privacy/page";

// Mock server settings & auth calls for server components
vi.mock("@/server/settings/store-settings", () => ({
  getPublicStoreProfile: vi.fn().mockResolvedValue({
    name: "Tạp Hóa Xanh",
    hotline: "0901234567",
    address: "123 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
    openingHours: "07:30 - 21:30",
  }),
}));

vi.mock("@/server/auth/require-admin-session", () => ({
  hasAdminSession: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/server/customer-auth/session", () => ({
  getOptionalCustomerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/shop/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Policy Pages & Customer Trust (Task 12)", () => {
  describe("StoreFooter Navigation", () => {
    it("chứa các liên kết semantic đến 4 trang chính sách", () => {
      render(
        <StoreFooter
          profile={{
            name: "Tạp Hóa Xanh",
            hotline: "0901234567",
          }}
        />,
      );

      const deliveryLink = screen.getByRole("link", {
        name: /chính sách giao hàng/i,
      });
      expect(deliveryLink).toHaveAttribute("href", "/shop/delivery-policy");

      const paymentLink = screen.getByRole("link", {
        name: /chính sách thanh toán/i,
      });
      expect(paymentLink).toHaveAttribute("href", "/shop/payment-policy");

      const returnLink = screen.getByRole("link", {
        name: /chính sách đổi trả/i,
      });
      expect(returnLink).toHaveAttribute("href", "/shop/return-policy");

      const privacyLink = screen.getByRole("link", {
        name: /chính sách bảo mật/i,
      });
      expect(privacyLink).toHaveAttribute("href", "/shop/privacy");
    });
  });

  describe("Delivery Policy Page", () => {
    it("render semantic heading h1 và các nội dung giao hàng trung thực", async () => {
      const page = await DeliveryPolicyPage();
      render(page);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /chính sách giao hàng/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /phương thức giao hàng/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: /thời gian giao hàng/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/đồng kiểm/i).length).toBeGreaterThan(0);
    });
  });

  describe("Payment Policy Page", () => {
    it("render semantic heading h1 và mô tả phương thức COD cùng VietQR", async () => {
      const page = await PaymentPolicyPage();
      render(page);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /chính sách thanh toán/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(/tiền mặt khi nhận hàng/i)).toBeInTheDocument();
      expect(
        screen.getByText(/chuyển khoản qua mã vietqr/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/xác nhận đơn hàng/i)).toBeInTheDocument();
    });
  });

  describe("Return Policy Page", () => {
    it("render semantic heading h1, điều kiện 48h và quy trình hỗ trợ", async () => {
      const page = await ReturnPolicyPage();
      render(page);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /chính sách đổi trả/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/48 giờ/i).length).toBeGreaterThan(0);
      expect(
        screen.getByRole("heading", { level: 2, name: /điều kiện đổi trả/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 2, name: /quy trình xử lý/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Privacy Policy Page", () => {
    it("render chính sách bảo mật mô tả rõ dữ liệu khách vãng lai, tài khoản và retention", async () => {
      const page = await PrivacyPolicyPage();
      render(page);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /chính sách bảo mật/i,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText(/khách vãng lai/i)).toBeInTheDocument();
      expect(screen.getByText(/khách hàng có tài khoản/i)).toBeInTheDocument();
      expect(screen.getByText(/thời gian lưu trữ/i)).toBeInTheDocument();
      expect(screen.getByText(/quyền của khách hàng/i)).toBeInTheDocument();
    });
  });

  describe("Checkout Form Reassurance Cues", () => {
    it("hiển thị cam kết minh bạch và liên kết chính sách cạnh CTA checkout", () => {
      localStorage.clear();
      localStorage.setItem(
        "online-cart-v1",
        JSON.stringify([
          {
            id: "p1",
            name: "Cà phê Robusta",
            price: 50_000,
            quantity: 2,
            stock: 10,
            unit: "gói",
          },
        ]),
      );

      render(
        <CheckoutForm
          storeProfile={{
            name: "Tạp Hóa Xanh",
            hotline: "0901234567",
          }}
        />,
      );

      expect(screen.getByTestId("checkout-reassurance")).toBeInTheDocument();
      expect(screen.getByText(/đồng kiểm trước khi nhận/i)).toBeInTheDocument();
      expect(
        screen.getByText(/thanh toán linh hoạt cod hoặc vietqr/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /chính sách giao hàng/i }),
      ).toHaveAttribute("href", "/shop/delivery-policy");
      expect(
        screen.getByRole("link", { name: /chính sách đổi trả/i }),
      ).toHaveAttribute("href", "/shop/return-policy");
    });
  });
});
