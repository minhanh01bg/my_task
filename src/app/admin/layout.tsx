import { AdminNav } from "@/features/admin-navigation/admin-nav";
import { NotificationProvider } from "@/features/admin-notifications/notification-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)]">
        <AdminNav />
        <main
          id="admin-main-content"
          className="min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}
