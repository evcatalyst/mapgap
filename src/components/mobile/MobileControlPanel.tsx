import {
  CheckCircle2,
  ChevronDown,
  MapPinPlus,
  MapPinned,
  Route,
  Shirt,
  SlidersHorizontal,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER } from "../../constants";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { useScenarioLauncher } from "../../hooks/useScenarioLauncher";
import {
  getRoutingSetupMessage,
  isAnyRoutingProviderReady,
  isRoutingProviderReady,
  isValhallaAccessReady,
} from "../../lib/routingStatus";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { AskMapGapPanel } from "../ask/AskMapGapPanel";
import { AssetAuditPanel } from "../assets/AssetAuditPanel";
import { CandidateZonesPanel } from "../candidates/CandidateZonesPanel";
import { MapControlsPanel } from "../map/MapControlsPanel";
import { ObservabilityReportPanel } from "../observability/ObservabilityReportPanel";
import { PoiLayerWorkbench } from "../poi/PoiLayerWorkbench";
import { ProfilePanel } from "../profile/ProfilePanel";
import { MapSearchBox } from "../search/MapSearchBox";
import { ScenarioSelector } from "../scenarios/ScenarioSelector";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export function MobileControlPanel() {
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const status = useMapIsoStore((state) => state.status);
  const settings = useMapIsoStore((state) => state.settings);
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const setSidebarOpen = useMapIsoStore((state) => state.setSidebarOpen);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const { launchScenario } = useScenarioLauncher();
  const routingReady = isRoutingProviderReady(status, settings.routingProvider);
  const valhallaAccessReady = isValhallaAccessReady(status, settings);
  const anyRoutingReady = isAnyRoutingProviderReady(status);
  const canGenerate = routingReady && valhallaAccessReady && points.length > 0;
  const generatedLabel =
    isochrones.length > 0 ? `${isochrones.length} ring${isochrones.length === 1 ? "" : "s"}` : "Not generated";

  const handleAddLocation = () => {
    addPoint(DEFAULT_CENTER, { name: "New location" });
    toast.success("Location added at map center.");
  };

  const handleGenerate = async () => {
    await generateIsochrones();

    if (canGenerate) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside className="flex h-full min-w-0 flex-col bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm">
              <MapPinned className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold leading-none">MapGap</h2>
              <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                Mobile field test
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close MapGap controls"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]">
        <ObservabilityReportPanel compact />

        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Ready to map access
              </h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Search a place, add POIs or locations, then generate.
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {points.length} point{points.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ReadinessBadge
              ready={status.apiStatus === "ready"}
              label={status.apiStatus === "ready" ? "API ready" : "API check"}
            />
            <ReadinessBadge
              ready={routingReady && valhallaAccessReady}
              label={routingReady && valhallaAccessReady ? "Routing ready" : "Routing setup"}
            />
          </div>

          <MapSearchBox compact />

          <AskMapGapPanel compact />

          <ScenarioSelector />

          <PoiLayerWorkbench compact />

        </section>

        <ProfilePanel compact />
        <AssetAuditPanel compact />
        <CandidateZonesPanel compact />

        <details className="group rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              Advanced map settings
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-neutral-500 transition group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
            <MapControlsPanel compact showValhallaAccessSecret={false} />
          </div>
        </details>

        <details className="group rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <span>Run status</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-neutral-500 transition group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
            <div className="grid grid-cols-2 gap-2">
              <Badge variant="outline" className="justify-center">
                {points.length} point{points.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="justify-center">
                {generatedLabel}
              </Badge>
            </div>
            <Badge
              variant={status.apiStatus === "ready" ? "success" : "warning"}
              className="h-auto w-full justify-start whitespace-normal py-2"
            >
              {status.apiMessage}
            </Badge>
            {!anyRoutingReady && (
              <Badge variant="warning" className="h-auto w-full justify-start whitespace-normal py-2">
                {getRoutingSetupMessage(status)}
              </Badge>
            )}
            {status.generationError && (
              <Badge variant="danger" className="h-auto w-full justify-start whitespace-normal py-2">
                {status.generationError}
              </Badge>
            )}
          </div>
        </details>
      </div>

      <div className="shrink-0 border-t border-neutral-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => launchScenario("laundromat-walkability")}
            aria-label="Find laundry places in this map view and generate heatmap"
          >
            <Shirt className="h-4 w-4" aria-hidden="true" />
            Laundry
          </Button>
          <Button type="button" variant="secondary" onClick={handleAddLocation}>
            <MapPinPlus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
          <Button
            type="button"
            variant={canGenerate ? "primary" : "secondary"}
            onClick={handleGenerate}
            disabled={!canGenerate || isGeneratingIsochrones}
          >
            <Route className="h-4 w-4" aria-hidden="true" />
            {isGeneratingIsochrones ? "Generating" : "Generate"}
          </Button>
        </div>
      </div>
    </aside>
  );
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <Badge
      variant={ready ? "success" : "warning"}
      className="h-8 min-w-0 justify-center gap-1.5 px-2"
    >
      {ready && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </Badge>
  );
}
