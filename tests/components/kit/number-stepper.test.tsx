import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberStepper } from "@/components/kit/number-stepper";

describe("NumberStepper (Kit)", () => {
  it("hiển thị đúng giá trị khởi tạo và đơn vị", () => {
    render(
      <NumberStepper
        name="price"
        defaultValue={25000}
        min={0}
        step={1000}
        isCurrency
        aria-label="Giá bán"
      />,
    );

    const input = screen.getByLabelText("Giá bán") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("25000");
    expect(input.step).toBe("any");

    // Hiển thị định dạng tiền tệ VND
    expect(screen.getByText(/25\.000 ₫/)).toBeInTheDocument();
  });

  it("tăng và giảm theo từng bước 1.000đ khi nhấn nút cộng trừ", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <NumberStepper
        name="price"
        defaultValue={10000}
        min={0}
        step={1000}
        onChange={handleChange}
        isCurrency
        aria-label="Giá bán"
      />,
    );

    const input = screen.getByLabelText("Giá bán") as HTMLInputElement;
    const plusBtn = screen.getByRole("button", { name: /tăng/i });
    const minusBtn = screen.getByRole("button", { name: /giảm/i });

    // Nhấn tăng: 10000 -> 11000
    await user.click(plusBtn);
    expect(input.value).toBe("11000");
    expect(handleChange).toHaveBeenCalledWith(11000);

    // Nhấn tăng tiếp: 11000 -> 12000
    await user.click(plusBtn);
    expect(input.value).toBe("12000");

    // Nhấn giảm: 12000 -> 11000
    await user.click(minusBtn);
    expect(input.value).toBe("11000");
  });

  it("không cho phép giảm xuống dưới giá trị min", async () => {
    const user = userEvent.setup();

    render(
      <NumberStepper
        name="price"
        defaultValue={500}
        min={0}
        step={1000}
        aria-label="Giá bán"
      />,
    );

    const input = screen.getByLabelText("Giá bán") as HTMLInputElement;
    const minusBtn = screen.getByRole("button", { name: /giảm/i });

    await user.click(minusBtn);
    // Nhấn giảm khi giá 500 và step 1000 thì kẹp về min=0
    expect(input.value).toBe("0");

    // Nút trừ bị vô hiệu hóa khi đạt min
    expect(minusBtn).toBeDisabled();
  });

  it("cộng nhanh theo các nút gợi ý quickSteps", async () => {
    const user = userEvent.setup();

    render(
      <NumberStepper
        name="price"
        defaultValue={20000}
        min={0}
        step={1000}
        quickSteps={[1000, 5000, 10000, 50000]}
        isCurrency
        aria-label="Giá bán"
      />,
    );

    const input = screen.getByLabelText("Giá bán") as HTMLInputElement;

    // Bấm nút +5.000: 20000 -> 25000
    const chip5k = screen.getByRole("button", { name: /\+5\.000/i });
    await user.click(chip5k);
    expect(input.value).toBe("25000");

    // Bấm nút +50.000: 25000 -> 75000
    const chip50k = screen.getByRole("button", { name: /\+50\.000/i });
    await user.click(chip50k);
    expect(input.value).toBe("75000");
  });

  it("hỗ trợ tăng giảm nhanh bằng phím Shift + ArrowUp/ArrowDown", () => {
    render(
      <NumberStepper
        name="price"
        defaultValue={10000}
        min={0}
        step={1000}
        aria-label="Giá bán"
      />,
    );

    const input = screen.getByLabelText("Giá bán") as HTMLInputElement;

    // Shift + ArrowUp: tăng step * 10 = 10.000 -> 20.000
    fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
    expect(input.value).toBe("20000");

    // Shift + ArrowDown: giảm step * 10 = 10.000 -> 10.000
    fireEvent.keyDown(input, { key: "ArrowDown", shiftKey: true });
    expect(input.value).toBe("10000");
  });

  it("hoạt động tốt với số lượng tồn kho (step = 1)", async () => {
    const user = userEvent.setup();

    render(
      <NumberStepper
        name="stock"
        defaultValue={15}
        min={0}
        step={1}
        quickSteps={[1, 5, 10, 50]}
        unit="hộp"
        aria-label="Số lượng tồn kho"
      />,
    );

    const input = screen.getByLabelText("Số lượng tồn kho") as HTMLInputElement;
    expect(input.value).toBe("15");
    expect(screen.getByText("hộp")).toBeInTheDocument();

    const plusBtn = screen.getByRole("button", { name: /tăng/i });
    await user.click(plusBtn);
    expect(input.value).toBe("16");

    const chip10 = screen.getByRole("button", { name: /\+10/i });
    await user.click(chip10);
    expect(input.value).toBe("26");
  });
});
