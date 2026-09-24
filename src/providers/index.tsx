"use client";

import { PropsWithChildren } from "react";

import { ThemeProvider } from "./theme-provider";

/**
 * Provider dùng chung cho mọi khu vực. `QueryProvider` chỉ bọc layout
 * admin/POS để bundle storefront không kéo theo React Query.
 */
export function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
