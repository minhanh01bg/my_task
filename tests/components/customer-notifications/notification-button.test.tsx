import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";

const mockNotificationsResponse = {
  items: [
    {
      id: "cust-notif-1",
      accountId: "acc-1",
      eventKey: "customer-order:order-1:created",
      kind: "order_created",
      title: "Đặt hàng thành công",
      body: "Đơn hàng #DH-1001 đã được tiếp nhận.",
      orderId: "order-1",
      href: "/account/orders/order-1",
      createdAt: "2026-09-08T08:00:00.000Z",
      readAt: null,
    },
    {
      id: "cust-notif-2",
      accountId: "acc-1",
      eventKey: "customer-order:order-2:status:completed",
      kind: "order_status_completed",
      title: "Đơn hàng hoàn tất",
      body: "Đơn hàng #DH-1000 đã hoàn tất thành công.",
      orderId: "order-2",
      href: "/account/orders/order-2",
      createdAt: "2026-09-08T07:00:00.000Z",
      readAt: "2026-09-08T07:30:00.000Z",
    },
  ],
  unreadCount: 1,
  nextCursor: null,
};

describe("CustomerNotificationButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/customer/notifications/read")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockNotificationsResponse,
        });
      }),
    );
  });

  it("hiển thị badge số lượng chưa đọc và mở panel thông báo", async () => {
    render(<CustomerNotificationButton enabled />);

    // Kiểm tra badge hiển thị đúng 1
    const badge = await screen.findByTestId("customer-notification-badge");
    expect(badge).toHaveTextContent("1");

    // Click nút mở panel
    const button = screen.getByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    // Kiểm tra danh sách thông báo và đường dẫn deep link
    expect(await screen.findByText("Đặt hàng thành công")).toBeInTheDocument();
    expect(screen.getByText("Đơn hàng hoàn tất")).toBeInTheDocument();

    const orderLink = screen.getByRole("link", {
      name: /đặt hàng thành công/i,
    });
    expect(orderLink).toHaveAttribute("href", "/account/orders/order-1");
  });

  it("hiển thị '99+' khi unreadCount vượt quá 99", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockNotificationsResponse,
          unreadCount: 150,
        }),
      }),
    );

    render(<CustomerNotificationButton enabled />);

    const badge = await screen.findByTestId("customer-notification-badge");
    expect(badge).toHaveTextContent("99+");
  });

  it("gọi API mark-read khi bấm đánh dấu một tin đã đọc", async () => {
    render(<CustomerNotificationButton enabled />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    const markOneBtn = await screen.findByRole("button", {
      name: /đánh dấu đã đọc/i,
    });
    fireEvent.click(markOneBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/customer/notifications/read",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ notificationId: "cust-notif-1" }),
        }),
      );
    });
  });

  it("gọi API mark-read khi bấm đọc tất cả", async () => {
    render(<CustomerNotificationButton enabled />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    const markAllBtn = await screen.findByRole("button", {
      name: /đọc tất cả/i,
    });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/customer/notifications/read",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ all: true }),
        }),
      );
    });
  });

  it("hiển thị trạng thái trống khi không có thông báo nào", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [],
          unreadCount: 0,
          nextCursor: null,
        }),
      }),
    );

    render(<CustomerNotificationButton enabled />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    const title = await screen.findByText("Chưa có thông báo");
    expect(title.closest('[data-slot="empty-state"]')).not.toBeNull();
    // Hộp thư có cả tin báo có hàng, không chỉ đơn hàng.
    expect(
      screen.getByRole("region", { name: "Hộp thư thông báo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cập nhật đơn hàng và tin báo có hàng sẽ hiển thị tại đây.",
      ),
    ).toBeInTheDocument();
  });
  it("tải trang cursor và giữ thông báo cũ khi tải thêm lỗi", async () => {
    const first = { ...mockNotificationsResponse, nextCursor: "older-cursor" };
    const older = { ...first.items[0], id: "older", title: "Thông báo cũ" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...first,
          items: [first.items[0], older],
          nextCursor: "last-cursor",
        }),
      })
      .mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);
    render(<CustomerNotificationButton enabled />);
    await screen.findByTestId("customer-notification-badge");
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(
      await screen.findByRole("button", { name: "Tải thêm thông báo" }),
    );
    expect(await screen.findByText("Thông báo cũ")).toBeInTheDocument();
    expect(screen.getAllByText(first.items[0].title)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("?limit=6"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("cursor=older-cursor"),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tải thêm thông báo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải");
    expect(screen.getByText("Thông báo cũ")).toBeInTheDocument();
  });

  it("hiện skeleton khi yêu cầu đầu tiên chưa hoàn thành", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<CustomerNotificationButton enabled />);
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải thông báo");
    expect(
      screen.getByTestId("notification-list-skeleton"),
    ).toBeInTheDocument();
  });
  it("bỏ phản hồi cũ khi tài khoản đã bị tắt", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    const { rerender } = render(<CustomerNotificationButton enabled />);
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    rerender(<CustomerNotificationButton enabled={false} />);
    await act(async () => {
      resolve({ ok: true, json: async () => mockNotificationsResponse });
    });
    expect(
      screen.queryByTestId("customer-notification-badge"),
    ).not.toBeInTheDocument();
  });

  it("khôi phục trạng thái chưa đọc khi API đánh dấu trả lỗi HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url.includes("/read")
              ? { ok: false }
              : { ok: true, json: async () => mockNotificationsResponse },
          ),
        ),
    );
    render(<CustomerNotificationButton enabled />);
    await screen.findByTestId("customer-notification-badge");
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Đánh dấu đã đọc/ }),
    );
    expect(
      await screen.findByRole("button", { name: /Đánh dấu đã đọc/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("customer-notification-badge"),
    ).toHaveTextContent("1");
  });
  it("cập nhật đầu danh sách không bỏ khoảng trống giữa các trang", async () => {
    const first = { ...mockNotificationsResponse, nextCursor: "old-page" };
    const older = { ...first.items[0], id: "older", title: "Tin trước" };
    const fresh = { ...first.items[0], id: "fresh", title: "Tin mới" };
    const gap = {
      ...first.items[0],
      id: "gap",
      title: "Tin trong khoảng trống",
    };
    let headCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const value = url.includes("cursor=new-page")
          ? { ...first, items: [gap], nextCursor: "old-page" }
          : url.includes("cursor=old-page")
            ? { ...first, items: [older], nextCursor: "last-page" }
            : ++headCalls > 2
              ? { ...first, items: [fresh], nextCursor: "new-page" }
              : first;
        return Promise.resolve({ ok: true, json: async () => value });
      }),
    );
    render(<CustomerNotificationButton enabled />);
    await screen.findByTestId("customer-notification-badge");
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    await waitFor(() => expect(headCalls).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Tải thêm thông báo" }));
    await screen.findByText("Tin trước");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    await screen.findByText("Tin mới");
    fireEvent.click(screen.getByRole("button", { name: "Tải thêm thông báo" }));
    expect(
      await screen.findByText("Tin trong khoảng trống"),
    ).toBeInTheDocument();
  });

  it.each([false, true])(
    "đọc tất cả kết quả %s giữ và đồng bộ trang tải trong lúc chờ",
    async (success) => {
      const first = { ...mockNotificationsResponse, nextCursor: "older-page" };
      const older = {
        ...first.items[0],
        id: "older",
        title: "Trang tải trong lúc chờ",
      };
      let rejectRead!: (value: {
        ok: boolean;
        json?: () => Promise<unknown>;
      }) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/read"))
            return new Promise((resolve) => {
              rejectRead = resolve;
            });
          const value = url.includes("cursor=")
            ? { ...first, items: [older], nextCursor: null }
            : first;
          return Promise.resolve({ ok: true, json: async () => value });
        }),
      );
      render(<CustomerNotificationButton enabled />);
      await screen.findByTestId("customer-notification-badge");
      fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole("button", { name: "Đọc tất cả" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Tải thêm thông báo" }),
      );
      await screen.findByText("Trang tải trong lúc chờ");
      await act(async () => {
        rejectRead({
          ok: success,
          json: async () => ({ data: { unreadCount: 0 }, ok: true }),
        });
      });
      expect(screen.getByText("Trang tải trong lúc chờ")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Tải thêm thông báo" }),
      ).not.toBeInTheDocument();
      if (success)
        expect(
          screen.queryByRole("button", {
            name: "Đánh dấu đã đọc: Trang tải trong lúc chờ",
          }),
        ).not.toBeInTheDocument();
    },
  );
  it.each(["one", "all"])(
    "GET cũ không ghi đè trạng thái đọc sau POST %s thành công",
    async (mode) => {
      const first = { ...mockNotificationsResponse, nextCursor: "older" };
      let resolveHead!: (value: unknown) => void;
      let marked = false;
      let calls = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/read")) {
            marked = true;
            return Promise.resolve({
              ok: true,
              json: async () => ({ ok: true }),
            });
          }
          if (++calls === 3)
            return new Promise((resolve) => {
              resolveHead = resolve;
            });
          const value = marked
            ? {
                ...first,
                unreadCount: 0,
                items: first.items.map((item) => ({
                  ...item,
                  readAt: "2026-09-08T10:00:00.000Z",
                })),
              }
            : first;
          return Promise.resolve({ ok: true, json: async () => value });
        }),
      );
      render(<CustomerNotificationButton enabled />);
      await screen.findByTestId("customer-notification-badge");
      fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
      await waitFor(() => expect(calls).toBe(2));
      fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
      fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
      await waitFor(() => expect(resolveHead).toBeTypeOf("function"));
      fireEvent.click(
        screen.getByRole("button", {
          name: mode === "all" ? "Đọc tất cả" : /Đánh dấu đã đọc/,
        }),
      );
      await waitFor(() => expect(marked).toBe(true));
      await act(async () => {
        const value = first;
        resolveHead({ ok: true, json: async () => value });
      });
      expect(
        screen.queryByTestId("customer-notification-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Đánh dấu đã đọc/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("thử lại lỗi đầu danh sách không tải nhầm trang cũ", async () => {
    const first = { ...mockNotificationsResponse, nextCursor: "older" };
    const fresh = {
      ...first.items[0],
      id: "fresh",
      title: "Đã cập nhật đầu danh sách",
    };
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        ++calls;
        if (calls === 3) return Promise.resolve({ ok: false });
        const value =
          calls > 3 && !url.includes("cursor=")
            ? { ...first, items: [fresh] }
            : first;
        return Promise.resolve({ ok: true, json: async () => value });
      }),
    );
    render(<CustomerNotificationButton enabled />);
    await screen.findByTestId("customer-notification-badge");
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    await waitFor(() => expect(calls).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByText("Đã cập nhật đầu danh sách"),
    ).toBeInTheDocument();
  });
});
