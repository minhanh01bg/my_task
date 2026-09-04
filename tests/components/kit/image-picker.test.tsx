import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ImagePicker } from "@/components/kit/image-picker";

describe("ImagePicker", () => {
  it("chua chon gi thi hien anh du phong theo ten san pham", () => {
    render(<ImagePicker name="image" productName="Bugi Wave" />);
    expect(screen.getByText("BW")).toBeInTheDocument();
  });

  it("co anh cu thi hien anh cu", () => {
    render(
      <ImagePicker
        name="image"
        productName="Bugi Wave"
        currentUrl="/uploads/abc.webp"
      />,
    );
    expect(screen.getByRole("img", { name: "Bugi Wave" })).toBeInTheDocument();
  });

  it("o file mang dung ten de Server Action doc duoc", () => {
    const { container } = render(
      <ImagePicker name="image" productName="Bugi Wave" />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("name", "image");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  });

  it("chon anh xong thi hien anh xem truoc thay cho anh du phong", async () => {
    const { container } = render(
      <ImagePicker name="image" productName="Bugi Wave" />,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;

    const file = new File([new Uint8Array([1, 2, 3])], "anh.png", {
      type: "image/png",
    });
    await userEvent.upload(input, file);

    expect(
      await screen.findByRole("img", { name: "Xem trước" }),
    ).toBeInTheDocument();
  });
});
