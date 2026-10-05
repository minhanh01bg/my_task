"use client";

import { useState } from "react";
import { SidebarSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminWorkspaceFrame({
  children,
  navigation,
  sales,
}: {
  children: React.ReactNode;
  navigation: React.ReactNode;
  sales: boolean;
}) {
  const [navigationHidden, setNavigationHidden] = useState(false);

  return (
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)]",
        sales && navigationHidden && "md:grid-cols-1 [&>aside]:md:hidden",
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
        {sales ? (
          <div className="border-border bg-card/80 hidden h-14 items-center justify-between gap-3 border-b px-4 md:flex">
            <p className="font-heading font-bold">Quầy bán hàng</p>
            <Button
              variant="ghost"
              aria-expanded={!navigationHidden}
              onClick={() => setNavigationHidden((hidden) => !hidden)}
            >
              <SidebarSimple aria-hidden="true" className="size-5" />
              {navigationHidden
                ? "Hiện thanh điều hướng"
                : "Ẩn thanh điều hướng"}
            </Button>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
