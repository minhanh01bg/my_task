"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { httpClient } from "@/lib/http-client";
import { type HealthResponse } from "@/types/api";

export function HealthCheck() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => httpClient<HealthResponse>("/api/health"),
  });

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Đang kiểm tra hệ thống...</p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-destructive text-sm font-medium">
        Kiểm tra kết nối thất bại.
      </p>
    );
  }

  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <p className="text-foreground text-sm">
        Trạng thái API:{" "}
        <span className="text-success font-semibold">{data.status}</span>
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        {new Date(data.timestamp).toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
