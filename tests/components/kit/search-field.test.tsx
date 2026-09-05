import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { SearchField } from "@/components/kit/search-field";

describe("SearchField", () => {
  it("chuyen tiep ref de phim tat F2 focus duoc", () => {
    const ref = createRef<HTMLInputElement>();
    render(<SearchField ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("chua co chu thi khong hien nut xoa", () => {
    render(<SearchField value="" onChange={() => {}} onClear={() => {}} />);
    expect(
      screen.queryByRole("button", { name: "Xoá ô tìm" }),
    ).not.toBeInTheDocument();
  });

  it("co chu thi hien nut xoa va goi onClear", async () => {
    const onClear = vi.fn();
    render(<SearchField value="bugi" onChange={() => {}} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "Xoá ô tìm" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("cao hon o cham vi la o duoc dung nhieu nhat", () => {
    render(<SearchField value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveClass("h-14");
  });
});
