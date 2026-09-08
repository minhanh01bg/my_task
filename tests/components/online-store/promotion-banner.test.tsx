import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PromotionBanner } from "@/features/online-store/promotion-banner";
import type { PublicPromotion } from "@/types/storefront";

describe("PromotionBanner Component", () => {
  const samplePromotion: PublicPromotion = {
    id: "promo-1",
    title: "Miễn phí vận chuyển cho đơn từ 200k",
    body: "Áp dụng cho mọi khách hàng đặt hàng trong hôm nay",
    ctaLabel: "Mua ngay",
    ctaHref: "/shop#catalog",
    placement: "announcement",
    priority: 10,
  };

  it("render thông điệp khuyến mãi và nút CTA liên kết hợp lệ", () => {
    render(<PromotionBanner promotions={[samplePromotion]} />);

    expect(
      screen.getByText("Miễn phí vận chuyển cho đơn từ 200k"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Áp dụng cho mọi khách hàng đặt hàng trong hôm nay"),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: "Mua ngay" });
    expect(cta).toHaveAttribute("href", "/shop#catalog");
  });

  it("trả về null (không chiếm layout) khi danh sách promotions rỗng", () => {
    const { container } = render(<PromotionBanner promotions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("render banner dạng hero kèm hình ảnh", () => {
    const heroPromo: PublicPromotion = {
      id: "promo-hero",
      title: "Ưu Đãi Lễ Hội",
      imageUrl: "/images/promo-fest.jpg",
      ctaLabel: "Xem ưu đãi",
      ctaHref: "https://example.com/promo",
      placement: "hero",
      priority: 5,
    };

    render(<PromotionBanner promotions={[heroPromo]} placement="hero" />);

    expect(screen.getByText("Ưu Đãi Lễ Hội")).toBeInTheDocument();
    const img = screen.getByAltText("Ưu Đãi Lễ Hội");
    expect(img).toBeInTheDocument();
  });
});
