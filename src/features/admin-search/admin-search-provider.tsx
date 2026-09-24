"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CommandPalette } from "./command-palette";
import { useAdminSearchShortcut } from "./use-admin-search-shortcut";

interface AdminSearchContextValue {
  openSearch: () => void;
  toggleSearch: () => void;
}

const AdminSearchContext = createContext<AdminSearchContextValue | null>(null);

/** Gan palette Ctrl/Cmd+K cho toan bo khu admin; nut kinh lup goi `openSearch`. */
export function AdminSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleSearch = useCallback(() => setOpen((value) => !value), []);
  const openSearch = useCallback(() => setOpen(true), []);
  const value = useMemo(
    () => ({ openSearch, toggleSearch }),
    [openSearch, toggleSearch],
  );

  useAdminSearchShortcut(toggleSearch);

  return (
    <AdminSearchContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </AdminSearchContext.Provider>
  );
}

export function useAdminSearch(): AdminSearchContextValue {
  const context = useContext(AdminSearchContext);
  if (!context) {
    throw new Error("useAdminSearch phải nằm trong AdminSearchProvider");
  }
  return context;
}
