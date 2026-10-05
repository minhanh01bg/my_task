import { Suspense } from "react";

import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationProvider } from "@/features/admin-notifications/notification-provider";
import { AdminSearchProvider } from "@/features/admin-search/admin-search-provider";
import { QueryProvider } from "@/providers/query-provider";
import { requireAdminSession } from "@/server/auth/require-admin-session";

import { AdminNav } from "./admin-nav";
import { AdminWorkspaceFrame } from "./admin-workspace-frame";
import { LowStockNavBadge } from "./low-stock-nav-badge";

/** Khung và công cụ quản trị dùng chung cho admin và quầy bán hàng. */
export async function AdminWorkspace({
  children,
  sales = false,
}: {
  children: React.ReactNode;
  sales?: boolean;
}) {
  await requireAdminSession({ redirectToLogin: true });

  return (
    <QueryProvider>
      <ToastProvider>
        <NotificationProvider>
          <AdminSearchProvider>
            <AdminWorkspaceFrame
              sales={sales}
              navigation={
                <AdminNav
                  productsBadge={
                    <Suspense fallback={null}>
                      <LowStockNavBadge />
                    </Suspense>
                  }
                />
              }
            >
              {children}
            </AdminWorkspaceFrame>
          </AdminSearchProvider>
        </NotificationProvider>
      </ToastProvider>
      <ServiceWorkerRegistrar />
    </QueryProvider>
  );
}
