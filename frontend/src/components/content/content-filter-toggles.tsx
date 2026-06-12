"use client";

import { useContentPreferences } from "@/components/providers/content-preferences-provider";
import { cn } from "@/lib/utils";

export function ContentFilterToggles({ className }: { className?: string }) {
  const { showSensitive, setShowSensitive, showAi, setShowAi, canViewSensitiveContent } =
    useContentPreferences();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {canViewSensitiveContent && (
        <FilterSwitch
          label="R-18"
          checked={showSensitive}
          onCheckedChange={setShowSensitive}
          title="显示 R-18 / R-18G"
        />
      )}
      <FilterSwitch
        label="AI"
        checked={showAi}
        onCheckedChange={setShowAi}
        title="显示 AI 生成作品"
      />
    </div>
  );
}

function FilterSwitch({
  label,
  checked,
  onCheckedChange,
  title,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <label
      className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground"
      title={title}
    >
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}
