"use client";
import { useRouter } from "next/navigation";
export function CustomerLogoutButton() {
  const router = useRouter();
  return (
    <button
      className="min-h-11 font-bold"
      onClick={async () => {
        await fetch("/api/customer-auth/logout", { method: "POST" });
        router.replace("/shop");
        router.refresh();
      }}
    >
      Đăng xuất
    </button>
  );
}
