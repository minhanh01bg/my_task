import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePosShortcuts } from "@/components/pos/use-pos-shortcuts";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function Harness({
  handlers,
  dialogOpen = false,
}: {
  handlers: Parameters<typeof usePosShortcuts>[0];
  dialogOpen?: boolean;
}) {
  usePosShortcuts(handlers);
  return (
    <Dialog open={dialogOpen}>
      <DialogContent>
        <DialogTitle>Thanh toán</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

function makeHandlers() {
  return { onSearch: vi.fn(), onCheckout: vi.fn(), onHold: vi.fn() };
}

describe("usePosShortcuts", () => {
  it("F2/F4/F8 goi dung handler khi khong co dialog", () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    fireEvent.keyDown(window, { key: "F2" });
    fireEvent.keyDown(window, { key: "F4" });
    fireEvent.keyDown(window, { key: "F8" });

    expect(handlers.onSearch).toHaveBeenCalledTimes(1);
    expect(handlers.onCheckout).toHaveBeenCalledTimes(1);
    expect(handlers.onHold).toHaveBeenCalledTimes(1);
  });

  it("bo qua F2/F4/F8 khi dang co dialog mo", () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} dialogOpen />);

    fireEvent.keyDown(window, { key: "F2" });
    fireEvent.keyDown(window, { key: "F4" });
    fireEvent.keyDown(window, { key: "F8" });

    expect(handlers.onSearch).not.toHaveBeenCalled();
    expect(handlers.onCheckout).not.toHaveBeenCalled();
    expect(handlers.onHold).not.toHaveBeenCalled();
  });

  it("bo qua khi co dialog tu viet co role dialog va data-open", () => {
    const handlers = makeHandlers();
    render(
      <>
        <Harness handlers={handlers} />
        <div role="dialog" data-open="" />
      </>,
    );

    fireEvent.keyDown(window, { key: "F4" });

    expect(handlers.onCheckout).not.toHaveBeenCalled();
  });
});
