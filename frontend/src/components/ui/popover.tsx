"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  align = "start",
}: PopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          className={cn(
            "absolute top-full z-40 mt-1 min-w-[14rem] origin-top animate-scale-in rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
            align === "end" ? "right-0" : "left-0",
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function usePopover() {
  return useState(false);
}
