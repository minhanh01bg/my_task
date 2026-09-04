import { Money } from "@/components/kit/money";
import { Card, CardContent } from "@/components/ui/card";

interface StatTileProps {
  label: string;
  value: number;
  format?: "money" | "number";
  hint?: string;
}

export function StatTile({
  label,
  value,
  format = "number",
  hint,
}: StatTileProps) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        {format === "money" ? (
          <Money amount={value} className="text-2xl" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
