"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onSearch: () => void;
  onCheckout: () => void;
  onHold: () => void;
}

/**
 * F2 vao o tim · F4 thanh toan · F8 giu don.
 * Ai quen ban rat nhanh; ai khong quen van bam chuot binh thuong.
 */
export function usePosShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        handlers.onSearch();
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        handlers.onCheckout();
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        handlers.onHold();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlers]);
}
