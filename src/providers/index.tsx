"use client";

import { PropsWithChildren } from "react";
import { z } from "zod";

import { ThemeProvider } from "./theme-provider";

// Vô hiệu hóa JIT compilation của Zod 4 trong trình duyệt để tuân thủ Content Security Policy (chặn 'unsafe-eval')
z.config({ jitless: true });

/**
 * Provider dùng chung cho mọi khu vực. `QueryProvider` chỉ bọc layout
 * admin/POS để bundle storefront không kéo theo React Query.
 */
export function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
