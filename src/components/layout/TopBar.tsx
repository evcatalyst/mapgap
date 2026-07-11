import {
  Command,
  Eraser,
  MapPinPlus,
  Menu,
  Moon,
  Share2,
  Shirt,
  Sun,
} from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER } from "../../constants";
import { buildShareUrl, createShareSnapshot } from "../../lib/shareSnapshot";
import { useScenarioLauncher } from "../../hooks/useScenarioLauncher";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { AskMapGapPanel } from "../ask/AskMapGapPanel";
import { GenerateActionButton } from "../map/GenerateActionButton";
import { MapSearchBox } from "../search/MapSearchBox";
import { Button } from "../ui/button";
import { StatusPills } from "./StatusPills";

export function TopBar() {
  const theme = useMapIsoStore((state) => state.theme);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const decisionProfile = useMapIsoStore((state) => state.decisionProfile);
  const sidebarOpen = useMapIsoStore((state) => state.sidebarOpen);
  const toggleSidebar = useMapIsoStore((state) => state.toggleSidebar);
  const toggleTheme = useMapIsoStore((state) => state.toggleTheme);
  const setCommandPaletteOpen = useMapIsoStore((state) => state.setCommandPaletteOpen);
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const clearAll = useMapIsoStore((state) => state.clearAll);
  const { launchScenario } = useScenarioLauncher();
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const hasData = points.length > 0 || isochrones.length > 0;

  const shareSnapshotCommand = async () => {
    const url = buildShareUrl(
      createShareSnapshot({
        scenario: settings.selectedScenario || decisionProfile.scenarioId,
        settings,
        points,
      }),
    );

    window.history.replaceState(null, "", url);

    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Share link copied.");
    } catch {
      toast.success("Share link added to the address bar.");
    }
  };

  return (
    <header
      role="banner"
      className="shrink-0 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 sm:px-4"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-[8.5rem] max-w-[12rem] shrink-0">
          <h1 className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
            MapGap Control Plane
          </h1>
          <p className="hidden truncate text-xs text-neutral-500 dark:text-neutral-400 sm:block">
            Nearby things aren't always easy to get to
          </p>
        </div>

        <StatusPills compact className="order-3 w-full sm:order-none sm:w-auto xl:max-w-[22rem]" />

        <AskMapGapPanel
          inline
          className="order-4 hidden min-w-[16rem] 2xl:order-none 2xl:block 2xl:max-w-[24rem] 2xl:flex-1"
        />

        <div className="order-5 hidden w-full min-w-[16rem] 2xl:order-none 2xl:block 2xl:max-w-[24rem] 2xl:flex-1">
          <MapSearchBox dense label="Quick place search" />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 sm:order-none sm:ml-0">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open commands and exports"
            title="Commands and exports"
          >
            <Command className="h-4 w-4" aria-hidden="true" />
          </Button>
          {hasData && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-9 w-9 text-rose-700 dark:text-rose-300"
              onClick={clearAll}
              aria-label="Clear all"
              title="Clear all"
            >
              <Eraser className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={shareSnapshotCommand}
            aria-label="Share snapshot"
            title="Share snapshot"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <ThemeIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="order-6 flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:order-none">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-9"
            onClick={() => {
              addPoint(DEFAULT_CENTER, { name: "New location" });
              toast.success("Location added at map center.");
            }}
            aria-label="Add point at map center"
          >
            <MapPinPlus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">Add location</span>
            <span className="2xl:hidden">Add</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={() => launchScenario("laundromat-walkability")}
            aria-label="Run laundromat walkability in current map view"
            title="Find laundry places in the current map view"
          >
            <Shirt className="h-4 w-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">Laundry in view</span>
            <span className="2xl:hidden">Laundry</span>
          </Button>
          <GenerateActionButton label="short" className="h-9 min-h-9 px-3 shadow-none" />
        </div>
      </div>
    </header>
  );
}
