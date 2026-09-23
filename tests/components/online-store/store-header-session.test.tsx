import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { StoreHeader } from "@/features/online-store/store-header";
import {
  invalidateStorefrontSession,
  STOREFRONT_SESSION_ENDPOINT,
} from "@/features/online-store/storefront-session";

type SessionBody = { isAdmin: boolean; isCustomer: boolean };

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response);
}

function deferredSession() {
  let resolve: (body: SessionBody) => void = () => {};
  const promise = new Promise<Response>((res) => {
    resolve = (body) => {
      void jsonResponse(body).then(res);
    };
  });
  return { promise, resolve };
}

function sessionCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === STOREFRONT_SESSION_ENDPOINT,
  );
}

function notificationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).startsWith("/api/customer/notifications"),
  );
}

function renderHeader() {
  return render(
    <OnlineCartProvider>
      <StoreHeader storeName="Cửa Hàng Xanh" />
    </OnlineCartProvider>,
  );
}

describe("StoreHeader session island", () => {
  let session: ReturnType<typeof deferredSession>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidateStorefrontSession();
    session = deferredSession();
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === STOREFRONT_SESSION_ENDPOINT) return session.promise;
      if (url.startsWith("/api/customer/notifications")) {
        return jsonResponse({ items: [], unreadCount: 0, nextCursor: null });
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateStorefrontSession();
  });

  it("render trạng thái khách trước khi có phản hồi phiên: không có nút quản trị/thông báo", () => {
    renderHeader();

    expect(
      screen.getByRole("button", { name: /tài khoản khách hàng/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quản trị/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^thông báo/i }),
    ).not.toBeInTheDocument();
    // Giữ chỗ cùng kích thước nút thông báo để tránh layout shift.
    expect(
      screen.getByTestId("customer-notification-placeholder"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(sessionCalls(fetchMock)).toHaveLength(1);
    expect(notificationCalls(fetchMock)).toHaveLength(0);
  });

  it("đổi sang nút thông báo khi phản hồi là khách hàng đã đăng nhập", async () => {
    renderHeader();

    await act(async () => {
      session.resolve({ isAdmin: false, isCustomer: true });
    });

    expect(
      await screen.findByRole("button", { name: /^thông báo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("customer-notification-placeholder"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tài khoản khách hàng/i }),
    ).toBeInTheDocument();
    await waitFor(() => expect(notificationCalls(fetchMock)).toHaveLength(1));
  });

  it("đổi sang nút Quản trị khi phản hồi là admin", async () => {
    renderHeader();

    await act(async () => {
      session.resolve({ isAdmin: true, isCustomer: false });
    });

    expect(
      await screen.findByRole("button", { name: /quản trị/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /tài khoản khách hàng/i }),
    ).not.toBeInTheDocument();
    expect(notificationCalls(fetchMock)).toHaveLength(0);
  });

  it("giữ trạng thái khách khi gọi phiên thất bại", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    renderHeader();

    await waitFor(() => expect(sessionCalls(fetchMock)).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: /tài khoản khách hàng/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quản trị/i }),
    ).not.toBeInTheDocument();
  });

  it("gọi /api/storefront/session một lần cho nhiều lần mount trong 60 giây", async () => {
    const first = renderHeader();
    await act(async () => {
      session.resolve({ isAdmin: false, isCustomer: false });
    });
    first.unmount();

    renderHeader();

    expect(sessionCalls(fetchMock)).toHaveLength(1);
  });
});

describe("CustomerNotificationButton enabled", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("không gọi API thông báo khi enabled=false", () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ items: [], unreadCount: 0, nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerNotificationButton enabled={false} />);
    screen.getByRole("button", { name: /^thông báo/i }).click();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gọi API thông báo khi enabled=true", async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ items: [], unreadCount: 0, nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CustomerNotificationButton enabled />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
