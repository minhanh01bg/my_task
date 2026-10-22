import { PageHeader } from "@/components/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminSession } from "@/server/auth/require-admin-session";

import { OfflineQueueManager } from "./offline-queue-manager";

export default async function OfflineQueuePage() {
  await requireAdminSession({ redirectToLogin: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn chờ đồng bộ"
        description="Kiểm tra các đơn bán khi mất mạng trên chính thiết bị này. Hệ thống không tự ý xóa đơn đã thu tiền."
      />
      <Card>
        <CardHeader>
          <CardTitle>Hàng đợi trên thiết bị</CardTitle>
        </CardHeader>
        <CardContent>
          <OfflineQueueManager />
        </CardContent>
      </Card>
    </div>
  );
}
