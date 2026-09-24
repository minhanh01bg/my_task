"use client";

import { useEffect } from "react";

/**
 * Ctrl+K (Windows/Linux) hoac Cmd+K (macOS). So ca `code` de ban phim khong
 * phai Latin van bam duoc. Khong kem Shift/Alt de khong nuot to hop khac.
 */
export function isAdminSearchShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
    return false;
  }
  return event.key.toLowerCase() === "k" || event.code === "KeyK";
}

/**
 * Bat/tat palette tim kiem. Khac phim tat POS: LUON chay ke ca khi dang go
 * trong o nhap hay khi palette dang mo, vi to hop Ctrl/Cmd+K khong bao gio la
 * ky tu go vao — va chan mac dinh de trinh duyet khong nhay len thanh dia chi.
 */
export function useAdminSearchShortcut(onToggle: () => void): void {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!isAdminSearchShortcut(event)) return;
      event.preventDefault();
      if (event.repeat) return;
      onToggle();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onToggle]);
}
