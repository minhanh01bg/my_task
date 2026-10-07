import {
  IconCalendar,
  IconDiscount2,
  IconSpeakerphone,
  IconSortDescending,
} from "@tabler/icons-react";
import Link from "next/link";

import {
  ActiveStatusBadge,
  EmptyState,
  PageHeader,
  Pagination,
} from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromotionForm } from "@/features/admin-promotions/promotion-form";
import { PROMOTION_PLACEMENTS } from "@/features/admin-promotions/promotion-placement";
import { PromotionRowActions } from "@/features/admin-promotions/promotion-row-actions";
import { listAdminPromotions } from "@/server/admin/list-promotions";
import { parsePageParam } from "@/server/admin/pagination";
import { requireAdminSession } from "@/server/auth/require-admin-session";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession({ redirectToLogin: true });
  const params = await searchParams;
  const result = await listAdminPromotions({
    page: parsePageParam(params.page),
  });

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Ưu đãi cửa hàng"
        title="Quản lý khuyến mãi"
        description="Soạn ưu đãi, chọn vị trí hiển thị và hẹn lịch trên cửa hàng online."
        action={
          <Button
            variant="outline"
            render={<Link href="/admin/promotions/vouchers" />}
            className="h-11"
          >
            <IconDiscount2 aria-hidden="true" />
            Mã giảm giá
          </Button>
        }
      />
      <PromotionForm />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách chiến dịch ({result.total})</CardTitle>
          <p className="text-muted-foreground text-sm">
            Các chiến dịch được sắp xếp theo mức ưu tiên, số lớn hơn đứng trước.
          </p>
        </CardHeader>
        <CardContent>
          {result.items.length ? (
            <ul className="space-y-3">
              {result.items.map((promo) => {
                const placement = PROMOTION_PLACEMENTS.find(
                  (item) => item.value === promo.placement,
                );
                const Icon = placement?.icon ?? IconSpeakerphone;
                return (
                  <li key={promo.id}>
                    <article
                      aria-label={`Chiến dịch ${promo.title}`}
                      className="bg-background min-w-0 rounded-xl border p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="bg-primary/8 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <h3 className="text-base font-semibold [overflow-wrap:anywhere] break-words">
                            {promo.title}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {placement?.label ?? "Vị trí khác"}
                            </Badge>
                            <ActiveStatusBadge
                              active={promo.isActive}
                              inactiveLabel="Tạm dừng"
                            />
                          </div>
                          {promo.body ? (
                            <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed [overflow-wrap:anywhere] break-words">
                              {promo.body}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                        <div className="text-muted-foreground flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <IconSortDescending
                              className="size-4"
                              aria-hidden="true"
                            />
                            Ưu tiên: {promo.priority}
                          </span>
                          <span className="inline-flex items-start gap-1.5">
                            <IconCalendar
                              className="size-4 shrink-0"
                              aria-hidden="true"
                            />
                            {promo.startsAt || promo.endsAt ? (
                              <span>
                                {promo.startsAt
                                  ? promo.startsAt.toLocaleDateString("vi-VN")
                                  : "Không giới hạn bắt đầu"}{" "}
                                →{" "}
                                {promo.endsAt
                                  ? promo.endsAt.toLocaleDateString("vi-VN")
                                  : "Không giới hạn kết thúc"}
                              </span>
                            ) : (
                              "Không giới hạn thời gian"
                            )}
                          </span>
                        </div>
                        <PromotionRowActions
                          id={promo.id}
                          title={promo.title}
                          isActive={promo.isActive}
                        />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={IconSpeakerphone}
              title="Chưa có chiến dịch khuyến mãi nào"
              description="Tạo ưu đãi đầu tiên ở khung phía trên để hiển thị trên cửa hàng."
            />
          )}
          <Pagination
            pathname="/admin/promotions"
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}
