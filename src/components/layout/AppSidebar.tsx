import {
  BarChart3,
  ChevronsLeftRight,
  Database,
  MapPinned,
  Route,
  Upload,
} from "lucide-react";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { ScenarioSelector } from "../scenarios/ScenarioSelector";
import { WorkflowPanel } from "../workflow/WorkflowPanel";
import { MapControlsPanel } from "../map/MapControlsPanel";

type AppSidebarProps = {
  mobile?: boolean;
};

export function AppSidebar({ mobile = false }: AppSidebarProps) {
  const sidebarOpen = useMapIsoStore((state) => state.sidebarOpen);
  const setCommandPaletteOpen = useMapIsoStore((state) => state.setCommandPaletteOpen);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const status = useMapIsoStore((state) => state.status);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const apiReady = status.apiCapabilities.openRouteService;

  if (!sidebarOpen && !mobile) {
    return (
      <aside className="hidden w-[76px] shrink-0 border-r border-neutral-200 bg-white px-3 py-4 dark:border-neutral-800 dark:bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm">
          <MapPinned className="h-5 w-5" aria-hidden="true" />
        </span>
        {[Upload, Route, BarChart3, Database].map((Icon, index) => (
          <Button key={index} type="button" variant="ghost" size="icon" aria-label="Sidebar action">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </Button>
        ))}
      </aside>
    );
  }

  return (
    <aside className={mobile ? "flex h-full flex-col bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-white" : "hidden w-[360px] shrink-0 border-r border-neutral-200 bg-stone-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white lg:flex lg:flex-col"}>
      <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-none">MapGap</h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Nearby is not always easy to reach
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <ScenarioSelector />

        <Card>
          <CardHeader>
            <CardTitle>Run status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Badge variant="outline" className="justify-center">
                {points.length} points
              </Badge>
              <Badge variant="outline" className="justify-center">
                {isochrones.length} rings
              </Badge>
            </div>
            <Badge
              variant={status.apiStatus === "ready" ? "success" : "warning"}
              className="h-auto w-full justify-start py-2"
            >
              {status.apiMessage}
            </Badge>
            {status.generationError && (
              <Badge variant="danger" className="h-auto w-full justify-start py-2">
                {status.generationError}
              </Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Button type="button" variant="secondary" onClick={() => setCommandPaletteOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Add or import locations
          </Button>
          <Button
            type="button"
            variant={apiReady && points.length > 0 ? "primary" : "secondary"}
            onClick={generateIsochrones}
            disabled={!apiReady || points.length === 0 || isGeneratingIsochrones}
          >
            <Route className="h-4 w-4" aria-hidden="true" />
              {!apiReady ? "Routing API required" : "Generate access heatmap"}
          </Button>
        </div>

        <Separator />
        <MapControlsPanel compact />
        <Separator />
        <WorkflowPanel />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChevronsLeftRight className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Operator notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              Use overlap mode to find shared access areas. Use individual mode to compare
              point-by-point gaps under the same travel-time assumptions.
            </p>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
