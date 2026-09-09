"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintReceiptButton({ className = "" }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      aria-label="In biên nhận đơn hàng"
      className={`font-bold print:hidden ${className}`}
    >
      <Printer className="mr-2 size-4" />
      <span>In biên nhận</span>
    </Button>
  );
}
