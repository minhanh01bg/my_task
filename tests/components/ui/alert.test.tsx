import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

describe("Alert", () => {
  it("mặc định là role alert với tiêu đề và mô tả", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Lưu thất bại</AlertTitle>
        <AlertDescription>Vui lòng thử lại.</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(alert).toHaveAttribute("data-variant", "destructive");
    expect(alert).toHaveTextContent("Lưu thất bại");
    expect(alert).toHaveTextContent("Vui lòng thử lại.");
  });

  it("cho phép đổi role sang status cho thông báo thành công", () => {
    render(
      <Alert variant="success" role="status">
        <AlertDescription>Đã lưu.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
