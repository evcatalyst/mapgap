import { Clock3 } from "lucide-react";
import { getAccessBucketColor } from "../../lib/accessHeat";
import { useMapIsoStore } from "../../store/useMapIsoStore";

type TimeRingLegendProps = {
  buckets?: number[];
  compact?: boolean;
};

export function TimeRingLegend({ buckets, compact = false }: TimeRingLegendProps) {
  const settings = useMapIsoStore((state) => state.settings);
  const visibleBuckets = buckets || settings.timeBuckets;

  if (compact) {
    return (
      <div className="rounded-md border border-white/70 bg-white/90 px-2 py-1.5 text-[11px] text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-950/85 dark:text-neutral-200">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
          <span className="font-semibold text-neutral-950 dark:text-white">Rings</span>
          <div className="ml-1 flex items-center gap-1">
            {visibleBuckets.map((bucket, index) => (
              <span
                key={bucket}
                className="h-1.5 rounded-full"
                title={`${bucket} min`}
                style={{
                  width: `${12 + index * 4}px`,
                  backgroundColor: getAccessBucketColor(bucket),
                  opacity: 0.45 + index * 0.12,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/70 bg-white/95 p-3 text-xs text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-950/90 dark:text-neutral-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-950 dark:text-white">Network rings</span>
        <Clock3 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        {visibleBuckets.map((bucket, index) => (
          <div key={bucket} className="flex items-center gap-2">
            <span
              className="h-2 rounded-full"
              style={{
                width: `${34 + index * 16}px`,
                backgroundColor: getAccessBucketColor(bucket),
                opacity: 0.45 + index * 0.12,
              }}
            />
            <span>{bucket} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
