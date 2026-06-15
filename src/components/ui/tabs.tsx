import * as React from "react";
import { cn } from "../../lib/utils";

type TabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
  ariaLabel: string;
  className?: string;
};

export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  ariaLabel,
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        "grid rounded-md border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-950",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          role="tab"
          aria-selected={item.value === value}
          className={cn(
            "min-h-9 rounded px-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500",
            item.value === value
              ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-800 dark:text-white"
              : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white",
          )}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
