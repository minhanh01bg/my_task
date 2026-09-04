import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataTableShellProps {
  title: string;
  count: number;
  isEmpty: boolean;
  empty: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Vo chung cho moi bang trong /admin. Nhan isEmpty tu ben ngoai thay vi tu
 * dem children, de trang goi giu quyen quyet dinh the nao la "rong".
 */
export function DataTableShell({
  title,
  count,
  isEmpty,
  empty,
  children,
}: DataTableShellProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent className={isEmpty ? undefined : "px-0"}>
        {isEmpty ? empty : <div className="overflow-x-auto">{children}</div>}
      </CardContent>
    </Card>
  );
}
