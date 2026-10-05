"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminWorkspaceFrame({
  children,
  navigation,
}: {
  children: React.ReactNode;
  navigation: React.ReactNode;
}) {
  const sales = usePathname() === "/pos";

  return (
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 grid-rows-[4rem_1fr] md:grid-cols-[auto_minmax(0,1fr)] [&:has(>aside[data-collapsed])]:md:grid-cols-1",
      )}
    >
      {navigation}
      <main
        id="admin-main-content"
        className={
          sales
            ? "min-w-0 pb-20 md:pb-0"
            : "min-w-0 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
