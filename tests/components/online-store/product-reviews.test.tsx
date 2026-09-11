import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductReviews } from "@/features/online-store/product-reviews";

describe("ProductReviews component", () => {
  const sampleProduct = {
    id: "p-sample",
    name: "Cà phê Robusta Đắk Lắk",
  };

  it("hiển thị danh sách đánh giá mặc định và tổng điểm sao", () => {
    render(
      <ProductReviews
        productId={sampleProduct.id}
        productName={sampleProduct.name}
      />,
    );

    expect(screen.getByText(/đánh giá từ khách hàng/i)).toBeInTheDocument();
    expect(screen.getAllByText(/đã mua tại cửa hàng/i).length).toBeGreaterThan(
      0,
    );
  });

  it("cho phép gửi đánh giá mới và hiển thị ngay trên danh sách", () => {
    render(
      <ProductReviews
        productId={sampleProduct.id}
        productName={sampleProduct.name}
      />,
    );

    // Mở form viết đánh giá
    const writeBtn = screen.getByRole("button", { name: /viết đánh giá/i });
    fireEvent.click(writeBtn);

    // Điền tên và nhận xét
    const nameInput = screen.getByPlaceholderText(/tên của bạn/i);
    const commentInput = screen.getByPlaceholderText(/chia sẻ cảm nhận/i);

    fireEvent.change(nameInput, { target: { value: "Nguyễn Minh" } });
    fireEvent.change(commentInput, {
      target: { value: "Sản phẩm thơm ngon, đóng gói rất cẩn thận!" },
    });

    // Chọn sao
    const starButtons = screen.getAllByRole("button", { name: /sao/i });
    expect(starButtons.length).toBeGreaterThan(0);
    fireEvent.click(starButtons[4]); // 5 sao

    // Submit
    const submitBtn = screen.getByRole("button", { name: /gửi đánh giá/i });
    fireEvent.click(submitBtn);

    // Đánh giá mới xuất hiện
    expect(screen.getByText("Nguyễn Minh")).toBeInTheDocument();
    expect(
      screen.getByText("Sản phẩm thơm ngon, đóng gói rất cẩn thận!"),
    ).toBeInTheDocument();
    expect(screen.getByText(/cảm ơn bạn đã gửi đánh giá/i)).toBeInTheDocument();
  });
});
