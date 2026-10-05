import { AdminWorkspace } from "@/features/admin-navigation/admin-workspace";

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminWorkspace>{children}</AdminWorkspace>;
}
