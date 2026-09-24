import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/kit";
import { DashboardSection } from "@/features/admin-dashboard/dashboard-section";
import { DashboardSkeleton } from "@/features/admin-dashboard/dashboard-skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản trị"
        title="Tổng quan"
        description="Doanh thu hôm nay, đơn online cần xử lý và hàng sắp hết."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection />
      </Suspense>
    </div>
  );
}
