import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "outline" | "secondary";

const VARIANTS: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  outline: "border border-border bg-transparent text-foreground",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
