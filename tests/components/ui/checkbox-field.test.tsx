import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CheckboxField } from "@/components/kit/checkbox-field";

describe("CheckboxField", () => {
  it("liên kết nhãn và mô tả, bấm nhãn rồi Space để chọn/bỏ chọn", async () => {
    const user = userEvent.setup();
    render(
      <CheckboxField
        label="Kích hoạt chiến dịch"
        description="Hiển thị khi đến lịch chạy."
      />,
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "Kích hoạt chiến dịch",
    });
    expect(checkbox).toHaveAccessibleDescription("Hiển thị khi đến lịch chạy.");
    await user.click(screen.getByText("Kích hoạt chiến dịch"));
    expect(checkbox).toBeChecked();
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("không chọn khi bấm nhãn của trường bị vô hiệu hóa", async () => {
    const user = userEvent.setup();
    render(<CheckboxField label="Không thể chọn" disabled />);
    await user.click(screen.getByText("Không thể chọn"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("giữ mô tả ngoài và tên trường trong dữ liệu submit", () => {
    render(
      <form aria-label="Chiến dịch">
        <p id="extra-hint">Có thể đổi sau.</p>
        <CheckboxField
          id="active"
          name="isActive"
          label="Kích hoạt"
          description="Đang hiển thị."
          aria-describedby="extra-hint"
          defaultChecked
        />
      </form>,
    );
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Có thể đổi sau. Đang hiển thị.",
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).get("isActive")).toBe("on");
  });
});
