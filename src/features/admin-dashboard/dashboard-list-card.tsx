import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardListCardProps {
  id: string;
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
  children: React.ReactNode;
}

/** Khung chung cho hai danh sach ngan tren trang tong quan. */
export function DashboardListCard({
  id,
  title,
  viewAllHref,
  viewAllLabel,
  children,
}: DashboardListCardProps) {
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle id={headingId}>{title}</CardTitle>
          <Link
            href={viewAllHref}
            aria-label={`Xem tất cả: ${viewAllLabel}`}
            className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-bold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Xem tất cả
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
