"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { useI18n } from "@/components/providers/locale-provider";
import { localeOptions, type LocaleCode } from "@/lang";
import { cn } from "@/lib/utils";

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = localeOptions.find((option) => option.code === locale) ?? localeOptions[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("language.select")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted focus-ring",
          open && "border-primary text-primary"
        )}
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.code.split("-")[0].toUpperCase()}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <div
        role="menu"
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-max min-w-full max-w-[calc(100vw-1rem)] origin-top-right overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg transition",
          open ? "animate-scale-in" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        {localeOptions.map((option) => {
          const active = option.code === locale;
          return (
            <button
              key={option.code}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                setLocale(option.code as LocaleCode);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-4 whitespace-nowrap rounded px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent",
                active && "bg-primary/10 text-primary"
              )}
            >
              <span>{option.label}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{option.code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
