import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StoreFooter } from "@/features/online-store/store-footer";
import type { PublicStoreProfile } from "@/types/storefront";

describe("StoreFooter", () => {
  const mockProfile: PublicStoreProfile = {
    name: "Tạp Hóa Xanh",
    hotline: "0901234567",
    address: "123 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
    openingHours: "07:30 - 21:30 hàng ngày",
    mapUrl: "https://maps.google.com/?q=tap-hoa-xanh",
  };

  it("hiển thị tên cửa hàng, địa chỉ, giờ mở cửa và số điện thoại", () => {
    render(<StoreFooter profile={mockProfile} />);

    expect(screen.getByText("Tạp Hóa Xanh")).toBeInTheDocument();
    expect(
      screen.getByText(/123 Lê Lợi, Quận 1, TP. Hồ Chí Minh/),
    ).toBeInTheDocument();
    expect(screen.getByText(/07:30 - 21:30 hàng ngày/)).toBeInTheDocument();
    expect(screen.getByText(/0901234567/)).toBeInTheDocument();
  });

  it("render hotline link và google maps link khi URL hợp lệ", () => {
    render(<StoreFooter profile={mockProfile} />);

    const phoneLink = screen.getByRole("link", { name: /0901234567/ });
    expect(phoneLink).toHaveAttribute("href", "tel:0901234567");

    const mapLink = screen.getByRole("link", { name: /bản đồ|chỉ đường/i });
    expect(mapLink).toHaveAttribute(
      "href",
      "https://maps.google.com/?q=tap-hoa-xanh",
    );
    expect(mapLink).toHaveAttribute("target", "_blank");
    expect(mapLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("không render map link hoặc phone link khi không có dữ liệu hoặc không hợp lệ", () => {
    const minimalProfile: PublicStoreProfile = {
      name: "Cửa Hàng Tối Giản",
    };

    render(<StoreFooter profile={minimalProfile} />);

    expect(screen.getByText("Cửa Hàng Tối Giản")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /bản đồ|chỉ đường/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /tel:/i }),
    ).not.toBeInTheDocument();
  });

  it("render các liên kết chính sách cửa hàng", () => {
    render(<StoreFooter profile={mockProfile} />);

    expect(
      screen.getByRole("link", { name: /chính sách giao hàng/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /chính sách đổi trả/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /chính sách bảo mật/i }),
    ).toBeInTheDocument();
  });
});
