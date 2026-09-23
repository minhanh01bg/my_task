"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & { size?: "sm" | "default" }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch bg-input focus-visible:ring-ring/30 data-checked:bg-primary relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 shadow-xs transition-colors duration-200 outline-none focus-visible:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-7 data-[size=default]:w-12 data-[size=sm]:h-5 data-[size=sm]:w-9",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background pointer-events-none block rounded-full shadow-sm ring-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[size=default]/switch:size-6 group-data-[size=sm]/switch:size-4 data-checked:translate-x-[calc(100%-2px)]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
