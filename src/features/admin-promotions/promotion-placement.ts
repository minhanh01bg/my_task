import {
  IconLayoutBottombar,
  IconLayoutNavbar,
  IconPhoto,
} from "@tabler/icons-react";

export const PROMOTION_PLACEMENTS = [
  {
    value: "announcement",
    label: "Thanh thông báo",
    description: "Dải ưu đãi ở đầu cửa hàng",
    icon: IconLayoutNavbar,
  },
  {
    value: "hero",
    label: "Banner đầu trang",
    description: "Ưu đãi nổi bật trên trang chủ",
    icon: IconPhoto,
  },
  {
    value: "banner",
    label: "Banner phụ",
    description: "Bổ sung thông tin ưu đãi",
    icon: IconLayoutBottombar,
  },
] as const;
