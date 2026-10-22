"use client";

import { type ReactNode, useActionState } from "react";

import type { AdminActionResult } from "@/types/admin-action";

interface ActionFormProps {
  /** Server action đã `.bind(...)` đủ tham số. */
  action: () => Promise<AdminActionResult>;
  className?: string;
  children: ReactNode;
}

/**
 * Form một nút gọi server action; action trả `{ ok: false }` thì hiện
 * `message` ngay dưới nút thay vì nuốt lỗi.
 */
export function ActionForm({ action, className, children }: ActionFormProps) {
  const [error, formAction] = useActionState(async () => {
    const result = await action();
    return result.ok ? "" : result.message;
  }, "");

  return (
    <form action={formAction} className={className}>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </form>
  );
}
