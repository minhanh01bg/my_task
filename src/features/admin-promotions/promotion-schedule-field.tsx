"use client";

import { DateField } from "@/components/kit/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Keep the existing datetime contract while using the shared Vietnamese calendar. */
export function PromotionScheduleField({
  id,
  kind,
  value,
  onValueChange,
  error,
  readOnly,
}: {
  id: string;
  kind: "bắt đầu" | "kết thúc";
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  readOnly: boolean;
}) {
  const [date = "", time = ""] = value.split("T");
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>Thời gian {kind}</Label>
      <DateField
        id={id}
        aria-label={`Ngày ${kind}`}
        value={date}
        onValueChange={(nextDate) =>
          onValueChange(nextDate ? `${nextDate}T${time || "00:00"}` : "")
        }
        readOnly={readOnly}
        aria-invalid={!!error}
        aria-describedby={errorId}
      />
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${id}-time`}
          className="text-muted-foreground shrink-0 text-xs"
        >
          Giờ {kind}
        </Label>
        <Input
          id={`${id}-time`}
          type="time"
          value={time}
          disabled={!date}
          readOnly={readOnly}
          aria-invalid={!!error}
          aria-describedby={errorId}
          onChange={(event) =>
            onValueChange(`${date}T${event.target.value || "00:00"}`)
          }
          className="h-11 min-w-0 flex-1"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
