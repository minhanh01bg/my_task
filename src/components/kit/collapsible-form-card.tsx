"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { TouchButton } from "@/components/kit/touch-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollapsibleFormCardProps {
  title: string;
  triggerLabel: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Form them moi mac dinh dong: viec thuong lam nhat o trang danh sach la
 * *xem* danh sach, khong phai them hang. Form xoe san se day bang xuong duoi.
 */
export function CollapsibleFormCard({
  title,
  triggerLabel,
  defaultOpen = false,
  children,
}: CollapsibleFormCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        render={
          <TouchButton variant={open ? "outline" : "default"}>
            <Plus aria-hidden="true" className="size-4" />
            {triggerLabel}
          </TouchButton>
        }
      />
      <CollapsibleContent>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
