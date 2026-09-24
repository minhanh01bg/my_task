import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Dong nho phia tren tieu de, vd. "Chi tiết đơn hàng". */
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Moi trang /admin mo dau giong nhau — tieu de, mot dong giai thich, mot hanh dong. */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {title}
        </h1>
        {description ? (
          <div className="text-muted-foreground text-sm">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
