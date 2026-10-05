import type { Metadata } from "next";

import { AdminWorkspace } from "@/features/admin-navigation/admin-workspace";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

/** Giữ URL /pos để shell bán offline tiếp tục hoạt động. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <AdminWorkspace sales>{children}</AdminWorkspace>;
}
