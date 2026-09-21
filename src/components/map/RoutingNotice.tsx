import { cancelIsochroneGeneration } from "../../hooks/useIsochroneGenerator";
import { useMapIsoStore } from "../../store/useMapIsoStore";

export function RoutingNotice() {
  const status = useMapIsoStore((state) => state.status);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const running = useMapIsoStore((state) => state.isGeneratingIsochrones);
  const mock = status.apiCapabilities.synthetic || isochrones.some((feature) => feature.properties.mock || feature.properties.routingProvider === "synthetic");
  const summary = status.generationSummary;
  if (!mock && !summary?.warnings.length) return null;
  return (
    <aside aria-label="Routing status" className="absolute left-3 right-3 top-24 z-[700] max-w-lg rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow-sm sm:top-20">
      {mock && <p className="font-semibold">Mock isochrones — schematic reach, not network travel time.</p>}
      {summary && <p className="mt-1" role="status">Request budget: {summary.requestCount} · {summary.completedCount} contours returned{summary.warnings.length ? " · Partial results" : ""}</p>}
      {summary?.warnings.length ? <p className="mt-1" role="alert">{summary.warnings[0]}{summary.warnings.length > 1 ? ` (${summary.warnings.length} warnings)` : ""}</p> : null}
      {running && <button type="button" onClick={cancelIsochroneGeneration} className="mt-1 min-h-11 rounded border border-amber-500 px-3 font-semibold">Cancel generation</button>}
    </aside>
  );
}
