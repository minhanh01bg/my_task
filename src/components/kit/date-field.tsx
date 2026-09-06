"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

interface DateFieldProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  "aria-label": string;
  className?: string;
  min?: string;
  max?: string;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date)
    : value;
}

function calendarDays(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const numberOfDays = new Date(year, monthIndex + 1, 0).getDate();

  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from(
      { length: numberOfDays },
      (_, index) => new Date(year, monthIndex, index + 1),
    ),
  ];
}

/** Date picker mau cho cac bo loc va form admin. */
export function DateField({
  name,
  defaultValue = "",
  value,
  onValueChange,
  placeholder = "Chọn ngày",
  "aria-label": ariaLabel,
  className,
  min,
  max,
}: DateFieldProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;
  const initialDate = parseDate(selectedValue) ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [open, setOpen] = useState(false);
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const today = dateValue(new Date());

  function select(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          "group border-input bg-background hover:border-primary/45 hover:bg-accent/35 focus-visible:border-primary focus-visible:ring-primary/15 data-[popup-open]:border-primary data-[popup-open]:ring-primary/15 flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-left text-sm font-semibold shadow-xs transition-[border-color,background-color,box-shadow] outline-none focus-visible:ring-4 data-[popup-open]:ring-4",
          className,
        )}
      >
        <span className="bg-muted text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <CalendarBlank
            aria-hidden="true"
            weight="duotone"
            className="size-5"
          />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !selectedValue && "text-muted-foreground font-medium",
          )}
        >
          {selectedValue ? formatDate(selectedValue) : placeholder}
        </span>
      </Popover.Trigger>

      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup className="bg-popover text-popover-foreground ring-border data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-[min(21rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl p-3 shadow-xl ring-1 duration-150">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                aria-label="Tháng trước"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                className="hover:bg-accent focus-visible:ring-ring flex size-10 items-center justify-center rounded-xl outline-none focus-visible:ring-2"
              >
                <CaretLeft
                  aria-hidden="true"
                  weight="bold"
                  className="size-4"
                />
              </button>
              <p className="font-heading font-bold">
                {MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </p>
              <button
                type="button"
                aria-label="Tháng sau"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                className="hover:bg-accent focus-visible:ring-ring flex size-10 items-center justify-center rounded-xl outline-none focus-visible:ring-2"
              >
                <CaretRight
                  aria-hidden="true"
                  weight="bold"
                  className="size-4"
                />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="text-muted-foreground py-1 text-xs font-bold"
                >
                  {weekday}
                </span>
              ))}
              {days.map((date, index) => {
                if (!date)
                  return <span key={`empty-${index}`} aria-hidden="true" />;
                const nextValue = dateValue(date);
                const selected = nextValue === selectedValue;
                const disabled =
                  (min !== undefined && nextValue < min) ||
                  (max !== undefined && nextValue > max);

                return (
                  <button
                    key={nextValue}
                    type="button"
                    disabled={disabled}
                    aria-label={date.toLocaleDateString("vi-VN", {
                      dateStyle: "full",
                    })}
                    aria-pressed={selected}
                    onClick={() => select(nextValue)}
                    className={cn(
                      "hover:bg-accent focus-visible:ring-ring relative flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-semibold outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-30",
                      nextValue === today &&
                        !selected &&
                        "text-primary after:bg-primary after:absolute after:bottom-1 after:size-1 after:rounded-full",
                      selected &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => select("")}
                className="text-muted-foreground hover:text-foreground min-h-10 px-2 text-sm font-semibold"
              >
                Xóa ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setVisibleMonth(
                    new Date(now.getFullYear(), now.getMonth(), 1),
                  );
                  select(dateValue(now));
                }}
                className="text-primary hover:bg-primary/10 min-h-10 rounded-xl px-3 text-sm font-bold"
              >
                Hôm nay
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
