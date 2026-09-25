import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ActiveStatusBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}

/**
 * Badge hiển thị trạng thái hoạt động bật/tắt (Đang bật / Đã tắt hoặc Đang hoạt động / Tạm dừng).
 */
export function ActiveStatusBadge({
  active,
  activeLabel = "Đang bật",
  inactiveLabel = "Đã tắt",
  className,
}: ActiveStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        active
          ? "border-success/30 bg-success/15 text-success"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
      data-slot="active-status-badge"
    >
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

export interface AccountStatusBadgeProps {
  disabled: boolean;
  className?: string;
}

/**
 * Badge hiển thị trạng thái tài khoản người dùng / khách hàng (Đang hoạt động / Đã khóa).
 */
export function AccountStatusBadge({
  disabled,
  className,
}: AccountStatusBadgeProps) {
  return disabled ? (
    <Badge
      variant="destructive"
      className={cn("font-bold", className)}
      data-slot="account-status-badge"
    >
      Đã khóa
    </Badge>
  ) : (
    <Badge
      className={cn(
        "border-success/30 bg-success/12 text-success font-bold",
        className,
      )}
      data-slot="account-status-badge"
    >
      Đang hoạt động
    </Badge>
  );
}

export type ReviewStatusType = "published" | "hidden";

export interface ReviewStatusBadgeProps {
  status: ReviewStatusType | string;
  className?: string;
}

/**
 * Badge hiển thị trạng thái đánh giá sản phẩm (Đang hiển thị / Đã ẩn).
 */
export function ReviewStatusBadge({
  status,
  className,
}: ReviewStatusBadgeProps) {
  const isHidden = status === "hidden";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold",
        isHidden
          ? "border-border bg-muted text-muted-foreground"
          : "border-success/30 bg-success/15 text-success",
        className,
      )}
      data-slot="review-status-badge"
    >
      {isHidden ? "Đã ẩn" : "Đang hiển thị"}
    </Badge>
  );
}

export interface VoucherStatusInfo {
  label: string;
  className: string;
}

export function getVoucherStatusInfo(voucher: {
  isActive: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  maxUses?: number | null;
  usedCount: number;
}): VoucherStatusInfo {
  const now = Date.now();
  if (!voucher.isActive) {
    return {
      label: "Đã tắt",
      className: "border-border bg-muted text-muted-foreground",
    };
  }
  const endsAtTime = voucher.endsAt ? new Date(voucher.endsAt).getTime() : null;
  if (endsAtTime && endsAtTime < now) {
    return {
      label: "Hết hạn",
      className: "border-border bg-muted text-muted-foreground",
    };
  }
  if (
    voucher.maxUses !== null &&
    voucher.maxUses !== undefined &&
    voucher.usedCount >= voucher.maxUses
  ) {
    return {
      label: "Hết lượt",
      className: "border-warning/30 bg-warning/15 text-warning",
    };
  }
  const startsAtTime = voucher.startsAt
    ? new Date(voucher.startsAt).getTime()
    : null;
  if (startsAtTime && startsAtTime > now) {
    return {
      label: "Sắp diễn ra",
      className: "border-info/30 bg-info/15 text-info",
    };
  }
  return {
    label: "Đang chạy",
    className: "border-success/30 bg-success/15 text-success",
  };
}

export interface VoucherStatusBadgeProps {
  voucher: {
    isActive: boolean;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    maxUses?: number | null;
    usedCount: number;
  };
  className?: string;
}

/**
 * Badge hiển thị trạng thái của mã giảm giá (Đang chạy, Sắp diễn ra, Hết lượt, Hết hạn, Đã tắt).
 */
export function VoucherStatusBadge({
  voucher,
  className,
}: VoucherStatusBadgeProps) {
  const info = getVoucherStatusInfo(voucher);
  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-semibold", info.className, className)}
      data-slot="voucher-status-badge"
    >
      {info.label}
    </Badge>
  );
}
