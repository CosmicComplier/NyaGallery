"use client";

import { Children, cloneElement, isValidElement, forwardRef, type ReactElement, type ReactNode } from "react";

type SlotProps = {
  children?: ReactNode;
  className?: string;
} & Record<string, unknown>;

function mergeClassNames(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

function mergeProps(parent: Record<string, unknown>, child: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...child };
  for (const key of Object.keys(parent)) {
    const parentValue = parent[key];
    const childValue = child[key];
    if (key === "className") {
      merged.className = mergeClassNames(parentValue as string | undefined, childValue as string | undefined);
    } else if (key === "style") {
      merged.style = { ...(parentValue as object), ...(childValue as object) };
    } else if (key.startsWith("on") && typeof parentValue === "function") {
      merged[key] = (...args: unknown[]) => {
        if (typeof childValue === "function") (childValue as (...a: unknown[]) => void)(...args);
        (parentValue as (...a: unknown[]) => void)(...args);
      };
    } else if (parentValue !== undefined) {
      merged[key] = childValue ?? parentValue;
    }
  }
  return merged;
}

export const Slot = forwardRef<HTMLElement, SlotProps>(({ children, ...rest }, ref) => {
  const child = Children.only(children) as ReactElement<Record<string, unknown>>;
  if (!isValidElement(child)) return null;
  const merged = mergeProps(rest, child.props as Record<string, unknown>);
  return cloneElement(child, { ...merged, ref } as Record<string, unknown>);
});
Slot.displayName = "Slot";
