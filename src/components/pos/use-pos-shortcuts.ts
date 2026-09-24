"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onSearch: () => void;
  onCheckout: () => void;
  onHold: () => void;
}

/**
 * Chi tinh popup dang mo that su: Base UI giu popup trong DOM them mot nhip de
 * chay animation dong, luc do da mat data-open nen phim tat hoat dong lai ngay.
 * Popover/menu/select cung chan vi chung giu focus ban phim — F4/F8 luc do se
 * doi gio hang phia sau popup ma thu ngan khong thay.
 * Khong dung `[data-slot$="-content"]` tran: collapsible/tooltip cung co data-open.
 */
const OPEN_DIALOG_SELECTOR = [
  '[role="dialog"][data-open]',
  '[role="alertdialog"][data-open]',
  '[data-slot="dialog-content"][data-open]',
  '[data-slot="sheet-content"][data-open]',
  '[data-slot="popover-content"][data-open]',
  '[data-slot="dropdown-menu-content"][data-open]',
  '[data-slot="select-content"][data-open]',
].join(", ");

function isDialogOpen(): boolean {
  return document.querySelector(OPEN_DIALOG_SELECTOR) !== null;
}

/**
 * F2 vao o tim · F4 thanh toan · F8 giu don.
 * Ai quen ban rat nhanh; ai khong quen van bam chuot binh thuong.
 * Khi dang co hop thoai mo (thanh toan, tien cong, ban xong...) thi bo qua
 * de phim tat khong lam doi gio hang phia sau hop thoai.
 */
export function usePosShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "F2" && event.key !== "F4" && event.key !== "F8") {
        return;
      }
      if (isDialogOpen()) return;

      event.preventDefault();
      if (event.key === "F2") handlers.onSearch();
      else if (event.key === "F4") handlers.onCheckout();
      else handlers.onHold();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlers]);
}
