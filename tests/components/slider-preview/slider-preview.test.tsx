import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SliderPreview } from "@/features/slider-preview/slider-preview";

const slides = [
  {
    id: "one",
    productName: "Mì Hảo Hảo",
    imageUrl: "/products/mi-hao-hao.webp",
    price: 4500,
    unit: "gói",
    categoryName: "Tạp hoá",
    categoryHref: "/shop/c/tap-hoa",
    productHref: "/shop/p/mi-hao-hao",
  },
  {
    id: "two",
    productName: "Dép lào",
    imageUrl: "/products/dep-lao.webp",
    price: 35000,
    unit: "đôi",
    categoryName: "Giày dép",
    categoryHref: "/shop/c/giay-dep",
    productHref: "/shop/p/dep-lao",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(["spectra", "spotlight", "under-the-radar"] as const)(
  "%s uses real product CTA and starts paused for design review",
  (variant) => {
    render(
      <SliderPreview
        variant={variant}
        slides={slides}
        storeName="Tạp hoá Tuấn Toàn"
      />,
    );
    expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
      "href",
      "/shop/p/mi-hao-hao",
    );
    expect(
      screen.getByRole("button", { name: "Bật tự chạy" }),
    ).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
      "href",
      "/shop/p/mi-hao-hao",
    );
  },
);

it("buttons and keyboard keep the selected product and CTA synchronized", () => {
  render(
    <SliderPreview variant="spectra" slides={slides} storeName="Cửa hàng" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sản phẩm tiếp theo" }));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/dep-lao",
  );
  fireEvent.keyDown(screen.getByRole("region", { name: "Slider Spectra" }), {
    key: "ArrowLeft",
  });
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/mi-hao-hao",
  );
});

it("manual autoplay stops on focus and explicit pause remains after leaving the region", () => {
  render(
    <SliderPreview variant="spectra" slides={slides} storeName="Cửa hàng" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Bật tự chạy" }));
  act(() => vi.advanceTimersByTime(6500));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/dep-lao",
  );
  const region = screen.getByRole("region", { name: "Slider Spectra" });
  fireEvent.focus(region);
  act(() => vi.advanceTimersByTime(6500));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/dep-lao",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tắt tự chạy" }));
  fireEvent.blur(region);
  fireEvent.mouseLeave(region);
  act(() => vi.advanceTimersByTime(6500));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/dep-lao",
  );
});

it("empty catalog has a useful fallback and no broken purchase destination", () => {
  render(
    <SliderPreview variant="spotlight" slides={[]} storeName="Cửa hàng" />,
  );
  expect(
    screen.getByText("Chưa có sản phẩm có ảnh để xem trước."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Mua ngay" }),
  ).not.toBeInTheDocument();
});

it("single product does not expose useless rotation controls", () => {
  render(
    <SliderPreview
      variant="under-the-radar"
      slides={slides.slice(0, 1)}
      storeName="Cửa hàng"
    />,
  );
  const region = screen.getByRole("region", { name: "Slider Under The Radar" });
  expect(
    within(region).getByRole("button", { name: "Sản phẩm tiếp theo" }),
  ).toBeDisabled();
  expect(
    within(region).getByRole("button", { name: "Bật tự chạy" }),
  ).toBeDisabled();
});

it("reduced motion disables autoplay but keeps manual navigation available", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(
    <SliderPreview variant="spectra" slides={slides} storeName="Cửa hàng" />,
  );
  expect(screen.getByRole("button", { name: "Bật tự chạy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Sản phẩm tiếp theo" }));
  expect(screen.getByRole("link", { name: "Mua ngay" })).toHaveAttribute(
    "href",
    "/shop/p/dep-lao",
  );
});
