interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Moi trang /admin mo dau giong nhau — tieu de, mot dong giai thich, mot hanh dong. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
