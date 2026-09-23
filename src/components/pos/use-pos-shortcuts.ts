"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onSearch: () => void;
  onCheckout: () => void;
  onHold: () => void;
}

/** Popup cua Base UI Dialog/Sheet co data-open; dialog tu viet chi co role. */
const OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-open], [role="alertdialog"][data-open], [data-slot="dialog-content"], [data-slot="sheet-content"]';

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
