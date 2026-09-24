import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ServiceLineDialog } from "@/components/pos/service-line-dialog";
import { useCartStore } from "@/stores/cart-store";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Tiền công
      </button>
      <ServiceLineDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

describe("ServiceLineDialog", () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it("mo ra thi focus o ten dich vu, them dong tien cong roi dong", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Tiền công" }));

    expect(
      screen.getByRole("dialog", { name: "Thêm tiền công" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Tên dịch vụ")).toHaveFocus(),
    );

    await user.type(screen.getByLabelText("Tên dịch vụ"), "Công thay nhớt");
    await user.type(screen.getByLabelText("Số tiền"), "30000");
    await user.click(screen.getByRole("button", { name: "Thêm" }));

    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.name).toBe("Công thay nhớt");
    expect(lines[0]?.unitPrice).toBe(30000);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Escape dong va tra focus ve nut mo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Tiền công" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });
});
