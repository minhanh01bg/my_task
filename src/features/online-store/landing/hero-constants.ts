export interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  gradient?: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "slide-fresh",
    badge: "Tươi ngon & Tiện lợi",
    title: "Hàng thiết yếu, đặt nhanh tại nhà",
    description:
      "Rau củ tươi, đồ tiêu dùng và nhu yếu phẩm chính hãng. Giá niêm yết minh bạch, tồn kho thời gian thực.",
    ctaText: "Mua ngay",
    ctaHref: "#catalog",
    secondaryText: "Xem khuyến mãi",
    secondaryHref: "#catalog",
    gradient: "from-primary/15 via-accent/10 to-transparent",
  },
  {
    id: "slide-freeship",
    badge: "Freeship đơn từ 200.000đ",
    title: "Miễn phí vận chuyển tận cửa",
    description:
      "Đặt hàng online dễ dàng, giao hàng tận nơi hoặc nhận tại cửa hàng. Cam kết bảo quản an toàn.",
    ctaText: "Khám phá ưu đãi",
    ctaHref: "#catalog",
    secondaryText: "Chính sách giao hàng",
    secondaryHref: "/shop/delivery-policy",
    gradient: "from-info/15 via-primary/10 to-transparent",
  },
  {
    id: "slide-quality",
    badge: "Cam kết 100% chính hãng",
    title: "Mua sắm an tâm, đổi trả dễ dàng",
    description:
      "Hỗ trợ đổi trả trong 48 giờ nếu hàng hóa không đạt chuẩn. Đội ngũ cửa hàng luôn sẵn sàng phục vụ.",
    ctaText: "Khám phá danh mục",
    ctaHref: "#catalog",
    secondaryText: "Chính sách đổi trả",
    secondaryHref: "/shop/return-policy",
    gradient: "from-warning/15 via-primary/10 to-transparent",
  },
];
