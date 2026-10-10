import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AddressFields,
  type AddressState,
} from "@/features/online-store/address-fields";

function Fixture() {
  const [value, onChange] = useState<AddressState>({
    provinceCode: "",
    wardCode: "",
    provinceName: "",
    wardName: "",
    street: "",
    isManual: false,
  });
  return (
    <form aria-label="Địa chỉ">
      <AddressFields value={value} onChange={onChange} />
    </form>
  );
}

describe("Tìm địa chỉ hành chính", () => {
  it("lọc gợi ý không dấu, chọn bằng bàn phím và lưu đúng mã/tên", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const province = screen.getByRole("combobox", { name: "Tỉnh/thành phố" });
    const ward = screen.getByRole("combobox", { name: "Phường/xã" });
    expect(ward).toBeDisabled();
    await user.type(province, "bac ninh");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "Thành phố Bắc Ninh" }),
    ).toBeVisible();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(province).toHaveValue("Thành phố Bắc Ninh");
    await user.type(ward, "dong ky");
    await user.click(screen.getByRole("option", { name: "Xã Đồng Kỳ" }));
    expect(ward).toHaveValue("Xã Đồng Kỳ");
    const form = screen.getByRole("form") as HTMLFormElement;
    const data = new FormData(form);
    expect(data.get("provinceCode")).toBe("24");
    expect(data.get("wardCode")).toBeTruthy();
    expect(data.get("deliveryWard")).toBe("Xã Đồng Kỳ");
    await user.clear(province);
    expect(ward).toBeDisabled();
    expect(new FormData(form).get("wardCode")).toBeNull();
    await user.type(province, "ha noi");
    await user.click(screen.getByRole("option", { name: "Thành phố Hà Nội" }));
    expect(ward).toHaveValue("");
    await user.type(ward, "ba dinh");
    await user.click(screen.getByRole("option", { name: "Phường Ba Đình" }));
    expect(ward).toHaveValue("Phường Ba Đình");
  });

  it("báo không tìm thấy và vẫn cho nhập thủ công", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.type(
      screen.getByRole("combobox", { name: "Tỉnh/thành phố" }),
      "khongtontai",
    );
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Không tìm thấy địa chỉ phù hợp.")).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Nhập thủ công" }));
    await user.type(
      screen.getByLabelText(/Tỉnh\/thành phố/),
      "Địa chỉ nhập tay",
    );
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get(
        "deliveryProvince",
      ),
    ).toBe("Địa chỉ nhập tay");
  });
});
