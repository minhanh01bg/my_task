import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DebtPanel } from "@/components/pos/debt-panel";

/** GET tra cứu khách luôn rỗng; POST tạo khách trả `createResult`. */
function stubCustomerApi(createResult: () => Promise<Response>) {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? createResult()
      : Promise.resolve(Response.json({ customers: [] })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function tryCreate(name: string) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<DebtPanel selected={null} onSelect={onSelect} />);

  await user.type(screen.getByRole("textbox", { name: "Tên khách nợ" }), name);
  await user.click(
    screen.getByRole("button", { name: `Tạo khách mới "${name}"` }),
  );
  return onSelect;
}

describe("DebtPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ô tên khách giới hạn 100 ký tự như server", () => {
    render(<DebtPanel selected={null} onSelect={vi.fn()} />);

    expect(
      screen.getByRole("textbox", { name: "Tên khách nợ" }),
    ).toHaveAttribute("maxLength", "100");
  });

  it("server từ chối tạo khách thì hiện thông báo của server", async () => {
    stubCustomerApi(() =>
      Promise.resolve(
        Response.json({ message: "Chưa đăng nhập" }, { status: 401 }),
      ),
    );

    const onSelect = await tryCreate("Hùng");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa đăng nhập",
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("lỗi không kèm JSON thì hiện thông báo chung", async () => {
    stubCustomerApi(() =>
      Promise.resolve(new Response("Bad Gateway", { status: 502 })),
    );

    await tryCreate("Hùng");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tạo được khách, vui lòng thử lại.",
    );
  });

  it("mất mạng khi tạo khách thì hiện thông báo chung", async () => {
    stubCustomerApi(() => Promise.reject(new TypeError("Failed to fetch")));

    await tryCreate("Hùng");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tạo được khách, vui lòng thử lại.",
    );
  });

  it("tạo khách thành công thì chọn khách mới", async () => {
    const customer = { id: "c1", name: "Hùng", phone: null };
    stubCustomerApi(() =>
      Promise.resolve(Response.json({ customer }, { status: 201 })),
    );

    const onSelect = await tryCreate("Hùng");

    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(customer));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
