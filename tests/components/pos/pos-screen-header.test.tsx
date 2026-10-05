import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";

describe("PosScreen header", () => {
  it("hiển thị quầy trực tiếp, không còn lối vào quản lý trung gian", () => {
    render(
      <PosScreen
        catalog={{
          categories: [],
          products: [],
          fetchedAt: new Date().toISOString(),
        }}
        bankAccount={null}
        storeName="Tiệm An Phát"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Hôm nay bán gì đây?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tiệm An Phát")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /quản lý cửa hàng/i }),
    ).not.toBeInTheDocument();
  });
});
