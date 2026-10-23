import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackInStockButton } from "@/features/online-store/back-in-stock-button";
import {
  invalidateStorefrontSession,
  STOREFRONT_SESSION_ENDPOINT,
} from "@/features/online-store/storefront-session";
import { BACK_IN_STOCK_ENDPOINT } from "@/types/back-in-stock";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const PRODUCT = { id: "prod_01", slug: "sua-chua-uong" };
const STATE_URL = `${BACK_IN_STOCK_ENDPOINT}?productId=${PRODUCT.id}`;

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let isCustomer: boolean;

function mockFetch(
  customer: boolean,
  handler?: (url: string, init?: RequestInit) => Promise<Response>,
) {
  isCustomer = customer;
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === STOREFRONT_SESSION_ENDPOINT) {
      return json({ isAdmin: false, isCustomer });
    }
    if (handler) return handler(url, init);
    return json({ message: "không mong đợi" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
}

function postBodies() {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)) as unknown);
}

function toggle() {
  return screen.findByRole("button", { name: "Báo khi có hàng" });
}

beforeEach(() => {
  invalidateStorefrontSession();
  refresh.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BackInStockButton", () => {
  it("khách chưa đăng nhập thấy link đăng nhập quay lại trang sản phẩm, không hỏi trạng thái", async () => {
    mockFetch(false);
    render(<BackInStockButton product={PRODUCT} />);

    const link = screen.getByRole("link", {
      name: "Đăng nhập để nhận thông báo khi có hàng",
    });
    expect(link).toHaveAttribute(
      "href",
      "/account/login?next=%2Fshop%2Fp%2Fsua-chua-uong",
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        STOREFRONT_SESSION_ENDPOINT,
        expect.anything(),
      ),
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).startsWith(BACK_IN_STOCK_ENDPOINT),
      ),
    ).toBe(false);
  });

  it("sản phẩm chưa có slug dùng đường dẫn theo id", async () => {
    mockFetch(false);
    render(<BackInStockButton product={{ id: "prod_01", slug: null }} />);

    expect(
      screen.getByRole("link", {
        name: "Đăng nhập để nhận thông báo khi có hàng",
      }),
    ).toHaveAttribute(
      "href",
      "/account/login?next=%2Fshop%2Fproducts%2Fprod_01",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("khách đã đăng nhập bấm để đăng ký và nút chuyển sang đang bật", async () => {
    mockFetch(true, (url, init) => {
      if (init?.method === "POST") {
        expect(url).toBe(BACK_IN_STOCK_ENDPOINT);
        expect(new Headers(init.headers).get("content-type")).toBe(
          "application/json",
        );
        return json({ productId: PRODUCT.id, subscribed: true });
      }
      expect(url).toBe(STATE_URL);
      expect(init).toMatchObject({
        credentials: "same-origin",
        cache: "no-store",
      });
      return json({ productId: PRODUCT.id, subscribed: false });
    });
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(postBodies()).toEqual([{ productId: PRODUCT.id, subscribed: true }]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đã bật: bạn sẽ nhận thông báo trong hộp thư khi sản phẩm có hàng.",
    );
  });

  it("đang tải trạng thái thì nút bị khóa và báo bận", async () => {
    let resolveState: (response: Response) => void = () => {};
    mockFetch(
      true,
      () =>
        new Promise<Response>((resolve) => {
          resolveState = resolve;
        }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(STATE_URL, expect.anything()),
    );
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    resolveState(
      new Response(
        JSON.stringify({ productId: PRODUCT.id, subscribed: true }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("bấm lại khi đang bật thì gửi subscribed:false để hủy", async () => {
    mockFetch(true, (_url, init) =>
      init?.method === "POST"
        ? json({ productId: PRODUCT.id, subscribed: false })
        : json({ productId: PRODUCT.id, subscribed: true }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() =>
      expect(button).toHaveAttribute("aria-pressed", "false"),
    );
    expect(postBodies()).toEqual([
      { productId: PRODUCT.id, subscribed: false },
    ]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("409 product_in_stock hiện thông báo của server và tải lại trang", async () => {
    mockFetch(true, (_url, init) =>
      init?.method === "POST"
        ? json(
            {
              code: "product_in_stock",
              message: "Sản phẩm đã có hàng trở lại, bạn có thể đặt mua ngay",
            },
            409,
          )
        : json({ productId: PRODUCT.id, subscribed: false }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sản phẩm đã có hàng trở lại, bạn có thể đặt mua ngay",
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("lỗi khác hiện message của server, không tải lại trang", async () => {
    mockFetch(true, (_url, init) =>
      init?.method === "POST"
        ? json(
            {
              code: "too_many_subscriptions",
              message:
                "Bạn đang chờ quá nhiều sản phẩm. Hãy bỏ bớt trước khi đăng ký thêm",
            },
            409,
          )
        : json({ productId: PRODUCT.id, subscribed: false }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn đang chờ quá nhiều sản phẩm. Hãy bỏ bớt trước khi đăng ký thêm",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("lỗi không có message dùng câu mặc định", async () => {
    mockFetch(true, (_url, init) =>
      init?.method === "POST"
        ? Promise.resolve(new Response("oops", { status: 500 }))
        : json({ productId: PRODUCT.id, subscribed: false }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không cập nhật được đăng ký. Vui lòng thử lại.",
    );
  });

  it("401 khi hỏi trạng thái thì quay về link đăng nhập", async () => {
    mockFetch(true, (url) => {
      expect(url).toBe(STATE_URL);
      // Phiên đã hết hạn: lần hỏi lại phiên sau đó trả về khách.
      isCustomer = false;
      return json(
        { message: "Vui lòng đăng nhập để nhận thông báo khi có hàng" },
        401,
      );
    });
    render(<BackInStockButton product={PRODUCT} />);

    // Trước khi phiên tải xong ai cũng thấy link; chờ tới lúc hỏi trạng thái.
    await toggle();
    expect(
      await screen.findByRole("link", {
        name: "Đăng nhập để nhận thông báo khi có hàng",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Báo khi có hàng" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url]) => url === STOREFRONT_SESSION_ENDPOINT,
        ),
      ).toHaveLength(2),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => url === STATE_URL),
    ).toHaveLength(1);
  });

  it("mất mạng khi bấm thì báo lỗi và mở lại nút", async () => {
    mockFetch(true, (_url, init) =>
      init?.method === "POST"
        ? Promise.reject(new TypeError("Failed to fetch"))
        : json({ productId: PRODUCT.id, subscribed: false }),
    );
    render(<BackInStockButton product={PRODUCT} />);

    const button = await toggle();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mất kết nối. Vui lòng thử lại.",
    );
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
