import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { avatarHue, initials } from "@/components/kit/avatar-color";
import { ProductImage } from "@/components/kit/product-image";

describe("avatarHue", () => {
  it("cung mot ten luon ra cung mot mau", () => {
    expect(avatarHue("Bugi Wave")).toBe(avatarHue("Bugi Wave"));
  });

  it("ten khac nhau thuong ra mau khac nhau", () => {
    expect(avatarHue("Bugi Wave")).not.toBe(avatarHue("Nhớt Castrol"));
  });

  it("luon nam trong khoang mau hop le", () => {
    for (const name of ["a", "Bugi", "Nhớt 4T", "", "Dây điện 2 mét"]) {
      const hue = avatarHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe("initials", () => {
  it("lay chu cai dau cua hai tu dau", () => {
    expect(initials("Bugi Wave")).toBe("BW");
  });

  it("ten mot tu thi lay mot chu", () => {
    expect(initials("Bugi")).toBe("B");
  });

  it("giu dau tieng Viet", () => {
    expect(initials("Nhớt Castrol")).toBe("NC");
  });

  it("ten rong khong lam vo", () => {
    expect(initials("")).toBe("?");
  });
});

describe("ProductImage", () => {
  it("hien anh khi co duong dan", () => {
    render(<ProductImage src="/uploads/abc.webp" name="Bugi Wave" />);
    expect(screen.getByRole("img", { name: "Bugi Wave" })).toBeInTheDocument();
  });

  it("khong co anh thi hien chu cai dau, khong hien the img rong", () => {
    render(<ProductImage src={null} name="Bugi Wave" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("BW")).toBeInTheDocument();
  });

  it("anh du phong duoc an khoi trinh doc man hinh", () => {
    const { container } = render(<ProductImage src={null} name="Bugi Wave" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ProductImage hop nhat", () => {
  it("nhan alt rieng cho trinh doc man hinh", () => {
    render(
      <ProductImage src="/uploads/abc.webp" name="Bugi Wave" alt="Ảnh Bugi" />,
    );
    expect(screen.getByRole("img", { name: "Ảnh Bugi" })).toBeInTheDocument();
  });

  it("dung URL goc de service worker cua POS cache duoc khi mat mang", () => {
    render(<ProductImage src="/uploads/abc.webp" name="Bugi Wave" />);
    expect(screen.getByRole("img", { name: "Bugi Wave" })).toHaveStyle({
      backgroundImage: 'url("/uploads/abc.webp")',
    });
  });

  it("bo size thi kich thuoc do className quyet dinh", () => {
    const { container } = render(
      <ProductImage
        src={null}
        name="Bugi Wave"
        className="aspect-[4/3] w-full"
      />,
    );
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveClass("w-full");
    expect(box.style.width).toBe("");
  });

  it("shared/product-image chi la re-export cua kit", async () => {
    const shared = await import("@/components/shared/product-image");
    expect(shared.ProductImage).toBe(ProductImage);
  });
});
