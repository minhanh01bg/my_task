import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

import { AdminSearchButton } from "@/features/admin-search/admin-search-button";
import { AdminSearchProvider } from "@/features/admin-search/admin-search-provider";

const results = {
  products: [
    {
      id: "p1",
      name: "Ốc vít 5 ly",
      sku: "OV5",
      href: "/admin/products?q=%E1%BB%90c&edit=p1",
    },
    {
      id: "p2",
      name: "Ốc vít 8 ly",
      sku: null,
      href: "/admin/products?q=%E1%BB%90c&edit=p2",
    },
  ],
  orders: [
    {
      id: "o1",
      code: "DH1001",
      customerName: "Chú Tư",
      total: 50_000,
      href: "/admin/orders/o1",
    },
  ],
  customers: [
    {
      id: "c1",
      displayName: "Khách A",
      phone: "0901234567",
      href: "/admin/orders?q=0901234567",
    },
  ],
};

const empty = { products: [], orders: [], customers: [] };

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => ({ data }) };
}

function renderPalette() {
  return render(
    <AdminSearchProvider>
      <input aria-label="Ô khác" />
      <AdminSearchButton />
    </AdminSearchProvider>,
  );
}

function pressCtrlK(target: Element | Window = window) {
  fireEvent.keyDown(target, { key: "k", ctrlKey: true });
}

async function openAndType(value: string) {
  pressCtrlK();
  const input = await screen.findByRole("combobox");
  fireEvent.change(input, { target: { value } });
  return input;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockReset();
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(results));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Admin command palette", () => {
  it("Ctrl+K mở, kể cả khi đang gõ trong ô nhập khác; Cmd+K bật/tắt", async () => {
    renderPalette();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    pressCtrlK(screen.getByLabelText("Ô khác"));
    const input = await screen.findByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Gõ tên sản phẩm/)).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument(),
    );
  });

  it("phím K thường không mở", () => {
    renderPalette();
    fireEvent.keyDown(window, { key: "k" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("nút kính lúp mở palette", async () => {
    renderPalette();
    fireEvent.click(screen.getByRole("button", { name: /Tìm kiếm/ }));
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("debounce 200ms: gõ nhanh chỉ gọi fetch một lần với chuỗi cuối", async () => {
    renderPalette();
    pressCtrlK();
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "o" } });
    fireEvent.change(input, { target: { value: "oc" } });
    fireEvent.change(input, { target: { value: "oc v" } });
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/search?q=oc+v",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(await screen.findByText("Ốc vít 5 ly")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sản phẩm" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Khách hàng" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("huỷ request cũ khi gõ tiếp", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderPalette();
    const input = await openAndType("oc");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    fireEvent.change(input, { target: { value: "oc vit" } });
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("hiện skeleton khi đang tải và trạng thái rỗng khi không có kết quả", async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise((r) => (resolve = r as (value: unknown) => void)),
    );
    renderPalette();
    await openAndType("zzz");
    expect(await screen.findByTestId("admin-search-loading")).toBeVisible();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => resolve(jsonResponse(empty)));
    expect(
      await screen.findByText("Không tìm thấy kết quả"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin-search-loading"),
    ).not.toBeInTheDocument();
  });

  it("báo lỗi khi API hỏng", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    renderPalette();
    await openAndType("oc");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Không tải được kết quả/,
    );
  });

  it("mũi tên lên/xuống đổi aria-activedescendant, Enter điều hướng và đóng", async () => {
    renderPalette();
    const input = await openAndType("oc");
    await screen.findByText("Ốc vít 5 ly");

    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[2].id);
    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    // vong ve cuoi danh sach
    expect(input).toHaveAttribute("aria-activedescendant", options[3].id);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/admin/orders?q=0901234567");
    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument(),
    );
  });

  it("bấm chuột vào kết quả cũng điều hướng", async () => {
    renderPalette();
    await openAndType("oc");
    fireEvent.click(await screen.findByText("DH1001"));
    expect(push).toHaveBeenCalledWith("/admin/orders/o1");
  });

  it("Escape đóng palette và mở lại thì ô tìm trống", async () => {
    renderPalette();
    const input = await openAndType("oc");
    await screen.findByText("Ốc vít 5 ly");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();

    pressCtrlK();
    expect(await screen.findByRole("combobox")).toHaveValue("");
  });
});
