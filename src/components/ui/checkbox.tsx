"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input bg-background focus-visible:ring-ring/30 aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:bg-input/30 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border shadow-xs transition-colors duration-150 outline-none focus-visible:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center [&_svg]:size-3.5"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <MinusIcon aria-hidden="true" strokeWidth={3} />
            ) : (
              <CheckIcon aria-hidden="true" strokeWidth={3} />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
