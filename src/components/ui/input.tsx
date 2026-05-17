import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-outline-variant/80 bg-surface-container-low file:text-foreground placeholder:text-on-surface-variant/45 focus-visible:border-primary focus-visible:ring-primary/12 disabled:bg-input/50 text-on-surface aria-invalid:border-destructive aria-invalid:ring-destructive/12 h-12 w-full min-w-0 rounded-2xl border px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:bg-white focus-visible:ring-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-4 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export { Input };
