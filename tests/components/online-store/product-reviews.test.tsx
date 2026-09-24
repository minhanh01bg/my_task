import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductReviews } from "@/features/online-store/product-reviews";
import {
  invalidateStorefrontSession,
  STOREFRONT_SESSION_ENDPOINT,
} from "@/features/online-store/storefront-session";
import type { PublicReview, PublicReviewPage } from "@/types/review";

const PRODUCT = { id: "p-sample", name: "Cà phê Robusta Đắk Lắk" };
const ENDPOINT = `/api/online/products/${PRODUCT.id}/reviews`;

function review(overrides: Partial<PublicReview> = {}): PublicReview {
  return {
    id: "r-1",
    authorName: "Thu Trang",
    rating: 5,
    content: "Cà phê thơm, giao nhanh",
    isVerifiedPurchase: true,
    createdAt: "2026-09-20T03:00:00.000Z",
    ...overrides,
  };
}

function page(items: PublicReview[], total = items.length): PublicReviewPage {
  return { items, total, page: 1, pageSize: 10 };
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

function mockFetch(
  isCustomer: boolean,
  handler?: (url: string, init?: RequestInit) => Promise<Response>,
) {
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

beforeEach(() => {
  invalidateStorefrontSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductReviews", () => {
  it("hiển thị đánh giá thật từ server, điểm tổng hợp và nhãn đã mua", () => {
    mockFetch(false);
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page([review()])}
        summary={{ avg: 5, count: 1 }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /đánh giá từ khách hàng/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Thu Trang")).toBeInTheDocument();
    expect(screen.getByText("Cà phê thơm, giao nhanh")).toBeInTheDocument();
    expect(screen.getByText(/đã mua hàng/i)).toBeInTheDocument();
    expect(screen.getByText("(1 đánh giá)")).toBeInTheDocument();
  });

  it("trạng thái rỗng và CTA đăng nhập khi là khách", async () => {
    mockFetch(false);
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page([])}
        summary={{ avg: 0, count: 0 }}
      />,
    );
    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /đăng nhập để viết đánh giá/i }),
    ).toHaveAttribute("href", "/account/login");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: /viết đánh giá/i }),
    ).not.toBeInTheDocument();
  });

  it("khách đã đăng nhập gửi đánh giá, danh sách và điểm cập nhật", async () => {
    mockFetch(true, (url, init) => {
      expect(url).toBe(ENDPOINT);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        rating: 4,
        content: "Đóng gói cẩn thận, vị đậm",
      });
      return json(
        {
          review: review({
            id: "r-new",
            authorName: "Minh Anh",
            rating: 4,
            content: "Đóng gói cẩn thận, vị đậm",
            isVerifiedPurchase: false,
          }),
          summary: { avg: 4, count: 1 },
        },
        201,
      );
    });
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page([])}
        summary={{ avg: 0, count: 0 }}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /viết đánh giá/i }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /sao/i })[3]!);
    fireEvent.change(screen.getByLabelText(/nội dung đánh giá/i), {
      target: { value: "Đóng gói cẩn thận, vị đậm" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(await screen.findByText("Minh Anh")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/cảm ơn bạn/i);
    expect(screen.getByText("(1 đánh giá)")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có đánh giá")).not.toBeInTheDocument();
  });

  it("hiển thị lỗi từ API (vd. giới hạn gửi) và không thêm đánh giá", async () => {
    mockFetch(true, () =>
      json({ message: "Bạn đã gửi quá nhiều đánh giá." }, 429),
    );
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page([])}
        summary={{ avg: 0, count: 0 }}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /viết đánh giá/i }),
    );
    fireEvent.change(screen.getByLabelText(/nội dung đánh giá/i), {
      target: { value: "Nội dung đủ dài để gửi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn đã gửi quá nhiều đánh giá.",
    );
  });

  it("chặn nội dung quá ngắn phía client", async () => {
    mockFetch(true);
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page([])}
        summary={{ avg: 0, count: 0 }}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /viết đánh giá/i }),
    );
    fireEvent.change(screen.getByLabelText(/nội dung đánh giá/i), {
      target: { value: "ngắn" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/ít nhất 10/);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === ENDPOINT),
    ).toHaveLength(0);
  });

  it("tải thêm trang đánh giá kế tiếp", async () => {
    mockFetch(false, (url) => {
      expect(url).toBe(`${ENDPOINT}?page=2`);
      return json({
        items: [review({ id: "r-11", authorName: "Văn Hùng" })],
        total: 11,
        page: 2,
        pageSize: 10,
      });
    });
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      review({ id: `r-${index}`, authorName: `Khách ${index}` }),
    );
    render(
      <ProductReviews
        productId={PRODUCT.id}
        productName={PRODUCT.name}
        initialReviews={page(firstPage, 11)}
        summary={{ avg: 5, count: 11 }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /xem thêm đánh giá/i }));
    expect(await screen.findByText("Văn Hùng")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /xem thêm đánh giá/i }),
    ).not.toBeInTheDocument();
  });
});
