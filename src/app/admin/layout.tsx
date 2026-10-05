import type { Metadata } from "next";

import { AdminWorkspace } from "@/features/admin-navigation/admin-workspace";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
