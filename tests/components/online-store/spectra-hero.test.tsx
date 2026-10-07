import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HeroSection } from "@/features/online-store/landing/hero-section";

const slides = [
  {
    id: "sugar",
    productName: "Đường trắng",
    imageUrl: "/products/duong-trang.webp",
    price: 25000,
    unit: "kg",
    categoryName: "Tạp hoá",
    categoryHref: "/shop/c/tap-hoa",
    productHref: "/shop/p/duong-trang",
  },
  {
    id: "spark",
    productName: "Bugi NGK",
    imageUrl: "/products/bugi-ngk-c7hsa.webp",
    price: 35000,
    unit: "cái",
    categoryName: "Phụ tùng",
    categoryHref: "/shop/c/phu-tung-xe",
    productHref: "/shop/p/bugi-ngk",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("embeds the approved Spectra scene with real products and no preview navigation", () => {
  const { container } = render(
    <HeroSection storeName="Tạp hoá Tuấn Toàn" productSlides={slides} />,
  );
  const hero = screen.getByRole("region", { name: "Slider Spectra" });
  expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(
    "Điều bạn cần.Ngay ở đây.",
  );
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(within(hero).getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/duong-trang",
  );
  expect(
    screen.queryByRole("navigation", { name: "Chọn phương án slider" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Bản xem trước · Chờ duyệt"),
  ).not.toBeInTheDocument();
  expect(container.querySelector("main")).toBeNull();
});

it("storefront navigation updates the real product and category destinations", () => {
  render(<HeroSection productSlides={slides} />);
  fireEvent.click(screen.getByRole("button", { name: "Sản phẩm tiếp theo" }));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/bugi-ngk",
  );
  expect(screen.getByRole("link", { name: "Xem danh mục" })).toHaveAttribute(
    "href",
    "/shop/c/phu-tung-xe",
  );
});

it("keeps a useful catalog destination when no product images are available", () => {
  render(<HeroSection storeName="Tạp hoá Tuấn Toàn" productSlides={[]} />);
  expect(
    screen.getByRole("link", { name: /mua ngay|khám phá/i }),
  ).toHaveAttribute("href", "#catalog");
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});
