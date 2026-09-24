import type { Metadata } from "next";

import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { AdminNav } from "@/features/admin-navigation/admin-nav";
import { LowStockNavBadge } from "@/features/admin-navigation/low-stock-nav-badge";
import { NotificationProvider } from "@/features/admin-notifications/notification-provider";
import { AdminSearchProvider } from "@/features/admin-search/admin-search-provider";
import { QueryProvider } from "@/providers/query-provider";
import { requireAdminSession } from "@/server/auth/require-admin-session";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession({ redirectToLogin: true });

  return (
    <QueryProvider>
      <NotificationProvider>
        <AdminSearchProvider>
          <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)]">
            <AdminNav productsBadge={<LowStockNavBadge />} />
            <main
              id="admin-main-content"
              className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8"
            >
              {children}
            </main>
          </div>
        </AdminSearchProvider>
      </NotificationProvider>
      <ServiceWorkerRegistrar />
    </QueryProvider>
  );
}
