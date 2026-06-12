"use client";

import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagChipInput({
  tags,
  onChange,
  placeholder,
  disabled,
  small,
  getLabel,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  small?: boolean;
  getLabel?: (tag: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "_");
      if (!trimmed) return;
      if (tags.includes(trimmed)) {
        setDraft("");
        return;
      }
      onChange([...tags, trimmed]);
      setDraft("");
    },
    [tags, onChange]
  );

  function removeAt(index: number) {
    const next = tags.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring/40",
        small ? "min-h-[32px] px-1.5 py-1" : "min-h-[36px] px-2 py-1.5",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
        >
          <span className="font-medium">{getLabel ? getLabel(tag) : tag.replace(/_/g, " ")}</span>
          <button
            type="button"
            aria-label={`移除 ${tag}`}
            onClick={(e) => {
              e.stopPropagation();
              removeAt(idx);
            }}
            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        spellCheck={false}
        autoComplete="off"
        disabled={disabled}
        className={cn(
          "flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          small ? "px-0.5 py-0" : "px-1 py-0.5"
        )}
      />
    </div>
  );
}
