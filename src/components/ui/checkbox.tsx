"use client";

import {
  IconCheck as CheckIcon,
  IconMinus as MinusIcon,
} from "@tabler/icons-react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-muted-foreground/60 bg-card text-primary-foreground hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary focus-visible:ring-offset-background data-disabled:hover:border-muted-foreground/60 data-disabled:hover:bg-card data-checked:data-disabled:hover:border-primary data-checked:data-disabled:hover:bg-primary data-indeterminate:data-disabled:hover:border-primary data-indeterminate:data-disabled:hover:bg-primary relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-[1.5px] shadow-xs transition-[background-color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-offset-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        data-slot="checkbox-indicator"
        className="flex scale-75 items-center justify-center opacity-0 transition-[opacity,scale] duration-150 ease-out data-checked:scale-100 data-checked:opacity-100 data-indeterminate:scale-100 data-indeterminate:opacity-100 motion-reduce:transition-none [&_svg]:size-3.5 [&_svg]:stroke-[3]"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <MinusIcon aria-hidden="true" />
            ) : (
              <CheckIcon aria-hidden="true" />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
