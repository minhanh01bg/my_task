import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountLoading from "@/app/account/loading";
import AdminError from "@/app/admin/error";
import AdminLoading from "@/app/admin/loading";
import CheckoutLoading from "@/app/checkout/loading";
import RootLoading from "@/app/loading";
import LoginLoading from "@/app/login/loading";
import OrderSuccessLoading from "@/app/order-success/[receipt]/loading";
import GuestOrderLoading from "@/app/orders/guest/[token]/loading";
import PosError from "@/app/pos/error";
import PosLoading from "@/app/pos/loading";
import ShopLoading from "@/app/shop/loading";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (error: unknown) => captureException(error),
}));

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}

const ERROR_BOUNDARIES: [string, ComponentType<ErrorProps>, RegExp][] = [
  ["admin", AdminError, /không thể tải trang quản lý/i],
  ["pos", PosError, /không thể mở màn hình bán hàng/i],
];

beforeEach(() => {
  captureException.mockClear();
});

describe.each(ERROR_BOUNDARIES)("%s/error.tsx", (_name, Boundary, title) => {
  it("hiện thông báo tiếng Việt và ghi nhận lỗi", () => {
    const error = new Error("db down");
    render(<Boundary error={error} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it('nút "Thử lại" gọi reset()', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<Boundary error={new Error("x")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("ưu tiên unstable_retry() của Next 16 để tải lại dữ liệu máy chủ", async () => {
    const reset = vi.fn();
    const retry = vi.fn();
    const user = userEvent.setup();
    render(
      <Boundary error={new Error("x")} reset={reset} unstable_retry={retry} />,
    );

    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("hiện mã lỗi để đối chiếu log khi có digest", () => {
    const error = Object.assign(new Error("x"), { digest: "abc123" });
    render(<Boundary error={error} reset={vi.fn()} />);

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});

const LOADINGS: [string, ComponentType][] = [
  ["app/loading", RootLoading],
  ["admin/loading", AdminLoading],
  ["pos/loading", PosLoading],
  ["login/loading", LoginLoading],
  ["order-success/[receipt]/loading", OrderSuccessLoading],
  ["shop/loading", ShopLoading],
  ["account/loading", AccountLoading],
  ["checkout/loading", CheckoutLoading],
  ["orders/guest/[token]/loading", GuestOrderLoading],
];

describe.each(LOADINGS)("%s.tsx", (_name, Loading) => {
  it("báo đang tải cho trình đọc màn hình và dùng skeleton của kit", () => {
    const { container } = render(<Loading />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    // Skeleton cua kit dung animate-shimmer, khong phai animate-pulse tu che.
    expect(container.querySelector(".animate-shimmer")).not.toBeNull();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("skeleton đúng dạng nội dung", () => {
  it("admin dùng TableSkeleton", () => {
    const { container } = render(<AdminLoading />);
    expect(
      container.querySelectorAll('[data-row-skeleton="true"]').length,
    ).toBeGreaterThan(0);
  });

  it("shop dùng ProductCardSkeleton dạng lưới", () => {
    const { container } = render(<ShopLoading />);
    expect(
      container.querySelectorAll(".surface-panel").length,
    ).toBeGreaterThanOrEqual(4);
  });
});
