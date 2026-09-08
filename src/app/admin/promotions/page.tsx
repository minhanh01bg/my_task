import { PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromotionForm } from "@/features/admin-promotions/promotion-form";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";

import { deletePromotionAction, togglePromotionActiveAction } from "./actions";

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
                      <span className="text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
                        {promo.placement}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          promo.isActive
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {promo.isActive ? "Đang bật" : "Đã tắt"}
                      </span>
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

                  <div className="flex items-center gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await togglePromotionActiveAction(
                          promo.id,
                          !promo.isActive,
                        );
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className={
                          promo.isActive
                            ? "text-amber-600 hover:text-amber-700"
                            : "text-emerald-600 hover:text-emerald-700"
                        }
                      >
                        {promo.isActive ? "Tạm dừng" : "Kích hoạt"}
                      </Button>
                    </form>

                    <form
                      action={async () => {
                        "use server";
                        await deletePromotionAction(promo.id);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        Xóa
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center text-sm">
              Chưa có chiến dịch khuyến mãi nào. Hãy tạo chiến dịch đầu tiên ở
              trên!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
