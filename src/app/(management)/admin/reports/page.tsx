import { redirect } from "next/navigation";

import { parseReportDays } from "@/server/reports/daily-revenue";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const value = Array.isArray(params.days) ? params.days[0] : params.days;
  redirect(`/admin?days=${parseReportDays(value)}`);
}
