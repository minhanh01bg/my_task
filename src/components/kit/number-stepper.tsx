"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";

import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface NumberStepperProps {
  id?: string;
  name: string;
  defaultValue?: number;
  value?: number;
  onChange?: (val: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  allowDecimal?: boolean;
  allowNegative?: boolean;
  quickSteps?: readonly number[];
  unit?: string;
  isCurrency?: boolean;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

/**
 * Component NumberStepper:
 * - Thay the nut mui ten mac dinh ti hon cua trinh duyet bang 2 nut [-] va [+] to ro, de bam (min 48px tap target).
 * - Ho tro buoc nhay (step), mac dinh buoc nhay gia VND la 1.000d thay vi 1d.
 * - Co cac nut nhanh (quickSteps) giup bam nhanh +1.000, +5.000, +10.000...
 * - Hien thi xem truoc gia tri tien te format (VND) ro rang.
 */
export function NumberStepper({
  id,
  name,
  defaultValue = 0,
  value,
  onChange,
  min,
  max,
  step = 1,
  allowDecimal = false,
  allowNegative = false,
  quickSteps,
  unit,
  isCurrency = false,
  className,
  inputClassName,
  autoFocus = false,
  required = false,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel,
}: NumberStepperProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<number>(() => {
    if (value !== undefined) return value;
    return defaultValue;
  });
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);

  // Dong bo internalValue khi defaultValue thay doi (khi chuyen sang sua san pham khac)
  if (!isControlled && defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setInternalValue(defaultValue);
  }

  const displayValue = isControlled ? value : internalValue;

  // Dong bo gia tri DOM input khi defaultValue thay doi
  useEffect(() => {
    if (!isControlled && inputRef.current && defaultValue !== undefined) {
      inputRef.current.value = String(defaultValue);
    }
  }, [defaultValue, isControlled]);

  // Dong bo internalValue khi DOM input thay doi tu ngoai (vi du khoi phuc localStorage draft)
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const syncFromDom = () => {
      const parsed = parseFloat(input.value);
      setInternalValue(Number.isNaN(parsed) ? 0 : parsed);
    };

    input.addEventListener("input", syncFromDom);
    input.addEventListener("change", syncFromDom);

    return () => {
      input.removeEventListener("input", syncFromDom);
      input.removeEventListener("change", syncFromDom);
    };
  }, []);

  const numericStep = typeof step === "number" ? step : 1;
  const effectiveMin = allowNegative ? min : min !== undefined ? min : 0;

  const handleStep = (delta: number) => {
    const input = inputRef.current;
    if (!input || disabled) return;

    const currentVal = parseFloat(input.value) || 0;
    let nextVal = currentVal + delta;
    if (effectiveMin !== undefined && nextVal < effectiveMin)
      nextVal = effectiveMin;
    if (max !== undefined && nextVal > max) nextVal = max;

    // Lam tron tranh loi so thuc JavaScript (vi du 0.1 + 0.2 = 0.30000000000000004)
    if (allowDecimal) {
      nextVal = Math.round(nextVal * 1000) / 1000;
    } else if (numericStep >= 1) {
      nextVal = Math.round(nextVal);
    } else {
      nextVal = Math.round(nextVal * 100) / 100;
    }

    // Set value bang native property descriptor de trigger React va Form event
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(input, String(nextVal));
    }
    input.value = String(nextVal);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    setInternalValue(nextVal);
    onChange?.(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    const nextVal = Number.isNaN(parsed) ? 0 : parsed;
    setInternalValue(nextVal);
    onChange?.(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" && e.shiftKey) {
      e.preventDefault();
      handleStep(numericStep * 10);
    } else if (e.key === "ArrowDown" && e.shiftKey) {
      e.preventDefault();
      handleStep(-numericStep * 10);
    }
  };

  const fieldNameMap: Record<string, string> = {
    price: "Giá bán",
    costPrice: "Giá vốn",
    stock: "Tồn kho",
  };
  const fieldDisplayName = ariaLabel || fieldNameMap[name] || name;
  const labelPrefix = fieldDisplayName ? `${fieldDisplayName} ` : "";
  const stepFormatted =
    isCurrency && numericStep >= 1000
      ? `${formatVnd(numericStep)} ₫`
      : String(step);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "border-input bg-background focus-within:border-primary focus-within:ring-primary/20 relative flex items-center overflow-hidden rounded-2xl border shadow-xs transition-[border-color,box-shadow] focus-within:ring-3",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => handleStep(-numericStep)}
          disabled={
            disabled ||
            (effectiveMin !== undefined && displayValue <= effectiveMin)
          }
          aria-label={`Giảm ${labelPrefix}${stepFormatted}`}
          className="hover:bg-muted active:bg-muted/80 border-input/60 text-muted-foreground hover:text-foreground inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center border-r transition-colors select-none disabled:pointer-events-none disabled:opacity-30 sm:w-14"
        >
          <Minus aria-hidden="true" weight="bold" className="size-5" />
        </button>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="number"
          inputMode={isCurrency ? "numeric" : "decimal"}
          min={effectiveMin}
          max={max}
          step={allowDecimal || isCurrency ? "any" : step}
          defaultValue={defaultValue}
          value={value}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onFocus={(e) => {
            if (e.target.value === "0") {
              e.target.select();
            }
          }}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-12 flex-1 border-0 bg-transparent px-3 text-center text-lg font-bold tabular-nums outline-none focus:ring-0 focus:outline-none sm:text-left",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            inputClassName,
          )}
        />

        {unit ? (
          <span className="text-muted-foreground pr-3 text-sm font-semibold select-none">
            {unit}
          </span>
        ) : isCurrency ? (
          <span className="text-muted-foreground pr-3 text-sm font-bold select-none">
            ₫
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => handleStep(numericStep)}
          disabled={disabled || (max !== undefined && displayValue >= max)}
          aria-label={`Tăng ${labelPrefix}${stepFormatted}`}
          className="hover:bg-muted active:bg-muted/80 border-input/60 text-muted-foreground hover:text-foreground inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center border-l transition-colors select-none disabled:pointer-events-none disabled:opacity-30 sm:w-14"
        >
          <Plus aria-hidden="true" weight="bold" className="size-5" />
        </button>
      </div>

      {/* Quick step chips va currency preview */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-0.5">
        {quickSteps && quickSteps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">
              Cộng nhanh:
            </span>
            {quickSteps.map((quickStep) => {
              const chipLabel =
                isCurrency && quickStep >= 1000
                  ? `+${formatVnd(quickStep)}`
                  : `+${quickStep}`;
              return (
                <button
                  key={quickStep}
                  type="button"
                  onClick={() => handleStep(quickStep)}
                  disabled={disabled}
                  aria-label={`Cộng ${chipLabel} vào ${ariaLabel || name}`}
                  className="border-border/80 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary rounded-lg border px-2.5 py-1 text-xs font-bold transition-[background-color,border-color,color,transform] select-none active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {chipLabel}
                </button>
              );
            })}
          </div>
        ) : null}

        {isCurrency && displayValue > 0 ? (
          <div className="text-muted-foreground ml-auto text-xs font-medium">
            Thành tiền:{" "}
            <span className="text-primary font-bold">
              {formatVnd(displayValue)} ₫
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
