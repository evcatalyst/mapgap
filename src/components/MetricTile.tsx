import type { ReactNode } from "react";

type MetricTileProps = {
  label: string;
  value: ReactNode;
};

export function MetricTile({ label, value }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-normal text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <div className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{value}</div>
    </div>
  );
}
