export interface HeroSlideVisual {
  tag: string;
  subtitle: string;
  metricValue: string;
  metricLabel: string;
  highlightPill: string;
  /** Icon lucide cho the showcase — khong dung emoji lam icon. */
  accentIcon: "leaf" | "truck" | "shield";
}

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
  perks?: string[];
  visual?: HeroSlideVisual;
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
    gradient: "from-emerald-500/15 via-primary/10 to-transparent",
    perks: [
      "Tồn kho chuẩn xác 100%",
      "Nhập hàng tươi mỗi sáng",
      "Bảo quản đúng chuẩn",
    ],
    visual: {
      tag: "Thực phẩm & Tiêu dùng",
      subtitle: "Nông sản & Bách hóa tuyển chọn",
      metricValue: "100%",
      metricLabel: "Độ tươi mới trong ngày",
      highlightPill: "GIẢM TỚI 35%",
      accentIcon: "leaf",
    },
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
    gradient: "from-blue-500/15 via-primary/10 to-transparent",
    perks: [
      "Freeship đơn từ 200.000₫",
      "Giao hỏa tốc 30 - 60 phút",
      "Theo dõi đơn trực tiếp",
    ],
    visual: {
      tag: "Giao hàng hỏa tốc",
      subtitle: "Phục vụ tận cửa mọi khung giờ",
      metricValue: "30p",
      metricLabel: "Giao nhanh nội thành",
      highlightPill: "FREESHIP 0Đ",
      accentIcon: "truck",
    },
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
    gradient: "from-amber-500/15 via-primary/10 to-transparent",
    perks: [
      "100% rõ ràng nguồn gốc",
      "Đổi trả miễn phí 48 giờ",
      "Kiểm tra trước khi nhận",
    ],
    visual: {
      tag: "Bảo đảm uy tín",
      subtitle: "Chính hãng & Minh bạch nguồn gốc",
      metricValue: "4.9★",
      metricLabel: "2.800+ đánh giá tin cậy",
      highlightPill: "BẢO VỆ 100%",
      accentIcon: "shield",
    },
  },
];
