import { Megaphone } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromotionForm } from "@/features/admin-promotions/promotion-form";
import { PromotionRowActions } from "@/features/admin-promotions/promotion-row-actions";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requireAdminSession({ redirectToLogin: true });

  const promotions = await prisma.storefrontPromotion.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản lý khuyến mãi & chiến dịch"
        description="Quản lý các thanh thông báo, hero banner và chương trình ưu đãi hiển thị trên cửa hàng online."
      />

      <Card>
        <CardHeader>
          <CardTitle>Tạo chiến dịch mới</CardTitle>
        </CardHeader>
        <CardContent>
          <PromotionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách chiến dịch ({promotions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {promotions.length > 0 ? (
            <div className="divide-y">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-bold">
                        {promo.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs tracking-wider uppercase"
                      >
                        {promo.placement}
                      </Badge>
                      <Badge
                        variant={promo.isActive ? "default" : "outline"}
                        className={
                          promo.isActive
                            ? "bg-success/15 text-success border-success/30 font-semibold"
                            : "bg-muted text-muted-foreground font-semibold"
                        }
                      >
                        {promo.isActive ? "Đang bật" : "Đã tắt"}
                      </Badge>
                    </div>

                    {promo.body ? (
                      <p className="text-muted-foreground line-clamp-1 text-sm">
                        {promo.body}
                      </p>
                    ) : null}

                    <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
                      <span>Ưu tiên: {promo.priority}</span>
                      {promo.startsAt || promo.endsAt ? (
                        <span>
                          Hiệu lực:{" "}
                          {promo.startsAt
                            ? new Date(promo.startsAt).toLocaleDateString(
                                "vi-VN",
                              )
                            : "Từ trước"}{" "}
                          →{" "}
                          {promo.endsAt
                            ? new Date(promo.endsAt).toLocaleDateString("vi-VN")
                            : "Không thời hạn"}
                        </span>
                      ) : (
                        <span>Luôn hiển thị</span>
                      )}
                    </div>
                  </div>

                  <PromotionRowActions
                    id={promo.id}
                    title={promo.title}
                    isActive={promo.isActive}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title="Chưa có chiến dịch khuyến mãi nào"
              description="Hãy tạo chiến dịch đầu tiên ở khung phía trên."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
