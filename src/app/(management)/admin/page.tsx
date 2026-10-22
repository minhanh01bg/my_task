import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/kit";
import { DashboardSection } from "@/features/admin-dashboard/dashboard-section";
import { DashboardSkeleton } from "@/features/admin-dashboard/dashboard-skeleton";
import { requireAdminSession } from "@/server/auth/require-admin-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tổng quan",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAdminSession({ redirectToLogin: true });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quản trị"
        title="Tổng quan"
        description="Tình hình hôm nay, xu hướng bán hàng và sản phẩm đem lại lợi nhuận."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
