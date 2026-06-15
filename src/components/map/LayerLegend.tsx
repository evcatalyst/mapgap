import { Route } from "lucide-react";
import { ACCESS_HEAT_STOPS } from "../../lib/accessHeat";
import { useMapIsoStore } from "../../store/useMapIsoStore";

export function LayerLegend() {
  const settings = useMapIsoStore((state) => state.settings);

  return (
    <div className="rounded-lg border border-white/70 bg-white/95 p-3 text-xs text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-950/90 dark:text-neutral-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-950 dark:text-white">MapGap access heat</span>
        <Route className="h-4 w-4 text-emerald-500" aria-hidden="true" />
      </div>
      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" />
      <div className="mt-2 flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>Near</span>
        <span>Reach edge</span>
        <span>Gap</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1">
        {ACCESS_HEAT_STOPS.map((stop) => (
          <div key={stop.label} className="space-y-1 text-center">
            <span
              className="mx-auto block h-1.5 rounded-full"
              style={{ backgroundColor: stop.color }}
            />
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{stop.label}</span>
          </div>
        ))}
      </div>
      {settings.isochroneMode === "overlap" && (
        <p className="mt-3 border-t border-neutral-200 pt-2 text-[11px] leading-4 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          Overlap shows shared access from multiple points. Color still represents each
          origin&apos;s travel-time ring.
        </p>
      )}
    </div>
  );
}
